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
