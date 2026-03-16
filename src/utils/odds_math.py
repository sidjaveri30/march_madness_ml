from __future__ import annotations

from statistics import mean


def american_to_implied_probability(price: int | float | None) -> float | None:
    if price in (None, 0):
        return None
    price = float(price)
    if price > 0:
        return 100.0 / (price + 100.0)
    return abs(price) / (abs(price) + 100.0)


def no_vig_two_way_probabilities(price_a: int | float | None, price_b: int | float | None) -> tuple[float | None, float | None]:
    prob_a = american_to_implied_probability(price_a)
    prob_b = american_to_implied_probability(price_b)
    if prob_a is None or prob_b is None:
        return None, None
    total = prob_a + prob_b
    if total <= 0:
        return None, None
    return prob_a / total, prob_b / total


def average_number(values: list[int | float | None]) -> float | None:
    clean = [float(value) for value in values if value is not None]
    if not clean:
        return None
    return mean(clean)


def average_moneyline(values: list[int | float | None]) -> int | None:
    average = average_number(values)
    if average is None:
        return None
    return int(round(average))


def categorize_probability_edge(edge: float | None) -> str:
    if edge is None:
        return "No clear edge"
    edge_points = abs(edge) * 100
    if edge_points < 2:
        return "No clear edge"
    if edge_points < 5:
        return "Small edge"
    if edge_points < 10:
        return "Moderate edge"
    return "Strong edge"


def spread_interpretation(model_margin_team_a: float | None, market_spread_team_a: float | None, team_a: str, team_b: str) -> str:
    if model_margin_team_a is None or market_spread_team_a is None:
        return "Spread context unavailable."
    diff = model_margin_team_a - market_spread_team_a
    if abs(diff) < 1.5:
        return "Spread looks close to fair."
    if diff > 0:
        return f"Model leans {team_a} against the spread."
    return f"Model leans {team_b} against the spread."


def describe_spread_difference(
    model_margin_team_a: float | None,
    market_spread_team_a: float | None,
    team_a: str,
    team_b: str,
) -> str:
    if model_margin_team_a is None or market_spread_team_a is None:
        return "Spread comparison unavailable."
    diff = model_margin_team_a - market_spread_team_a
    if abs(diff) < 1.5:
        return "Spread looks close to fair."
    if diff > 0:
        return f"Model projects {team_a} {abs(diff):.1f} points stronger than the market spread."
    return f"Model projects {team_b} {abs(diff):.1f} points stronger than the market spread."


def build_market_interpretation(
    edge_label: str,
    edge_team: str | None,
    spread_summary: str,
) -> str:
    if edge_label == "No clear edge" or edge_team is None:
        return f"No clear moneyline edge. {spread_summary}"
    return f"{edge_label} model lean on {edge_team} moneyline. {spread_summary}"
