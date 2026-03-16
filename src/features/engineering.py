from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from src.config.settings import settings
from src.utils.io import read_dataframe, write_dataframe
from src.utils.logging import get_logger
from src.utils.team_names import normalizer, register_school_aliases

logger = get_logger(__name__)


@dataclass
class FeatureArtifacts:
    season: int
    training_rows: int
    team_profile_rows: int


PUBLIC_COLUMN_CANDIDATES = {
    "date": ["date"],
    "opponent": ["opp", "opponent"],
    "result": ["w/l", "result"],
    "team_score": ["tm", "pts", "team_score"],
    "opp_score": ["opp.1", "opp_pts", "opp_score", "opp_score.1", "opponent_score"],
    "location": ["@", "location"],
}

KENPOM_COLUMN_ALIASES = {
    "rk": "kp_rank",
    "adjem": "adjem",
    "adjo": "adjo",
    "adjd": "adjd",
    "adjt": "adjt",
    "luck": "luck",
    "sos-adjem": "sos_adjem",
    "sos-oppo": "sos_oppo",
    "sos-oppd": "sos_oppd",
    "ncsos-adjem": "ncsos_adjem",
    "tempo-adj": "tempo_adj",
    "tempo-raw": "tempo_raw",
    "adjtempo": "adjtempo",
    "adjoe": "adjoe",
    "adjde": "adjde",
    "off-efg%": "off_efg",
    "off-to%": "off_to",
    "off-or%": "off_or",
    "off-ftrate": "off_ftrate",
    "def-efg%": "def_efg",
    "def-to%": "def_to",
    "def-or%": "def_or",
    "def-ftrate": "def_ftrate",
    "avghgt": "avg_hgt",
    "experience": "experience",
    "bench": "bench_minutes",
    "continuity": "continuity",
    "off_3p%": "off_3p_pct",
    "off_2p%": "off_2p_pct",
    "off_ft%": "off_ft_pct",
    "off_3pa%": "off_3pa_rate",
    "off_blk%": "off_blk_rate_against",
    "off_stl%": "off_stl_rate_against",
    "off_nst%": "off_non_steal_to_rate",
    "off_a%": "off_assist_rate",
    "off_adjoe": "off_misc_adjoe",
    "def_3p%": "def_3p_pct",
    "def_2p%": "def_2p_pct",
    "def_ft%": "def_ft_pct",
    "def_3pa%": "def_3pa_rate",
    "def_blk%": "def_blk_rate",
    "def_stl%": "def_stl_rate",
    "def_nst%": "def_non_steal_to_rate",
    "def_a%": "def_assist_rate_allowed",
    "def_adjde": "def_misc_adjde",
    "off-ft": "ptdist_ft_share",
    "off-2p": "ptdist_2p_share",
    "off-3p": "ptdist_3p_share",
    "def-ft": "ptdist_ft_allowed_share",
    "def-2p": "ptdist_2p_allowed_share",
    "def-3p": "ptdist_3p_allowed_share",
}

CURATED_PUBLIC_SUPPORT = [
    "games_played_before",
    "avg_opp_adjem_pre",
    "avg_opp_adjo_pre",
    "avg_opp_adjd_pre",
    "recent_opp_adjem_5",
    "top50_win_pct_pre",
    "top100_win_pct_pre",
    "schedule_adjusted_margin_pre",
    "recent_schedule_adjusted_margin_5",
    "performance_vs_top50_pre",
]

SUPPORT_KP_FEATURES = ["kp_rank"]

CURATED_KP_FEATURES = [
    "adjem",
    "adjo",
    "adjd",
    "adjt",
    "luck",
    "sos_adjem",
    "sos_oppo",
    "sos_oppd",
    "ncsos_adjem",
    "off_efg",
    "off_to",
    "off_or",
    "off_ftrate",
    "def_efg",
    "def_to",
    "def_or",
    "def_ftrate",
    "off_3p_pct",
    "off_2p_pct",
    "off_3pa_rate",
    "off_ft_pct",
    "off_assist_rate",
    "off_stl_rate_against",
    "off_blk_rate_against",
    "def_3p_pct",
    "def_2p_pct",
    "def_3pa_rate",
    "def_ft_pct",
    "def_blk_rate",
    "def_stl_rate",
    "def_assist_rate_allowed",
    "avg_hgt",
    "experience",
    "bench_minutes",
    "continuity",
    "ptdist_2p_share",
    "ptdist_3p_share",
    "ptdist_ft_share",
    "ptdist_2p_allowed_share",
    "ptdist_3p_allowed_share",
    "ptdist_ft_allowed_share",
]

