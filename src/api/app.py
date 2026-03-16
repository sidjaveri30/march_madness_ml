from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.api.schemas import MessageResponse, OddsQueryResponse, PredictRequest, PredictResponse
from src.config.settings import settings
from src.models.predictor import MatchupPredictor
from src.services.odds_service import OddsService
from src.utils.logging import get_logger

logger = get_logger(__name__)

predictor: MatchupPredictor | None = None
odds_service: OddsService | None = None


def _ensure_predictor() -> MatchupPredictor:
    global predictor
    if predictor is None:
        try:
            predictor = MatchupPredictor()
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=409,
                detail="Model artifacts not found. Run /train after refreshing data.",
            ) from exc
    return predictor


def _ensure_odds_service() -> OddsService:
    global odds_service
    loaded_predictor = _ensure_predictor()
    if odds_service is None or odds_service.predictor is not loaded_predictor:
        odds_service = OddsService(predictor=loaded_predictor)
    return odds_service


@asynccontextmanager
async def lifespan(_: FastAPI):
    global predictor, odds_service
    try:
        predictor = MatchupPredictor()
        odds_service = OddsService(predictor=predictor)
    except Exception as exc:  # noqa: BLE001
        logger.info("Predictor not loaded at startup: %s", exc)
    yield


app = FastAPI(title="March Madness ML", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/teams")
def teams() -> dict[str, list[str]]:
    loaded = _ensure_predictor()
    return {"teams": loaded.list_teams()}


@app.get("/teams/ranked")
def ranked_teams() -> dict[str, list[dict[str, object]]]:
    loaded = _ensure_predictor()
    return {"teams": loaded.list_ranked_teams()}


@app.get("/teams/search")
def team_search(q: str = "") -> dict[str, object]:
    loaded = _ensure_predictor()
    return loaded.search_teams(q)


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    loaded = _ensure_predictor()
    if payload.team_a == payload.team_b:
        raise HTTPException(status_code=400, detail="Choose two different teams.")
    try:
        result = loaded.predict(payload.team_a, payload.team_b, neutral_site=payload.neutral_site)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return PredictResponse(**result.__dict__)


@app.get("/odds", response_model=OddsQueryResponse)
def odds(team_a: str, team_b: str) -> OddsQueryResponse:
    service = _ensure_odds_service()
    prediction = None
    if "/" not in team_a and "/" not in team_b:
        try:
            prediction = _ensure_predictor().predict(team_a, team_b, neutral_site=True)
        except ValueError:
            prediction = None
    return OddsQueryResponse(**service.get_matchup_odds(team_a, team_b, prediction=prediction))


@app.post("/refresh-data", response_model=MessageResponse)
def refresh_data() -> MessageResponse:
    from src.ingestion.pipeline import refresh_all_data

    metadata = refresh_all_data(force=True)
    return MessageResponse(message="Data refresh complete", details=metadata)


@app.post("/train", response_model=MessageResponse)
def train() -> MessageResponse:
    from src.models.training import train_all_models

    global predictor, odds_service
    summary = train_all_models()
    predictor = MatchupPredictor()
    odds_service = OddsService(predictor=predictor)
    return MessageResponse(message="Training complete", details={k: str(v) for k, v in summary.__dict__.items()})
