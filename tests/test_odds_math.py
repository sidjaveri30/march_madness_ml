from __future__ import annotations

import unittest

from src.utils.odds_math import (
    american_to_implied_probability,
    build_market_interpretation,
    categorize_probability_edge,
    describe_spread_difference,
    no_vig_two_way_probabilities,
    spread_interpretation,
)


class OddsMathTests(unittest.TestCase):
    def test_american_to_implied_probability(self):
        self.assertAlmostEqual(american_to_implied_probability(-150), 0.6, places=6)
        self.assertAlmostEqual(american_to_implied_probability(150), 0.4, places=6)

    def test_no_vig_two_way_probabilities(self):
        prob_a, prob_b = no_vig_two_way_probabilities(-150, 130)
        self.assertAlmostEqual(prob_a + prob_b, 1.0, places=6)
        self.assertGreater(prob_a, prob_b)

    def test_edge_labels_and_interpretation_are_conservative(self):
        self.assertEqual(categorize_probability_edge(0.01), "No clear edge")
        self.assertEqual(categorize_probability_edge(0.03), "Small edge")
        self.assertEqual(categorize_probability_edge(0.07), "Moderate edge")
        self.assertEqual(
            spread_interpretation(7.8, -4.5, "Duke", "Vanderbilt"),
            "Model leans Duke against the spread.",
        )
        self.assertIn(
            "Moderate",
            build_market_interpretation("Moderate edge", "Duke", "Spread looks close to fair."),
        )
        self.assertEqual(
            describe_spread_difference(7.8, -4.5, "Duke", "Vanderbilt"),
            "Model projects Duke 12.3 points stronger than the market spread.",
        )


if __name__ == "__main__":
    unittest.main()