INTERACTION_FEATURES = [
    "quality_vs_schedule_diff",
    "shooting_matchup_diff",
    "three_point_matchup_diff",
    "two_point_matchup_diff",
    "shot_profile_matchup_diff",
    "turnover_matchup_diff",
    "offensive_rebound_matchup_diff",
    "free_throw_matchup_diff",
    "assist_creation_matchup_diff",
    "rim_pressure_matchup_diff",
    "style_conflict_diff",
    "tempo_clash_abs",
    "size_experience_diff",
    "bench_continuity_diff",
    "opponent_quality_resilience_diff",
]


def _coerce_score(value: object) -> float | None:
    if isinstance(value, dict):
        if "value" in value:
            return pd.to_numeric(value["value"], errors="coerce")
        if "displayValue" in value:
            return pd.to_numeric(value["displayValue"], errors="coerce")
    return pd.to_numeric(value, errors="coerce")


def _pick_column(df: pd.DataFrame, logical_name: str) -> str | None:
    for candidate in PUBLIC_COLUMN_CANDIDATES[logical_name]:
        if candidate in df.columns:
            return candidate
    return None


def _latest_season() -> int:
    files = sorted(settings.raw_data_dir.glob("kenpom_team_metrics_*.parquet"))
    if not files:
        raise FileNotFoundError("No raw KenPom team metrics found. Run data refresh first.")
    return int(files[-1].stem.split("_")[-1])


def load_raw_inputs(season: int | None = None) -> tuple[pd.DataFrame, pd.DataFrame, int]:
    chosen_season = season or _latest_season()
    school_index_path = settings.cache_dir / "sports_reference" / "schools_index.parquet"
    if school_index_path.exists():
        school_index = read_dataframe(school_index_path)
        register_school_aliases(school_index.to_dict(orient="records"))
    public_games = read_dataframe(settings.raw_data_dir / f"sports_reference_games_{chosen_season}.parquet")
    kenpom = read_dataframe(settings.raw_data_dir / f"kenpom_team_metrics_{chosen_season}.parquet")
    return public_games, kenpom, chosen_season


def prepare_public_games(public_games: pd.DataFrame) -> pd.DataFrame:
    df = public_games.copy()
    df.columns = [str(col).strip().lower().replace(" ", "_") for col in df.columns]

    date_col = _pick_column(df, "date")
    opponent_col = _pick_column(df, "opponent")
    result_col = _pick_column(df, "result")
    team_score_col = _pick_column(df, "team_score")
    opp_score_col = _pick_column(df, "opp_score")
    location_col = _pick_column(df, "location")

    required = {
        "date": date_col,
        "opponent": opponent_col,
        "result": result_col,
        "team_score": team_score_col,
        "opp_score": opp_score_col,
    }
    missing = [name for name, column in required.items() if column is None]
    if missing:
        raise ValueError(f"Public schedule schema is missing columns: {missing}")

    cleaned = pd.DataFrame(
        {
            "team": df["team"],
            "team_normalized": df["team_normalized"].map(normalizer.resolve),
            "date": pd.to_datetime(df[date_col], errors="coerce"),
            "opponent": df[opponent_col],
            "opponent_normalized": df[opponent_col].map(normalizer.resolve),
            "result": df[result_col].astype(str).str.upper().str[0],
            "team_score": df[team_score_col].map(_coerce_score),
            "opp_score": df[opp_score_col].map(_coerce_score),
            "location_raw": df[location_col] if location_col else "",
        }
    )
    cleaned = cleaned.dropna(subset=["date", "team_score", "opp_score"]).copy()
    cleaned["win"] = (cleaned["result"] == "W").astype(int)
    cleaned["margin"] = cleaned["team_score"] - cleaned["opp_score"]
    cleaned["is_home"] = (cleaned["location_raw"].astype(str).str.strip() == "").astype(int)
    cleaned["is_away"] = (cleaned["location_raw"].astype(str).str.strip() == "@").astype(int)
    cleaned["neutral_site"] = (cleaned["location_raw"].astype(str).str.strip().str.upper() == "N").astype(int)
    cleaned = cleaned.sort_values(["team_normalized", "date"]).reset_index(drop=True)
    return cleaned


