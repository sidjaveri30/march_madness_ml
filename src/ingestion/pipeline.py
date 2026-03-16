from __future__ import annotations

from pathlib import Path

import pandas as pd

from src.config.settings import settings
from src.data_sources.kenpom_client import KenPomBundle, KenPomClient
from src.data_sources.sports_reference_client import SportsReferenceClient
from src.utils.io import ensure_dir, write_dataframe, write_json
from src.utils.logging import get_logger
from src.utils.team_names import normalizer, register_school_aliases

logger = get_logger(__name__)


def _pick_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for candidate in candidates:
        if candidate in df.columns:
            return candidate
    return None


def _merge_kenpom_tables(bundle: KenPomBundle) -> pd.DataFrame:
    tables = [
        bundle.pomeroy,
        bundle.efficiency,
        bundle.four_factors,
        bundle.height,
        bundle.offensive_teamstats.add_prefix("off_"),
        bundle.defensive_teamstats.add_prefix("def_"),
        bundle.point_distribution,
    ]
    merged: pd.DataFrame | None = None
    for table in tables:
        table = table.copy()
        if "off_team" in table.columns:
            table = table.rename(columns={"off_team": "team"})
        if "off_team_normalized" in table.columns:
            table = table.rename(columns={"off_team_normalized": "team_normalized"})
        if "def_team" in table.columns:
            table = table.rename(columns={"def_team": "team"})
        if "def_team_normalized" in table.columns:
            table = table.rename(columns={"def_team_normalized": "team_normalized"})
        if "team" not in table.columns:
            continue
        if "team_normalized" not in table.columns:
            table["team_normalized"] = table["team"].map(normalizer.resolve)
        deduped = table.loc[:, ~table.columns.duplicated()].copy()
        if merged is None:
            merged = deduped
        else:
            merged = merged.merge(
                deduped.drop(columns=["team"], errors="ignore"),
                on="team_normalized",
                how="outer",
                suffixes=("", "_dup"),
            )
    if merged is None:
        raise ValueError("No KenPom tables were available to merge")
    merged["season"] = bundle.season
    return merged.loc[:, ~merged.columns.str.endswith("_dup")]


def _prepare_sports_reference_games(
    valid_teams: pd.DataFrame,
    school_index: pd.DataFrame,
    season: int,
    force: bool,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    sr_client = SportsReferenceClient()
    required_school_cols = {"team_normalized", "school_slug", "school_name"}
    missing_cols = required_school_cols.difference(school_index.columns)
    if missing_cols:
        raise ValueError(
            f"Sports Reference school index is missing required columns: {sorted(missing_cols)}. "
            "The source layout may have changed."
        )
    merged_index = valid_teams.copy()
    merged_index["team_normalized"] = merged_index["team"].map(normalizer.resolve)

    alias_columns = [
        "school_name",
        "short_name",
        "location_name",
        "team_name",
        "abbreviation",
    ]
    alias_frames: list[pd.DataFrame] = []
    for column in alias_columns:
        if column not in school_index.columns:
            continue
        alias_frame = pd.DataFrame(
            {
                "source_name": school_index[column],
                "school_slug": school_index["school_slug"],
                "school_name": school_index["school_name"],
            }
        )
        alias_frame = alias_frame.dropna(subset=["source_name"])
        alias_frame = alias_frame[alias_frame["source_name"].astype(str).str.strip() != ""]
        alias_frame["team_normalized"] = alias_frame["source_name"].astype(str).map(normalizer.resolve)
        alias_frames.append(alias_frame[["team_normalized", "school_slug", "school_name"]])

    alias_index = pd.concat(alias_frames, ignore_index=True).drop_duplicates(subset=["team_normalized"])
    team_slug_map = merged_index.merge(alias_index, on="team_normalized", how="left")
    schedules: list[pd.DataFrame] = []
    missing: list[str] = []
    for row in team_slug_map.itertuples(index=False):
        if pd.isna(row.school_slug):
            missing.append(row.team)
            continue
        try:
            schedule = sr_client.fetch_team_schedule(str(row.school_slug), season=season, force=force)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to fetch public schedule for %s: %s", row.team, exc)
            missing.append(row.team)
            continue
        schedule["team"] = row.team
        schedule["team_normalized"] = row.team_normalized
        schedule["school_name"] = row.school_name
        schedules.append(schedule)

    if not schedules:
        raise ValueError("No public game schedules could be fetched from Sports Reference or ESPN fallback")
    all_games = pd.concat(schedules, ignore_index=True)
    logger.info(
        "Fetched public schedules for %s teams; %s teams were missing",
        len(schedules),
        len(missing),
    )
    return all_games, pd.DataFrame({"missing_team": missing})


def refresh_all_data(force: bool = False) -> dict[str, str]:
    ensure_dir(settings.raw_data_dir)
    ensure_dir(settings.processed_data_dir)

    kp_client = KenPomClient()
    sr_client = SportsReferenceClient()
    bundle = kp_client.fetch_bundle(force=force)
    school_index = sr_client.fetch_school_index(force=force)
    register_school_aliases(school_index.to_dict(orient="records"))
    kenpom_merged = _merge_kenpom_tables(bundle)
    public_games, missing_public = _prepare_sports_reference_games(
        valid_teams=bundle.valid_teams,
        school_index=school_index,
        season=bundle.season,
        force=force,
    )

    write_dataframe(bundle.valid_teams, settings.raw_data_dir / f"kenpom_valid_teams_{bundle.season}.parquet")
    write_dataframe(kenpom_merged, settings.raw_data_dir / f"kenpom_team_metrics_{bundle.season}.parquet")
    write_dataframe(public_games, settings.raw_data_dir / f"sports_reference_games_{bundle.season}.parquet")
    write_dataframe(missing_public, settings.raw_data_dir / f"missing_public_teams_{bundle.season}.csv")
    metadata = {
        "season": str(bundle.season),
        "kenpom_team_rows": str(len(kenpom_merged)),
        "public_game_rows": str(len(public_games)),
        "public_missing_teams": str(len(missing_public)),
    }
    write_json(metadata, settings.processed_data_dir / "refresh_metadata.json")
    logger.info("Data refresh complete: %s", metadata)
    return metadata
