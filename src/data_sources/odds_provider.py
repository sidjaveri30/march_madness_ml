from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import requests

from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)


class OddsProvider:
    def __init__(self, cache_path: Path | None = None) -> None:
        self.cache_path = cache_path or settings.cache_dir / "odds" / "basketball_ncaab.json"
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)

    def _cache_fresh(self) -> bool:
        if not self.cache_path.exists():
            return False
        modified = datetime.fromtimestamp(self.cache_path.stat().st_mtime, tz=UTC)
        return datetime.now(tz=UTC) - modified <= timedelta(minutes=settings.odds_cache_ttl_minutes)

    def _read_cache(self) -> list[dict[str, Any]]:
        if not self.cache_path.exists():
            return []
        return json.loads(self.cache_path.read_text(encoding="utf-8"))

    def _write_cache(self, payload: list[dict[str, Any]]) -> None:
        self.cache_path.write_text(json.dumps(payload), encoding="utf-8")

    def fetch_events(self, force: bool = False) -> list[dict[str, Any]]:
        if not force and self._cache_fresh():
            return self._read_cache()

        if not settings.odds_api_key:
            logger.info("ODDS_API_KEY not configured; returning empty odds feed")
            return self._read_cache()

        params = {
            "apiKey": settings.odds_api_key,
            "regions": settings.odds_region,
            "markets": settings.odds_markets,
            "bookmakers": settings.odds_bookmakers,
            "oddsFormat": "american",
        }
        try:
            response = requests.get(
                "https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds",
                params=params,
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, list):
                self._write_cache(payload)
                return payload
        except Exception as exc:  # noqa: BLE001
            logger.warning("Odds API request failed, falling back to cache: %s", exc)
        return self._read_cache()
