from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from kenpompy import misc, summary, team
from kenpompy.utils import login

from src.config.settings import settings
from src.utils.io import ensure_dir, is_cache_fresh, read_dataframe, write_dataframe
from src.utils.logging import get_logger
from src.utils.team_names import normalizer

logger = get_logger(__name__)


@dataclass
class KenPomBundle:
    season: int
    pomeroy: pd.DataFrame
    efficiency: pd.DataFrame
    four_factors: pd.DataFrame
    height: pd.DataFrame
    offensive_teamstats: pd.DataFrame
    defensive_teamstats: pd.DataFrame
    point_distribution: pd.DataFrame
    valid_teams: pd.DataFrame


class KenPomClient:
    def __init__(self) -> None:
        self.cache_dir = ensure_dir(settings.cache_dir / "kenpom")

    def _cache_path(self, name: str, season: int) -> Path:
        return self.cache_dir / f"{name}_{season}.parquet"

    def _get_browser(self):
        if not settings.kenpom_email or not settings.kenpom_password:
            raise ValueError("Missing KenPom credentials in .env")
        return login(settings.kenpom_email, settings.kenpom_password)

    def _load_or_fetch(self, season: int, name: str, fetcher, browser, force: bool) -> pd.DataFrame:
        path = self._cache_path(name, season)
        if not force and is_cache_fresh(path, settings.data_ttl_hours):
            logger.info("Loading cached KenPom table %s", name)
            return read_dataframe(path)

        logger.info("Fetching KenPom table %s for season %s", name, season)
        df = fetcher(browser, season=season)
        df = self._coerce_to_dataframe(df, name)
        df = self._clean_table(df)
        write_dataframe(df, path)
        return df

    @staticmethod
    def _coerce_to_dataframe(data, name: str) -> pd.DataFrame:
        if isinstance(data, pd.DataFrame):
            return data
        if isinstance(data, list):
            if not data:
                return pd.DataFrame()
            if all(isinstance(item, str) for item in data):
                return pd.DataFrame({"team": data})
            return pd.DataFrame(data)
        if isinstance(data, dict):
            return pd.DataFrame(data)
        raise TypeError(f"Unsupported KenPom payload for {name}: {type(data)!r}")

    @staticmethod
    def _clean_table(df: pd.DataFrame) -> pd.DataFrame:
        renamed = df.copy()
        renamed.columns = [str(col).strip().lower().replace(" ", "_") for col in renamed.columns]
        team_col = next((col for col in renamed.columns if col in {"team", "teams"}), None)
        if team_col:
            renamed = renamed.rename(columns={team_col: "team"})
            renamed["team_normalized"] = renamed["team"].map(normalizer.resolve)
        return renamed

    def fetch_bundle(self, force: bool = False) -> KenPomBundle:
        browser = self._get_browser()
        season = misc.get_current_season(browser)
        logger.info("Detected KenPom current season: %s", season)

        bundle = KenPomBundle(
            season=season,
            pomeroy=self._load_or_fetch(season, "pomeroy", misc.get_pomeroy_ratings, browser, force),
            efficiency=self._load_or_fetch(season, "efficiency", summary.get_efficiency, browser, force),
            four_factors=self._load_or_fetch(season, "fourfactors", summary.get_fourfactors, browser, force),
            height=self._load_or_fetch(season, "height", summary.get_height, browser, force),
            offensive_teamstats=self._load_or_fetch(
                season,
                "offensive_teamstats",
                lambda b, season: summary.get_teamstats(b, defense=False, season=season),
                browser,
                force,
            ),
            defensive_teamstats=self._load_or_fetch(
                season,
                "defensive_teamstats",
                lambda b, season: summary.get_teamstats(b, defense=True, season=season),
                browser,
                force,
            ),
            point_distribution=self._load_or_fetch(
                season,
                "point_distribution",
                summary.get_pointdist,
                browser,
                force,
            ),
            valid_teams=self._load_or_fetch(season, "valid_teams", team.get_valid_teams, browser, force),
        )
        return bundle

    def fetch_team_schedule(self, team_name: str, season: int, force: bool = False) -> pd.DataFrame:
        browser = self._get_browser()
        safe_name = normalizer.resolve(team_name).replace(" ", "_")
        path = self.cache_dir / f"schedule_{safe_name}_{season}.parquet"
        if not force and is_cache_fresh(path, settings.data_ttl_hours):
            return read_dataframe(path)

        logger.info("Fetching KenPom schedule for %s", team_name)
        df = team.get_schedule(browser, team=team_name, season=season)
        df = self._clean_table(df)
        write_dataframe(df, path)
        return df
