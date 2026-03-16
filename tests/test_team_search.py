from __future__ import annotations

import unittest

import pandas as pd
from fastapi.testclient import TestClient

import src.api.app as api_module
from src.models.predictor import MatchupPredictor


class DummyClassifier:
    def predict_proba(self, X):  # pragma: no cover
        raise NotImplementedError


class DummyRegressor:
    def predict(self, X):  # pragma: no cover
        raise NotImplementedError


def make_predictor() -> MatchupPredictor:
    team_profiles = pd.DataFrame(
        [
            {"team": "Duke", "display_name": "Duke", "team_normalized": "duke"},
            {"team": "Drake", "display_name": "Drake", "team_normalized": "drake"},
            {"team": "Duquesne", "display_name": "Duquesne", "team_normalized": "duquesne"},
            {"team": "Gonzaga", "display_name": "Gonzaga", "team_normalized": "gonzaga"},
            {"team": "Vanderbilt", "display_name": "Vanderbilt", "team_normalized": "vanderbilt"},
        ]
    )
    return MatchupPredictor(
        classifier=DummyClassifier(),
        margin_regressor=DummyRegressor(),
        feature_columns=["neutral_site"],
        team_profiles=team_profiles,
    )


class TeamSearchTests(unittest.TestCase):
    def test_search_returns_prefix_and_exact_matches_first(self):
        predictor = make_predictor()
        results = predictor.search_teams("duk")

        self.assertIn("Duke", results["matches"])
        self.assertEqual(results["matches"][0], "Duke")

    def test_search_returns_fuzzy_typo_suggestion(self):
        predictor = make_predictor()
        results = predictor.search_teams("Gonzgaa")

        self.assertEqual(results["strong_match"], "Gonzaga")
        self.assertIn("Gonzaga", results["matches"])

    def test_search_endpoint_returns_matches(self):
        predictor = make_predictor()
        previous_predictor = api_module.predictor
        api_module.predictor = predictor
        client = TestClient(api_module.app)
        try:
            response = client.get("/teams/search", params={"q": "duk"})
        finally:
            api_module.predictor = previous_predictor

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["matches"][0], "Duke")


if __name__ == "__main__":
    unittest.main()
