from __future__ import annotations

import unittest

import pandas as pd

from src.features.engineering import _add_team_form_features
from src.models.training import _available_feature_families, _time_series_splits


class TrainingPipelineTests(unittest.TestCase):
    def test_time_series_splits_preserve_chronology(self):
        df = pd.DataFrame(
            {
                "date": pd.date_range("2025-11-01", periods=1200, freq="D", tz="UTC"),
                "win": [idx % 2 for idx in range(1200)],
            }
        )

        splits = _time_series_splits(df)

        self.assertGreaterEqual(len(splits), 2)
        for train_idx, test_idx in splits:
            self.assertLess(max(train_idx), min(test_idx))
            self.assertLess(df.iloc[train_idx]["date"].max(), df.iloc[test_idx]["date"].min())

    def test_feature_family_selection_skips_market_features_when_unavailable(self):
        df = pd.DataFrame(
            {
                "neutral_site": [1.0, 1.0],
                "is_home": [0.0, 0.0],
                "is_away": [0.0, 0.0],
                "adjem": [30.0, 20.0],
                "opp_adjem": [20.0, 30.0],
                "adjem_diff": [10.0, -10.0],
                "seed_estimate": [1.0, 5.0],
                "opp_seed_estimate": [5.0, 1.0],
                "seed_estimate_diff": [-4.0, 4.0],
                "recent_win_pct_5": [1.0, 0.6],
                "opp_recent_win_pct_5": [0.6, 1.0],
                "recent_win_pct_5_diff": [0.4, -0.4],
                "quality_vs_schedule_diff": [8.0, -8.0],
            }
        )

        families = _available_feature_families(df)

        self.assertIn("kenpom_only", families)
        self.assertIn("kenpom_plus_form", families)
        self.assertNotIn("kenpom_plus_form_plus_market", families)

    def test_team_form_features_use_only_prior_games(self):
        games = pd.DataFrame(
            [
                {
                    "team": "Duke",
                    "team_normalized": "duke",
                    "date": pd.Timestamp("2025-11-01", tz="UTC"),
                    "opponent": "Team B",
                    "opponent_normalized": "team_b",
                    "result": "W",
                    "team_score": 80,
                    "opp_score": 70,
                    "location_raw": "",
                    "win": 1,
                    "margin": 10,
                    "is_home": 1,
                    "is_away": 0,
                    "neutral_site": 0,
                },
                {
                    "team": "Duke",
                    "team_normalized": "duke",
                    "date": pd.Timestamp("2025-11-05", tz="UTC"),
                    "opponent": "Team C",
                    "opponent_normalized": "team_c",
                    "result": "L",
                    "team_score": 68,
                    "opp_score": 72,
                    "location_raw": "@",
                    "win": 0,
                    "margin": -4,
                    "is_home": 0,
                    "is_away": 1,
                    "neutral_site": 0,
                },
            ]
        )

        featured = _add_team_form_features(games)

        self.assertEqual(featured.iloc[0]["games_played_before"], 0)
        self.assertAlmostEqual(featured.iloc[0]["win_pct_pre"], 0.5)
        self.assertAlmostEqual(featured.iloc[1]["win_pct_pre"], 1.0)
        self.assertAlmostEqual(featured.iloc[1]["avg_margin_pre"], 10.0)
        self.assertAlmostEqual(featured.iloc[1]["recent_win_pct_5"], 1.0)
        self.assertAlmostEqual(featured.iloc[1]["days_since_last_game"], 4.0)


if __name__ == "__main__":
    unittest.main()
