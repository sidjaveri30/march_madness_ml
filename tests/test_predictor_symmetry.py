from __future__ import annotations

import math
import unittest

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

import src.api.app as api_module
from src.models.predictor import MatchupPredictor


class FakeClassifier:
    def predict_proba(self, X: pd.DataFrame):
        probs = []
        for row in X.to_dict(orient="records"):
            score = (
                0.8 * row.get("adjem_diff", 0.0)
                + 0.4 * row.get("recent_win_pct_5_diff", 0.0)
                + 0.2 * row.get("adjem", 0.0)
                - 0.1 * row.get("opp_adjem", 0.0)
                + 0.15 * row.get("is_home", 0.0)
            )
            prob = 1.0 / (1.0 + math.exp(-score / 10))
            probs.append([1 - prob, prob])
        return np.array(probs)


class FakeRegressor:
    def predict(self, X: pd.DataFrame):
        margins = []
        for row in X.to_dict(orient="records"):
            margin = (
                1.5 * row.get("adjem_diff", 0.0)
                + 0.8 * row.get("recent_win_pct_5_diff", 0.0)
                + 0.4 * row.get("adjem", 0.0)
                + 1.2 * row.get("is_home", 0.0)
            )
            margins.append(margin)
        return margins


def make_predictor() -> MatchupPredictor:
    team_profiles = pd.DataFrame(
        [
            {
                "team": "Duke",
                "display_name": "Duke",
                "team_normalized": "duke blue devils",
                "adjem": 36.0,
                "recent_win_pct_5": 1.0,
                "win_pct_pre": 0.88,
                "avg_margin_pre": 16.0,
                "season_off_eff_proxy": 56.0,
                "season_def_eff_proxy": 44.0,
            },
            {
                "team": "Vanderbilt",
                "display_name": "Vanderbilt",
                "team_normalized": "vanderbilt commodores",
                "adjem": 20.0,
                "recent_win_pct_5": 0.6,
                "win_pct_pre": 0.68,
                "avg_margin_pre": 6.0,
                "season_off_eff_proxy": 52.0,
                "season_def_eff_proxy": 48.0,
            },
        ]
    )
    feature_columns = [
        "neutral_site",
        "is_home",
        "is_away",
        "adjem",
        "opp_adjem",
        "adjem_diff",
        "recent_win_pct_5",
        "opp_recent_win_pct_5",
        "recent_win_pct_5_diff",
        "win_pct_pre",
        "opp_win_pct_pre",
        "win_pct_pre_diff",
        "avg_margin_pre",
        "opp_avg_margin_pre",
        "avg_margin_pre_diff",
        "season_off_eff_proxy",
        "opp_season_off_eff_proxy",
        "season_off_eff_proxy_diff",
        "season_def_eff_proxy",
        "opp_season_def_eff_proxy",
        "season_def_eff_proxy_diff",
    ]
    return MatchupPredictor(
        classifier=FakeClassifier(),
        margin_regressor=FakeRegressor(),
        feature_columns=feature_columns,
        team_profiles=team_profiles,
    )


class PredictorSymmetryTests(unittest.TestCase):
    def test_feature_construction_swaps_cleanly_for_neutral_site(self):
        predictor = make_predictor()
        ab = predictor._build_feature_row("Duke", "Vanderbilt", neutral_site=True).iloc[0]
        ba = predictor._build_feature_row("Vanderbilt", "Duke", neutral_site=True).iloc[0]

        self.assertEqual(ab["neutral_site"], 1)
        self.assertEqual(ab["is_home"], 0)
        self.assertEqual(ab["is_away"], 0)
        self.assertEqual(ba["neutral_site"], 1)
        self.assertEqual(ba["is_home"], 0)
        self.assertEqual(ba["is_away"], 0)
        self.assertEqual(ab["adjem"], ba["opp_adjem"])
        self.assertEqual(ab["opp_adjem"], ba["adjem"])
        self.assertEqual(ab["adjem_diff"], -ba["adjem_diff"])
        self.assertEqual(ab["recent_win_pct_5_diff"], -ba["recent_win_pct_5_diff"])

    def test_neutral_site_predictions_are_symmetric(self):
        predictor = make_predictor()
        ab = predictor.predict("Duke", "Vanderbilt", neutral_site=True)
        ba = predictor.predict("Vanderbilt", "Duke", neutral_site=True)

        self.assertEqual(ab.predicted_winner, "Duke")
        self.assertEqual(ba.predicted_winner, "Duke")
        self.assertAlmostEqual(ab.win_probability_team_a, ba.win_probability_team_b, places=12)
        self.assertAlmostEqual(ab.win_probability_team_b, ba.win_probability_team_a, places=12)
        self.assertAlmostEqual(ab.predicted_margin + ba.predicted_margin, 0.0, places=12)
        self.assertAlmostEqual(abs(ab.predicted_margin), abs(ba.predicted_margin), places=12)
        self.assertTrue(any("Duke" in reason for reason in ab.top_reasons))
        self.assertTrue(any("Duke" in reason for reason in ba.top_reasons))

    def test_non_neutral_predictions_can_differ_by_order(self):
        predictor = make_predictor()
        ab = predictor.predict("Duke", "Vanderbilt", neutral_site=False)
        ba = predictor.predict("Vanderbilt", "Duke", neutral_site=False)

        self.assertGreater(abs(ab.win_probability_team_a - ba.win_probability_team_b), 1e-6)

    def test_predict_api_preserves_neutral_site_symmetry(self):
        predictor = make_predictor()
        previous_predictor = api_module.predictor
        api_module.predictor = predictor
        client = TestClient(api_module.app)
        try:
            ab = client.post(
                "/predict",
                json={"team_a": "Duke", "team_b": "Vanderbilt", "neutral_site": True},
            )
            ba = client.post(
                "/predict",
                json={"team_a": "Vanderbilt", "team_b": "Duke", "neutral_site": True},
            )
        finally:
            api_module.predictor = previous_predictor

        self.assertEqual(ab.status_code, 200)
        self.assertEqual(ba.status_code, 200)
        ab_json = ab.json()
        ba_json = ba.json()
        self.assertAlmostEqual(ab_json["win_probability_team_a"], ba_json["win_probability_team_b"], places=12)
        self.assertAlmostEqual(ab_json["predicted_margin"] + ba_json["predicted_margin"], 0.0, places=12)


if __name__ == "__main__":
    unittest.main()
