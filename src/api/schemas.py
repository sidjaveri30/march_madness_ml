from __future__ import annotations

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    team_a: str = Field(..., min_length=1)
    team_b: str = Field(..., min_length=1)
    neutral_site: bool = True


class PredictResponse(BaseModel):
    team_a: str
    team_b: str
    predicted_winner: str
    win_probability_team_a: float
    win_probability_team_b: float
    predicted_margin: float | None = None
    top_reasons: list[str]
    feature_snapshot: dict[str, float]


class MessageResponse(BaseModel):
    message: str
    details: dict[str, str] | None = None


class OddsQueryResponse(BaseModel):
    team_a: str
    team_b: str
    event_found: bool
    bookmakers: list[dict[str, object]]
    consensus: dict[str, float | str | None]
    available_bookmakers: list[str] = []
    last_updated: str | None = None
    model_vs_market: dict[str, object] | None = None
    message: str | None = None


class LiveGameResponse(BaseModel):
    gameId: str
    teamA: str
    teamB: str
    teamAKey: str
    teamBKey: str
    scoreA: int | None = None
    scoreB: int | None = None
    status: str
    statusLabel: str
    detail: str | None = None
    clock: str | None = None
    period: str | None = None
    startTime: str | None = None
    winner: str | None = None
    winnerKey: str | None = None
    source: str
    round: str | None = None
    region: str | None = None
    seedA: str | None = None
    seedB: str | None = None


class LiveScoreboardResponse(BaseModel):
    provider: str
    fetchedAt: str
    fallbackProvider: str | None = None
    error: str | None = None
    games: list[LiveGameResponse]