def _add_team_form_features(cleaned_games: pd.DataFrame) -> pd.DataFrame:
    df = cleaned_games.copy()
    grouped = df.groupby("team_normalized", group_keys=False)
    df["games_played_before"] = grouped.cumcount()
    df["win_pct_pre"] = grouped["win"].transform(lambda s: s.shift().expanding().mean()).fillna(0.5)
    df["avg_points_for_pre"] = grouped["team_score"].transform(lambda s: s.shift().expanding().mean()).fillna(0.0)
    df["avg_points_against_pre"] = grouped["opp_score"].transform(lambda s: s.shift().expanding().mean()).fillna(0.0)
    df["avg_margin_pre"] = grouped["margin"].transform(lambda s: s.shift().expanding().mean()).fillna(0.0)
    df["recent_win_pct_5"] = grouped["win"].transform(lambda s: s.shift().rolling(5, min_periods=1).mean()).fillna(0.5)
    df["recent_win_pct_10"] = grouped["win"].transform(lambda s: s.shift().rolling(10, min_periods=1).mean()).fillna(0.5)
    df["recent_margin_5"] = grouped["margin"].transform(lambda s: s.shift().rolling(5, min_periods=1).mean()).fillna(0.0)
    df["recent_points_for_5"] = grouped["team_score"].transform(lambda s: s.shift().rolling(5, min_periods=1).mean()).fillna(0.0)
    df["recent_points_against_5"] = grouped["opp_score"].transform(lambda s: s.shift().rolling(5, min_periods=1).mean()).fillna(0.0)
    df["season_off_eff_proxy"] = (
        100 * df["avg_points_for_pre"] / np.maximum(df["avg_points_for_pre"] + df["avg_points_against_pre"], 1)
    )
    df["season_def_eff_proxy"] = (
        100 * df["avg_points_against_pre"] / np.maximum(df["avg_points_for_pre"] + df["avg_points_against_pre"], 1)
    )
    return df


def _flatten_kenpom_features(kenpom: pd.DataFrame) -> pd.DataFrame:
    df = kenpom.copy()
    numeric_cols = [col for col in df.columns if col not in {"team", "team_normalized"}]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    alias_columns = {
        alias: pd.to_numeric(df[raw_name], errors="coerce")
        for raw_name, alias in KENPOM_COLUMN_ALIASES.items()
        if raw_name in df.columns and alias not in df.columns
    }
    if alias_columns:
        df = pd.concat([df, pd.DataFrame(alias_columns, index=df.index)], axis=1)
    keep_cols = ["team", "team_normalized"] + [col for col in numeric_cols if df[col].notna().sum() > 0]
    keep_cols.extend([alias for alias in KENPOM_COLUMN_ALIASES.values() if alias in df.columns])
    return df[list(dict.fromkeys(keep_cols))].drop_duplicates(subset=["team_normalized"])


def _rolling_group_stat(grouped, column: str, window: int | None = None, op: str = "mean") -> pd.Series:
    series = grouped[column].shift()
    if window is not None:
        if op == "mean":
            return series.rolling(window, min_periods=1).mean()
        if op == "sum":
            return series.rolling(window, min_periods=1).sum()
    if op == "mean":
        return series.expanding().mean()
    if op == "sum":
        return series.expanding().sum()
    raise ValueError(f"Unsupported rolling op: {op}")


