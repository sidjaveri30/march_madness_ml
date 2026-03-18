from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol
from zoneinfo import ZoneInfo

import requests

from src.config.settings import settings
from src.utils.logging import get_logger
from src.utils.team_names import normalizer

logger = get_logger(__name__)

TOURNAMENT_FIELD_TEAMS = {
    "Duke",
    "Siena",
    "Ohio St.",
    "TCU",
    "St. John's",
    "Northern Iowa",
    "Kansas",
    "Cal Baptist",
    "Louisville",
    "South Florida",
    "Michigan St.",
    "North Dakota St.",
    "UCLA",
    "UCF",
    "UConn",
    "Furman",
    "Florida",
    "Clemson",
    "Iowa",
    "Vanderbilt",
    "McNeese",
    "Nebraska",
    "Troy",
    "North Carolina",
    "VCU",
    "Illinois",
    "Penn",
    "Saint Mary's",
    "Texas A&M",
    "Houston",
    "Idaho",
    "Arizona",
    "Long Island",
    "Villanova",
    "Utah St.",
    "Wisconsin",
    "High Point",
    "Arkansas",
    "Hawaii",
    "BYU",
    "Gonzaga",
    "Kennesaw St.",
    "Miami (FL)",
    "Missouri",
    "Purdue",
    "Queens (N.C.)",
    "Michigan",
    "Georgia",
    "Saint Louis",
    "Texas Tech",
    "Akron",
    "Alabama",
    "Hofstra",
    "Tennessee",
    "Virginia",
    "Wright St.",
    "Kentucky",
    "Santa Clara",
    "Iowa St.",
    "Tennessee St.",
    "Howard",
    "UMBC",
    "Texas",
    "NC State",
    "Prairie View A&M",
    "Lehigh",
    "Miami (Ohio)",
    "SMU",
}
TOURNAMENT_FIELD_KEYS = {normalizer.resolve(team_name) for team_name in TOURNAMENT_FIELD_TEAMS}


def _iso_now() -> str:
    return datetime.now(tz=UTC).isoformat()


def _safe_int(value: object) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _canonical_team_display(value: str) -> str:
    return normalizer.display_name(value)


def _is_tournament_team(value: str) -> bool:
    return bool(value) and normalizer.resolve(value) in TOURNAMENT_FIELD_KEYS


def _period_label(period: int | None) -> str:
    if period is None:
        return ""
    if period == 1:
        return "1H"
    if period == 2:
        return "2H"
    if period == 3:
        return "OT"
    if period > 3:
        return f"{period - 2}OT"
    return ""


def _status_from_competition(status_block: dict[str, Any]) -> tuple[str, str, str | None, str | None]:
    status_type = status_block.get("type", {}) if isinstance(status_block, dict) else {}
    state = str(status_type.get("state", "")).lower()
    clock = str(status_block.get("displayClock", "")).strip() or None
    period = _period_label(_safe_int(status_block.get("period")))

    if state == "post":
        return "final", "FINAL", None, None
    if state == "in":
        detail = " ".join(part for part in [period, clock] if part).strip() or str(status_type.get("shortDetail", "")).strip()
        return "live", "LIVE", detail or None, period or None
    return "upcoming", "UPCOMING", None, period or None


@dataclass
class LiveGame:
    gameId: str
    teamA: str
    teamB: str
    teamAKey: str
    teamBKey: str
    scoreA: int | None
    scoreB: int | None
    status: str
    statusLabel: str
    detail: str | None
    clock: str | None
    period: str | None
    startTime: str | None
    winner: str | None
    winnerKey: str | None
    source: str
    round: str | None = None
    region: str | None = None
    seedA: str | None = None
    seedB: str | None = None


class LiveGameProvider(Protocol):
    source_name: str

    def fetch_games(self) -> list[LiveGame]:
        ...


