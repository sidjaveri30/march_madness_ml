from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

from src.data_sources.odds_provider import OddsProvider
from src.models.predictor import MatchupPredictor, PredictionResult
from src.utils.odds_math import (
    average_number,
    average_moneyline,
    build_market_interpretation,
    categorize_probability_edge,
    describe_spread_difference,
    no_vig_two_way_probabilities,
    spread_interpretation,
)
from src.utils.team_names import canonicalize_name, normalizer

BOOK_PRIORITY = {
    "draftkings": 0,
    "fanduel": 1,
    "betmgm": 2,
    "caesars": 3,
}


@dataclass
class OddsService:
    provider: OddsProvider
    predictor: MatchupPredictor

    def __init__(self, provider: OddsProvider | None = None, predictor: MatchupPredictor | None = None) -> None:
        self.provider = provider or OddsProvider()
        self.predictor = predictor or MatchupPredictor()
        self._known_teams = {normalizer.resolve(team): team for team in self.predictor.list_teams()}

    def _candidate_team_keys(self, name: str) -> list[str]:
        raw = canonicalize_name(name)
        candidates: list[str] = []
        for base in [raw, normalizer.resolve(name)]:
            if base and base not in candidates:
                candidates.append(base)
            tokens = base.split()
            for size in range(len(tokens) - 1, 0, -1):
                candidate = normalizer.resolve(" ".join(tokens[:size]))
                if candidate and candidate not in candidates:
                    candidates.append(candidate)
        return candidates

    def _resolve_market_team(self, name: str) -> str:
        candidates = self._candidate_team_keys(name)
        for candidate in candidates:
            if candidate in self._known_teams:
                return candidate

        best_match = None
        best_score = 0.0
        for known in self._known_teams:
            known_tokens = set(known.split())
            for candidate in candidates:
                candidate_tokens = set(candidate.split())
                score = SequenceMatcher(None, candidate, known).ratio()
                if candidate.startswith(known) or known.startswith(candidate):
                    score += 0.2
                if candidate_tokens and known_tokens:
                    score += 0.15 * (len(candidate_tokens & known_tokens) / max(len(candidate_tokens), len(known_tokens)))
                if score > best_score:
                    best_match = known
                    best_score = score
        return best_match if best_match and best_score >= 0.6 else candidates[0]

    def _match_event(self, events: list[dict[str, Any]], team_a: str, team_b: str) -> dict[str, Any] | None:
        requested = sorted([normalizer.resolve(team_a), normalizer.resolve(team_b)])
        for event in events:
            event_names = sorted(
                [
                    self._resolve_market_team(str(event.get("home_team", ""))),
                    self._resolve_market_team(str(event.get("away_team", ""))),
                ]
            )
            if event_names == requested:
                return event
        return None

    def _market_outcomes(self, bookmaker: dict[str, Any], market_key: str) -> list[dict[str, Any]]:
        for market in bookmaker.get("markets", []):
            if market.get("key") == market_key:
                return market.get("outcomes", [])
        return []

    def _team_outcome(self, outcomes: list[dict[str, Any]], team_name: str) -> dict[str, Any] | None:
        requested = normalizer.resolve(team_name)
        for outcome in outcomes:
            outcome_name = self._resolve_market_team(str(outcome.get("name", "")))
            if outcome_name == requested:
                return outcome
        return None

    def _parse_bookmaker(self, bookmaker: dict[str, Any], team_a: str, team_b: str) -> dict[str, Any]:
        moneyline_outcomes = self._market_outcomes(bookmaker, "h2h")
        spread_outcomes = self._market_outcomes(bookmaker, "spreads")
        total_outcomes = self._market_outcomes(bookmaker, "totals")

        moneyline_a = self._team_outcome(moneyline_outcomes, team_a)
        moneyline_b = self._team_outcome(moneyline_outcomes, team_b)
        spread_a = self._team_outcome(spread_outcomes, team_a)
        spread_b = self._team_outcome(spread_outcomes, team_b)
        fair_a, fair_b = no_vig_two_way_probabilities(
            None if moneyline_a is None else moneyline_a.get("price"),
            None if moneyline_b is None else moneyline_b.get("price"),
        )

        total_over = next((outcome for outcome in total_outcomes if canonicalize_name(str(outcome.get("name", ""))) == "over"), None)
        total_under = next((outcome for outcome in total_outcomes if canonicalize_name(str(outcome.get("name", ""))) == "under"), None)

        return {
            "key": bookmaker.get("key"),
            "title": bookmaker.get("title"),
            "last_update": bookmaker.get("last_update"),
            "moneyline": None
            if moneyline_a is None or moneyline_b is None
            else {
                "team_a_price": moneyline_a.get("price"),
                "team_b_price": moneyline_b.get("price"),
                "team_a_implied_prob": fair_a,
                "team_b_implied_prob": fair_b,
            },
            "spread": None
            if spread_a is None or spread_b is None
            else {
                "team_a_line": spread_a.get("point"),
                "team_a_price": spread_a.get("price"),
                "team_b_line": spread_b.get("point"),
                "team_b_price": spread_b.get("price"),
            },
            "total": None
            if total_over is None or total_under is None
            else {
                "points": total_over.get("point"),
                "over_price": total_over.get("price"),
                "under_price": total_under.get("price"),
            },
        }

    def _consensus(self, bookmakers: list[dict[str, Any]]) -> dict[str, Any]:
        moneyline_a_prices = [book["moneyline"]["team_a_price"] for book in bookmakers if book.get("moneyline")]
        moneyline_b_prices = [book["moneyline"]["team_b_price"] for book in bookmakers if book.get("moneyline")]
        team_a_probs = [book["moneyline"]["team_a_implied_prob"] for book in bookmakers if book.get("moneyline")]
        team_b_probs = [book["moneyline"]["team_b_implied_prob"] for book in bookmakers if book.get("moneyline")]
        spreads = [book["spread"]["team_a_line"] for book in bookmakers if book.get("spread")]
        totals = [book["total"]["points"] for book in bookmakers if book.get("total")]
        last_updated = max((book["last_update"] for book in bookmakers if book.get("last_update")), default=None)
        return {
            "team_a_moneyline_avg": average_moneyline(moneyline_a_prices),
            "team_b_moneyline_avg": average_moneyline(moneyline_b_prices),
            "team_a_implied_prob_avg": average_number(team_a_probs),
            "team_b_implied_prob_avg": average_number(team_b_probs),
            "spread_avg": average_number(spreads),
            "total_avg": average_number(totals),
            "last_updated": last_updated,
        }

    def _model_vs_market(self, prediction: PredictionResult, consensus: dict[str, Any], team_a: str, team_b: str) -> dict[str, Any]:
        market_prob = consensus.get("team_a_implied_prob_avg")
        moneyline_edge = None if market_prob is None else prediction.win_probability_team_a - market_prob
        spread_edge = None if consensus.get("spread_avg") is None or prediction.predicted_margin is None else prediction.predicted_margin - consensus["spread_avg"]
        edge_label = categorize_probability_edge(moneyline_edge)
        edge_team = None
        if moneyline_edge is not None and abs(moneyline_edge) >= 0.02:
            edge_team = team_a if moneyline_edge > 0 else team_b
        spread_summary = spread_interpretation(prediction.predicted_margin, consensus.get("spread_avg"), team_a, team_b)
        spread_difference_summary = describe_spread_difference(prediction.predicted_margin, consensus.get("spread_avg"), team_a, team_b)
        return {
            "model_win_prob_team_a": prediction.win_probability_team_a,
            "market_implied_prob_team_a": market_prob,
            "moneyline_edge_team_a": moneyline_edge,
            "moneyline_edge_points": None if moneyline_edge is None else moneyline_edge * 100,
            "model_margin_team_a": prediction.predicted_margin,
            "market_spread_team_a": consensus.get("spread_avg"),
            "spread_edge_team_a": spread_edge,
            "spread_edge_points": spread_edge,
            "edge_label": edge_label,
            "spread_summary": spread_summary,
            "spread_difference_summary": spread_difference_summary,
            "interpretation": build_market_interpretation(edge_label, edge_team, spread_summary),
        }

    def get_matchup_odds(
        self,
        team_a: str,
        team_b: str,
        prediction: PredictionResult | None = None,
    ) -> dict[str, Any]:
        if "/" in team_a or "/" in team_b:
            return {
                "team_a": team_a,
                "team_b": team_b,
                "event_found": False,
                "bookmakers": [],
                "consensus": {},
                "model_vs_market": None,
                "available_bookmakers": [],
                "last_updated": None,
                "message": "Market lines are unavailable for unresolved play-in placeholders.",
            }

        events = self.provider.fetch_events()
        event = self._match_event(events, team_a, team_b)
        if event is None:
            return {
                "team_a": team_a,
                "team_b": team_b,
                "event_found": False,
                "bookmakers": [],
                "consensus": {},
                "model_vs_market": None,
                "available_bookmakers": [],
                "last_updated": None,
                "message": "No market lines currently available for this matchup.",
            }

        bookmakers = [self._parse_bookmaker(bookmaker, team_a, team_b) for bookmaker in event.get("bookmakers", [])]
        bookmakers.sort(key=lambda book: BOOK_PRIORITY.get(str(book.get("key")), 99))
        consensus = self._consensus(bookmakers)
        prediction = prediction or self.predictor.predict(team_a, team_b, neutral_site=True)
        return {
            "team_a": team_a,
            "team_b": team_b,
            "event_found": True,
            "event_id": event.get("id"),
            "commence_time": event.get("commence_time"),
            "bookmakers": bookmakers,
            "available_bookmakers": [book.get("title") for book in bookmakers if book.get("title")],
            "consensus": consensus,
            "last_updated": consensus.get("last_updated"),
            "model_vs_market": self._model_vs_market(prediction, consensus, team_a, team_b),
            "message": None,
        }
