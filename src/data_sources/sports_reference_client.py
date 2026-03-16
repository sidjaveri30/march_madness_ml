from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urljoin

import pandas as pd
import requests
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config.settings import settings
from src.utils.io import ensure_dir, is_cache_fresh, read_dataframe, write_dataframe
from src.utils.logging import get_logger
from src.utils.team_names import normalizer

logger = get_logger(__name__)


class SportsReferenceClient:
    def __init__(self) -> None:
        self.base_url = settings.sports_reference_base_url.rstrip("/")
        self.espn_base_url = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball"
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "march-madness-ml/1.0"})
        self.cache_dir = ensure_dir(settings.cache_dir / "sports_reference")

    @retry(wait=wait_exponential(multiplier=1, min=1, max=8), stop=stop_after_attempt(3))
    def _get(self, url: str) -> requests.Response:
        response = self.session.get(url, timeout=30)
        response.raise_for_status()
        return response

    @staticmethod
    def _extract_html(text: str) -> str:
        # Sports Reference frequently wraps tables inside HTML comments.
        return text.replace("<!--", "").replace("-->", "")

    def fetch_school_index(self, force: bool = False) -> pd.DataFrame:
        path = self.cache_dir / "schools_index.parquet"
        if not force and is_cache_fresh(path, settings.data_ttl_hours * 7):
            return read_dataframe(path)

        url = f"{self.base_url}/schools/"
        logger.info("Fetching Sports Reference school index")
        response = self._get(url)
        soup = BeautifulSoup(self._extract_html(response.text), "lxml")
        rows: list[dict[str, str]] = []
        for link in soup.select("a[href*='/cbb/schools/']"):
            href = link.get("href", "")
            match = re.search(r"/cbb/schools/([^/]+)/$", href)
            if not match:
                continue
            school_name = link.get_text(" ", strip=True)
            if not school_name:
                continue
            rows.append(
                {
                    "school_name": school_name,
                    "team_normalized": normalizer.resolve(school_name),
                    "school_slug": match.group(1),
                    "school_url": urljoin("https://www.sports-reference.com", href),
                }
            )

        df = pd.DataFrame(rows)
        if df.empty:
            logger.warning("Sports Reference school index parser found no school links at %s", url)
            df = self._fetch_espn_team_index()
        else:
            df = df.drop_duplicates(subset=["team_normalized"])
        write_dataframe(df, path)
        return df

    def fetch_team_schedule(self, school_slug: str, season: int, force: bool = False) -> pd.DataFrame:
        path = self.cache_dir / f"schedule_{school_slug}_{season}.parquet"
        if not force and is_cache_fresh(path, settings.data_ttl_hours):
            return read_dataframe(path)

        if str(school_slug).isdigit():
            df = self._fetch_espn_team_schedule(team_id=str(school_slug), season=season)
        else:
            url = f"{self.base_url}/schools/{school_slug}/men/{season}-schedule.html"
            logger.info("Fetching Sports Reference schedule for slug=%s", school_slug)
            response = self._get(url)
            tables = pd.read_html(self._extract_html(response.text))
            if not tables:
                raise ValueError(f"No schedule tables found for {school_slug}")
            df = tables[0].copy()
            df.columns = [str(col).strip().lower().replace(" ", "_") for col in df.columns]
            df = df[df["g"].astype(str).str.isnumeric()].copy()
            df["school_slug"] = school_slug
        write_dataframe(df, path)
        return df

    def _fetch_espn_team_index(self) -> pd.DataFrame:
        url = f"{self.espn_base_url}/teams?limit=500"
        logger.info("Falling back to ESPN public team index")
        response = self._get(url)
        payload = response.json()
        rows: list[dict[str, str]] = []
        sports = payload.get("sports", [])
        for sport in sports:
            for league in sport.get("leagues", []):
                for item in league.get("teams", []):
                    team = item.get("team", {})
                    team_id = str(team.get("id", "")).strip()
                    display_name = team.get("displayName", "").strip()
                    if not team_id or not display_name:
                        continue
                    rows.append(
                        {
                            "school_name": display_name,
                            "team_normalized": normalizer.resolve(display_name),
                            "school_slug": team_id,
                            "school_url": team.get("links", [{}])[0].get("href", ""),
                            "short_name": team.get("shortDisplayName", "").strip(),
                            "location_name": team.get("location", "").strip(),
                            "team_name": team.get("name", "").strip(),
                            "nickname": team.get("nickname", "").strip(),
                            "abbreviation": team.get("abbreviation", "").strip(),
                        }
                    )
        df = pd.DataFrame(rows)
        if df.empty:
            raise ValueError("ESPN public team index returned no teams")
        return df.drop_duplicates(subset=["team_normalized"])

    def _fetch_espn_team_schedule(self, team_id: str, season: int) -> pd.DataFrame:
        url = f"{self.espn_base_url}/teams/{team_id}/schedule?season={season}&seasontype=2"
        logger.info("Fetching ESPN public schedule for team_id=%s", team_id)
        response = self._get(url)
        payload = response.json()
        team_info = payload.get("team", {})
        display_name = team_info.get("displayName", "")
        rows: list[dict[str, object]] = []
        for event in payload.get("events", []):
            competitions = event.get("competitions", [])
            if not competitions:
                continue
            competition = competitions[0]
            status_name = (
                competition.get("status", {})
                .get("type", {})
                .get("name", "")
            )
            if status_name != "STATUS_FINAL":
                continue
            competitors = competition.get("competitors", [])
            team_comp = next(
                (comp for comp in competitors if str(comp.get("team", {}).get("id", "")) == team_id),
                None,
            )
            opp_comp = next(
                (comp for comp in competitors if str(comp.get("team", {}).get("id", "")) != team_id),
                None,
            )
            if team_comp is None or opp_comp is None:
                continue
            home_away = team_comp.get("homeAway", "")
            neutral_site = bool(competition.get("neutralSite", False))
            team_score = pd.to_numeric(team_comp.get("score"), errors="coerce")
            opp_score = pd.to_numeric(opp_comp.get("score"), errors="coerce")
            rows.append(
                {
                    "date": event.get("date"),
                    "opp": opp_comp.get("team", {}).get("displayName", ""),
                    "w/l": "W" if bool(team_comp.get("winner", False)) else "L",
                    "tm": team_score,
                    "opp.1": opp_score,
                    "@": "N" if neutral_site else ("@" if home_away == "away" else ""),
                    "school_slug": team_id,
                    "team_name": display_name,
                }
            )
        df = pd.DataFrame(rows)
        if df.empty:
            raise ValueError(f"ESPN returned no completed schedule rows for team_id={team_id}")
        return df