MOCK_PROVIDER_SNAPSHOTS: list[list[LiveGame]] = [
    [
        LiveGame(
            gameId="ff_midwest_16",
            teamA="Howard",
            teamB="UMBC",
            teamAKey=normalizer.resolve("Howard"),
            teamBKey=normalizer.resolve("UMBC"),
            scoreA=34,
            scoreB=29,
            status="live",
            statusLabel="LIVE",
            detail="2H 12:14",
            clock="12:14",
            period="2H",
            startTime=None,
            winner=None,
            winnerKey=None,
            source="mock",
        ),
        LiveGame(
            gameId="ff_west_11",
            teamA="Texas",
            teamB="NC State",
            teamAKey=normalizer.resolve("Texas"),
            teamBKey=normalizer.resolve("NC State"),
            scoreA=71,
            scoreB=66,
            status="final",
            statusLabel="FINAL",
            detail=None,
            clock=None,
            period=None,
            startTime=None,
            winner="Texas",
            winnerKey=normalizer.resolve("Texas"),
            source="mock",
        ),
        LiveGame(
            gameId="east_r1_2",
            teamA="Ohio St.",
            teamB="TCU",
            teamAKey=normalizer.resolve("Ohio St."),
            teamBKey=normalizer.resolve("TCU"),
            scoreA=26,
            scoreB=22,
            status="live",
            statusLabel="LIVE",
            detail="1H 08:42",
            clock="08:42",
            period="1H",
            startTime=None,
            winner=None,
            winnerKey=None,
            source="mock",
        ),
        LiveGame(
            gameId="south_r1_4",
            teamA="Nebraska",
            teamB="Troy",
            teamAKey=normalizer.resolve("Nebraska"),
            teamBKey=normalizer.resolve("Troy"),
            scoreA=None,
            scoreB=None,
            status="upcoming",
            statusLabel="UPCOMING",
            detail=None,
            clock=None,
            period=None,
            startTime="2026-03-21T15:15:00-05:00",
            winner=None,
            winnerKey=None,
            source="mock",
        ),
    ],
    [
        LiveGame(
            gameId="ff_midwest_16",
            teamA="Howard",
            teamB="UMBC",
            teamAKey=normalizer.resolve("Howard"),
            teamBKey=normalizer.resolve("UMBC"),
            scoreA=71,
            scoreB=66,
            status="final",
            statusLabel="FINAL",
            detail=None,
            clock=None,
            period=None,
            startTime=None,
            winner="Howard",
            winnerKey=normalizer.resolve("Howard"),
            source="mock",
        ),
        LiveGame(
            gameId="east_r1_2",
            teamA="Ohio St.",
            teamB="TCU",
            teamAKey=normalizer.resolve("Ohio St."),
            teamBKey=normalizer.resolve("TCU"),
            scoreA=71,
            scoreB=66,
            status="final",
            statusLabel="FINAL",
            detail=None,
            clock=None,
            period=None,
            startTime=None,
            winner="Ohio St.",
            winnerKey=normalizer.resolve("Ohio St."),
            source="mock",
        ),
        LiveGame(
            gameId="south_r1_4",
            teamA="Nebraska",
            teamB="Troy",
            teamAKey=normalizer.resolve("Nebraska"),
            teamBKey=normalizer.resolve("Troy"),
            scoreA=58,
            scoreB=54,
            status="live",
            statusLabel="LIVE",
            detail="2H 05:51",
            clock="05:51",
            period="2H",
            startTime=None,
            winner=None,
            winnerKey=None,
            source="mock",
        ),
        LiveGame(
            gameId="west_r1_1",
            teamA="Arizona",
            teamB="Long Island",
            teamAKey=normalizer.resolve("Arizona"),
            teamBKey=normalizer.resolve("Long Island"),
            scoreA=None,
            scoreB=None,
            status="upcoming",
            statusLabel="UPCOMING",
            detail=None,
            clock=None,
            period=None,
            startTime="2026-03-21T16:10:00-05:00",
            winner=None,
            winnerKey=None,
            source="mock",
        ),
    ],
]


