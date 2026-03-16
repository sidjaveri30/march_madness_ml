from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

import src.api.app as api_module
from src.models.predictor import PredictionResult
from src.services.odds_service import OddsService


class FakePredictor:
    def list_teams(self):
        return ["Duke", "Vanderbilt", "Miami (Ohio)", "SMU", "BYU", "NC State", "Texas", "Siena"]

    def predict(self, team_a: str, team_b: str, neutral_site: bool = True):
        return PredictionResult(
            team_a=team_a,
            team_b=team_b,
            predicted_winner=team_a,
            win_probability_team_a=0.712,
            win_probability_team_b=0.288,
            predicted_margin=7.8,
            top_reasons=["Duke owns the stronger adjusted efficiency margin."],
            feature_snapshot={"adjem_diff": 18.1},
        )


class FakeOddsProvider:
    def __init__(self, payload):
        self.payload = payload

    def fetch_events(self, force: bool = False):
        return self.payload


SAMPLE_EVENTS = [
    {
        "id": "duke-siena",
        "home_team": "Duke Blue Devils",
        "away_team": "Siena Saints",
        "bookmakers": [
            {
                "key": "fanduel",
                "title": "FanDuel",
                "last_update": "2026-03-15T12:00:00Z",
                "markets": [
                    {"key": "h2h", "outcomes": [{"name": "Duke Blue Devils", "price": -30000}, {"name": "Siena Saints", "price": 5000}]},
                    {"key": "spreads", "outcomes": [{"name": "Duke Blue Devils", "price": -110, "point": -29.5}, {"name": "Siena Saints", "price": -110, "point": 29.5}]},
                ],
            }
        ],
    },
    {
        "id": "duke-vandy",
        "home_team": "Vanderbilt",
        "away_team": "Duke",
        "bookmakers": [
            {
                "key": "fanduel",
                "title": "FanDuel",
                "last_update": "2026-03-15T12:00:00Z",
                "markets": [
                    {"key": "h2h", "outcomes": [{"name": "Duke", "price": -170}, {"name": "Vanderbilt", "price": 145}]},
                    {"key": "spreads", "outcomes": [{"name": "Duke", "price": -110, "point": -4.5}, {"name": "Vanderbilt", "price": -110, "point": 4.5}]},
                ],
            },
            {
                "key": "draftkings",
                "title": "DraftKings",
                "last_update": "2026-03-15T12:05:00Z",
                "markets": [
                    {"key": "h2h", "outcomes": [{"name": "Duke", "price": -180}, {"name": "Vanderbilt", "price": 150}]},
                    {"key": "spreads", "outcomes": [{"name": "Duke", "price": -110, "point": -5.0}, {"name": "Vanderbilt", "price": -110, "point": 5.0}]},
                    {"key": "totals", "outcomes": [{"name": "Over", "price": -110, "point": 145.5}, {"name": "Under", "price": -110, "point": 145.5}]},
                ],
            },
        ],
    }
]


class OddsServiceTests(unittest.TestCase):
    def test_service_parses_bookmakers_and_consensus(self):
        service = OddsService(provider=FakeOddsProvider(SAMPLE_EVENTS), predictor=FakePredictor())
        payload = service.get_matchup_odds("Duke", "Vanderbilt")

        self.assertTrue(payload["event_found"])
        self.assertEqual(payload["bookmakers"][0]["title"], "DraftKings")
        self.assertEqual(payload["bookmakers"][1]["title"], "FanDuel")
        self.assertIsNotNone(payload["consensus"]["team_a_implied_prob_avg"])
        self.assertIn("interpretation", payload["model_vs_market"])

    def test_service_matches_team_names_robustly(self):
        service = OddsService(provider=FakeOddsProvider(SAMPLE_EVENTS), predictor=FakePredictor())
        duke_vandy = service.get_matchup_odds("Duke", "Vanderbilt")
        duke_siena = service.get_matchup_odds("Duke", "Siena")
        self.assertEqual(duke_vandy["event_id"], "duke-vandy")
        self.assertEqual(duke_siena["event_id"], "duke-siena")

    def test_service_handles_missing_odds_and_placeholder_matchups(self):
        service = OddsService(provider=FakeOddsProvider([]), predictor=FakePredictor())
        missing = service.get_matchup_odds("Duke", "Vanderbilt")
        placeholder = service.get_matchup_odds("Texas / NC State", "BYU")

        self.assertFalse(missing["event_found"])
        self.assertIn("No market lines", missing["message"])
        self.assertFalse(placeholder["event_found"])
        self.assertIn("play-in", placeholder["message"].lower())

    def test_odds_endpoint_returns_market_context(self):
        previous_predictor = api_module.predictor
        previous_odds_service = api_module.odds_service
        api_module.predictor = FakePredictor()
        api_module.odds_service = OddsService(provider=FakeOddsProvider(SAMPLE_EVENTS), predictor=api_module.predictor)
        client = TestClient(api_module.app)
        try:
            response = client.get("/odds", params={"team_a": "Duke", "team_b": "Vanderbilt"})
        finally:
            api_module.predictor = previous_predictor
            api_module.odds_service = previous_odds_service

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["event_found"])
        self.assertEqual(payload["bookmakers"][0]["title"], "DraftKings")


if __name__ == "__main__":
    unittest.main()