def build_training_dataset(season: int | None = None) -> FeatureArtifacts:
    public_games, kenpom_raw, chosen_season = load_raw_inputs(season=season)
    kenpom = _flatten_kenpom_features(kenpom_raw)
    cleaned = prepare_public_games(public_games)

    kp_lookup_columns = [
        col
        for col in dict.fromkeys(SUPPORT_KP_FEATURES + CURATED_KP_FEATURES)
        if col in kenpom.columns
    ]
    kp_curated_lookup = kenpom[["team_normalized", "team"] + kp_lookup_columns].copy()
    cleaned = cleaned.merge(kp_curated_lookup, on="team_normalized", how="left", suffixes=("", "_kp"))

    opponent_lookup = kp_curated_lookup.rename(
        columns={
            "team_normalized": "opponent_normalized",
            "team": "opponent_kp_team",
            **{col: f"opp_current_{col}" for col in kp_lookup_columns},
        }
    )
    cleaned = cleaned.merge(opponent_lookup, on="opponent_normalized", how="left")

    grouped = cleaned.groupby("team_normalized", group_keys=False)
    cleaned["games_played_before"] = grouped.cumcount()
    cleaned["avg_opp_adjem_pre"] = _rolling_group_stat(grouped, "opp_current_adjem").fillna(0.0)
    cleaned["avg_opp_adjo_pre"] = _rolling_group_stat(grouped, "opp_current_adjo").fillna(0.0)
    cleaned["avg_opp_adjd_pre"] = _rolling_group_stat(grouped, "opp_current_adjd").fillna(0.0)
    cleaned["recent_opp_adjem_5"] = _rolling_group_stat(grouped, "opp_current_adjem", window=5).fillna(0.0)

    cleaned["top50_game"] = (pd.to_numeric(cleaned["opp_current_kp_rank"], errors="coerce") <= 50).astype(int)
    cleaned["top100_game"] = (pd.to_numeric(cleaned["opp_current_kp_rank"], errors="coerce") <= 100).astype(int)
    cleaned["top50_win"] = cleaned["win"] * cleaned["top50_game"]
    cleaned["top100_win"] = cleaned["win"] * cleaned["top100_game"]
    cleaned["top50_games_pre"] = _rolling_group_stat(grouped, "top50_game", op="sum").fillna(0.0)
    cleaned["top100_games_pre"] = _rolling_group_stat(grouped, "top100_game", op="sum").fillna(0.0)
    cleaned["top50_wins_pre"] = _rolling_group_stat(grouped, "top50_win", op="sum").fillna(0.0)
    cleaned["top100_wins_pre"] = _rolling_group_stat(grouped, "top100_win", op="sum").fillna(0.0)
    cleaned["top50_win_pct_pre"] = cleaned["top50_wins_pre"] / np.maximum(cleaned["top50_games_pre"], 1.0)
    cleaned["top100_win_pct_pre"] = cleaned["top100_wins_pre"] / np.maximum(cleaned["top100_games_pre"], 1.0)

    expected_margin = pd.to_numeric(cleaned["adjem"], errors="coerce") - pd.to_numeric(
        cleaned["opp_current_adjem"], errors="coerce"
    )
    cleaned["schedule_adjusted_margin_game"] = cleaned["margin"] - expected_margin
    cleaned["schedule_adjusted_margin_pre"] = _rolling_group_stat(grouped, "schedule_adjusted_margin_game").fillna(0.0)
    cleaned["recent_schedule_adjusted_margin_5"] = _rolling_group_stat(
        grouped, "schedule_adjusted_margin_game", window=5
    ).fillna(0.0)
    cleaned["top50_margin_game"] = cleaned["margin"].where(cleaned["top50_game"] == 1, np.nan)
    cleaned["performance_vs_top50_pre"] = grouped["top50_margin_game"].transform(
        lambda s: s.shift().expanding().mean()
    ).fillna(0.0)

    team_stats = cleaned.copy()
    opponent_feature_columns = CURATED_PUBLIC_SUPPORT + CURATED_KP_FEATURES
    opponent_stats = team_stats[
        ["team_normalized", "date"] + [col for col in opponent_feature_columns if col in team_stats.columns]
    ].rename(columns={"team_normalized": "opponent_normalized", **{col: f"opp_{col}" for col in opponent_feature_columns if col in team_stats.columns}})

    matchup = team_stats.merge(opponent_stats, on=["opponent_normalized", "date"], how="left")

    for feature in CURATED_PUBLIC_SUPPORT + CURATED_KP_FEATURES:
        opp_feature = f"opp_{feature}"
        if feature in matchup.columns and opp_feature in matchup.columns:
            matchup[f"{feature}_diff"] = pd.to_numeric(matchup[feature], errors="coerce") - pd.to_numeric(
                matchup[opp_feature], errors="coerce"
            )

    def _interaction_edge(df: pd.DataFrame, off_col: str, opp_col: str) -> pd.Series:
        return pd.to_numeric(df[off_col], errors="coerce") - pd.to_numeric(df[opp_col], errors="coerce")

    a_shooting = _interaction_edge(matchup, "off_efg", "opp_def_efg")
    b_shooting = _interaction_edge(matchup, "opp_off_efg", "def_efg")
    matchup["shooting_matchup_diff"] = a_shooting - b_shooting

    a_three = _interaction_edge(matchup, "off_3p_pct", "opp_def_3p_pct")
    b_three = _interaction_edge(matchup, "opp_off_3p_pct", "def_3p_pct")
    matchup["three_point_matchup_diff"] = a_three - b_three

    a_two = _interaction_edge(matchup, "off_2p_pct", "opp_def_2p_pct")
    b_two = _interaction_edge(matchup, "opp_off_2p_pct", "def_2p_pct")
    matchup["two_point_matchup_diff"] = a_two - b_two

    a_profile = _interaction_edge(matchup, "off_3pa_rate", "opp_def_3pa_rate")
    b_profile = _interaction_edge(matchup, "opp_off_3pa_rate", "def_3pa_rate")
    matchup["shot_profile_matchup_diff"] = a_profile - b_profile

    a_turnover = (100 - pd.to_numeric(matchup["off_to"], errors="coerce")) - pd.to_numeric(
        matchup["opp_def_to"], errors="coerce"
    )
    b_turnover = (100 - pd.to_numeric(matchup["opp_off_to"], errors="coerce")) - pd.to_numeric(
        matchup["def_to"], errors="coerce"
    )
    matchup["turnover_matchup_diff"] = a_turnover - b_turnover

    a_or = _interaction_edge(matchup, "off_or", "opp_def_or")
    b_or = _interaction_edge(matchup, "opp_off_or", "def_or")
    matchup["offensive_rebound_matchup_diff"] = a_or - b_or

    a_ft = _interaction_edge(matchup, "off_ftrate", "opp_def_ftrate")
    b_ft = _interaction_edge(matchup, "opp_off_ftrate", "def_ftrate")
    matchup["free_throw_matchup_diff"] = a_ft - b_ft

    a_ast = _interaction_edge(matchup, "off_assist_rate", "opp_def_assist_rate_allowed")
    b_ast = _interaction_edge(matchup, "opp_off_assist_rate", "def_assist_rate_allowed")
    matchup["assist_creation_matchup_diff"] = a_ast - b_ast

    a_rim = _interaction_edge(matchup, "off_2p_pct", "opp_def_blk_rate")
    b_rim = _interaction_edge(matchup, "opp_off_2p_pct", "def_blk_rate")
    matchup["rim_pressure_matchup_diff"] = a_rim - b_rim

    a_style = _interaction_edge(matchup, "ptdist_3p_share", "opp_ptdist_3p_allowed_share")
    b_style = _interaction_edge(matchup, "opp_ptdist_3p_share", "ptdist_3p_allowed_share")
    matchup["style_conflict_diff"] = a_style - b_style

    matchup["tempo_clash_abs"] = (
        pd.to_numeric(matchup["adjt"], errors="coerce") - pd.to_numeric(matchup["opp_adjt"], errors="coerce")
    ).abs()
    matchup["size_experience_diff"] = (
        pd.to_numeric(matchup["avg_hgt"], errors="coerce")
        + pd.to_numeric(matchup["experience"], errors="coerce")
        + pd.to_numeric(matchup["continuity"], errors="coerce")
        - pd.to_numeric(matchup["opp_avg_hgt"], errors="coerce")
        - pd.to_numeric(matchup["opp_experience"], errors="coerce")
        - pd.to_numeric(matchup["opp_continuity"], errors="coerce")
    )
    matchup["bench_continuity_diff"] = (
        pd.to_numeric(matchup["bench_minutes"], errors="coerce")
        + pd.to_numeric(matchup["continuity"], errors="coerce")
        - pd.to_numeric(matchup["opp_bench_minutes"], errors="coerce")
        - pd.to_numeric(matchup["opp_continuity"], errors="coerce")
    )
    matchup["quality_vs_schedule_diff"] = (
        pd.to_numeric(matchup["adjem"], errors="coerce")
        + 0.5 * pd.to_numeric(matchup["sos_adjem"], errors="coerce")
        - pd.to_numeric(matchup["opp_adjem"], errors="coerce")
        - 0.5 * pd.to_numeric(matchup["opp_sos_adjem"], errors="coerce")
    )
    matchup["opponent_quality_resilience_diff"] = (
        pd.to_numeric(matchup["schedule_adjusted_margin_pre"], errors="coerce")
        + 0.35 * pd.to_numeric(matchup["avg_opp_adjem_pre"], errors="coerce")
        - pd.to_numeric(matchup["opp_schedule_adjusted_margin_pre"], errors="coerce")
        - 0.35 * pd.to_numeric(matchup["opp_avg_opp_adjem_pre"], errors="coerce")
    )

    matchup["neutral_site"] = matchup["neutral_site"].fillna(0).astype(int)
    training = matchup.dropna(subset=["win"]).copy()
    training["season"] = chosen_season
    training = training.sort_values("date").reset_index(drop=True)

    latest_team_profiles = (
        team_stats.sort_values("date")
        .groupby("team_normalized", as_index=False)
        .tail(1)
        .drop_duplicates(subset=["team_normalized"])
    )
    latest_team_profiles["display_name"] = latest_team_profiles["team"]

    write_dataframe(training, settings.processed_data_dir / f"training_matchups_{chosen_season}.parquet")
    write_dataframe(latest_team_profiles, settings.processed_data_dir / f"team_profiles_{chosen_season}.parquet")
    logger.info("Built training dataset with %s rows", len(training))
    return FeatureArtifacts(
        season=chosen_season,
        training_rows=len(training),
        team_profile_rows=len(latest_team_profiles),
    )