class MockLiveGameProvider:
    source_name = "mock"

    def fetch_games(self) -> list[LiveGame]:
        snapshot_index = int(datetime.now(tz=UTC).timestamp() // 30) % len(MOCK_PROVIDER_SNAPSHOTS)
        return MOCK_PROVIDER_SNAPSHOTS[snapshot_index]


class EspnLiveGameProvider:
    source_name = "espn"

    def __init__(self, session: requests.Session | None = None) -> None:
        self.session = session or requests.Session()

    def fetch_games(self) -> list[LiveGame]:
        events = self._fetch_scoreboard_events()
        games: list[LiveGame] = []
        seen_game_ids: set[str] = set()
        for event in events:
            game = self._normalize_event(event)
            if game and game.gameId not in seen_game_ids:
                games.append(game)
                seen_game_ids.add(game.gameId)
        return games

    def _fetch_scoreboard_events(self) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []
        seen_event_ids: set[str] = set()
        local_now = datetime.now(tz=ZoneInfo(settings.espn_schedule_timezone))
        start_offset = -max(settings.espn_schedule_days_back, 0)
        end_offset = max(settings.espn_schedule_days_ahead - 1, 0)

        for day_offset in range(start_offset, end_offset + 1):
            target_date = local_now.date() + timedelta(days=day_offset)
            response = self.session.get(
                settings.espn_scoreboard_url,
                params={
                    "limit": 200,
                    "groups": 50,
                    "dates": target_date.strftime("%Y%m%d"),
                },
                timeout=settings.live_request_timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            daily_events = payload.get("events", []) if isinstance(payload, dict) else []
            for event in daily_events:
                event_id = str(event.get("id") or "")
                if event_id and event_id in seen_event_ids:
                    continue
                if event_id:
                    seen_event_ids.add(event_id)
                events.append(event)

        return events

    def _normalize_event(self, event: dict[str, Any]) -> LiveGame | None:
        competition = ((event.get("competitions") or [None])[0]) or {}
        competitors = competition.get("competitors") or []
        if len(competitors) < 2:
            return None

        ordered = sorted(
            competitors,
            key=lambda item: 0 if str(item.get("homeAway", "")).lower() == "home" else 1,
        )
        team_a, team_b = ordered[0], ordered[1]
        team_a_name = str((team_a.get("team") or {}).get("shortDisplayName") or (team_a.get("team") or {}).get("displayName") or "").strip()
        team_b_name = str((team_b.get("team") or {}).get("shortDisplayName") or (team_b.get("team") or {}).get("displayName") or "").strip()
        if not team_a_name or not team_b_name:
            return None
        if not (_is_tournament_team(team_a_name) and _is_tournament_team(team_b_name)):
            return None

        status, status_label, detail, period = _status_from_competition(competition.get("status", {}))
        score_a = _safe_int(team_a.get("score"))
        score_b = _safe_int(team_b.get("score"))
        winner_name = None
        winner_key = None
        if status == "final":
            winner_competitor = next((competitor for competitor in ordered if competitor.get("winner")), None)
            if winner_competitor:
                winner_name = _canonical_team_display(
                    str((winner_competitor.get("team") or {}).get("shortDisplayName") or (winner_competitor.get("team") or {}).get("displayName") or "")
                )
                winner_key = normalizer.resolve(winner_name)

        return LiveGame(
            gameId=str(event.get("id") or competition.get("id") or f"{team_a_name}-{team_b_name}"),
            teamA=_canonical_team_display(team_a_name),
            teamB=_canonical_team_display(team_b_name),
            teamAKey=normalizer.resolve(team_a_name),
            teamBKey=normalizer.resolve(team_b_name),
            scoreA=score_a,
            scoreB=score_b,
            status=status,
            statusLabel=status_label,
            detail=detail,
            clock=str((competition.get("status") or {}).get("displayClock") or "").strip() or None,
            period=period,
            startTime=str(competition.get("date") or event.get("date") or "").strip() or None,
            winner=winner_name,
            winnerKey=winner_key,
            source="espn",
            seedA=str(team_a.get("seed") or "") or None,
            seedB=str(team_b.get("seed") or "") or None,
        )


class LiveBracketService:
    def __init__(self, provider: LiveGameProvider | None = None) -> None:
        self.provider = provider or build_live_game_provider()

    def get_live_scoreboard(self) -> dict[str, Any]:
        games = self.provider.fetch_games()
        return {
            "provider": self.provider.source_name,
            "fetchedAt": _iso_now(),
            "games": [asdict(game) for game in games],
        }


def build_live_game_provider(mode: str | None = None) -> LiveGameProvider:
    chosen_mode = (mode or settings.live_provider or "mock").strip().lower()
    if chosen_mode == "espn":
        return EspnLiveGameProvider()
    return MockLiveGameProvider()


def get_live_scoreboard(mode: str | None = None) -> dict[str, Any]:
    chosen_mode = (mode or settings.live_provider or "mock").strip().lower()
    provider = build_live_game_provider(chosen_mode)
    try:
        return LiveBracketService(provider=provider).get_live_scoreboard()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Live provider %s failed: %s", chosen_mode, exc)
        fallback = MockLiveGameProvider()
        payload = LiveBracketService(provider=fallback).get_live_scoreboard()
        payload["provider"] = chosen_mode
        payload["fallbackProvider"] = fallback.source_name
        payload["error"] = str(exc)
        return payload
