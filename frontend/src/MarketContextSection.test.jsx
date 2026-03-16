import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MarketContextSection from "./MarketContextSection";

const odds = {
  team_a: "Duke",
  team_b: "Vanderbilt",
  event_found: true,
  bookmakers: [
    {
      key: "draftkings",
      title: "DraftKings",
      last_update: "2026-03-15T12:05:00Z",
      moneyline: { team_a_price: -180, team_b_price: 150, team_a_implied_prob: 0.63, team_b_implied_prob: 0.37 },
      spread: { team_a_line: -5, team_a_price: -110, team_b_line: 5, team_b_price: -110 },
      total: { points: 145.5, over_price: -110, under_price: -110 },
    },
    {
      key: "fanduel",
      title: "FanDuel",
      last_update: "2026-03-15T12:00:00Z",
      moneyline: { team_a_price: -170, team_b_price: 145, team_a_implied_prob: 0.62, team_b_implied_prob: 0.38 },
      spread: { team_a_line: -4.5, team_a_price: -110, team_b_line: 4.5, team_b_price: -110 },
      total: null,
    },
  ],
  consensus: {
    team_a_moneyline_avg: -175,
    team_b_moneyline_avg: 147.5,
    team_a_implied_prob_avg: 0.625,
    team_b_implied_prob_avg: 0.375,
    spread_avg: -4.75,
    total_avg: 145.5,
  },
  model_vs_market: {
    model_win_prob_team_a: 0.712,
    market_implied_prob_team_a: 0.625,
    moneyline_edge_team_a: 0.087,
    model_margin_team_a: 7.8,
    market_spread_team_a: -4.75,
    spread_edge_team_a: 3.05,
    edge_label: "Moderate edge",
    interpretation: "Moderate model lean on Duke moneyline. Model leans Duke against the spread.",
  },
};

describe("MarketContextSection", () => {
  it("renders DraftKings and FanDuel lines", () => {
    render(<MarketContextSection odds={odds} />);

    expect(screen.getByText("DraftKings")).toBeInTheDocument();
    expect(screen.getByText("FanDuel")).toBeInTheDocument();
    expect(screen.getByText(/Last updated/i)).toBeInTheDocument();
    expect(screen.getByText(/Duke -180/)).toBeInTheDocument();
    expect(screen.getByText(/Vanderbilt \+150/)).toBeInTheDocument();
    expect(screen.getByText("Moderate edge")).toBeInTheDocument();
  });

  it("shows fallback copy when no odds are available", () => {
    render(<MarketContextSection odds={{ team_a: "Duke", team_b: "Vanderbilt", event_found: false, bookmakers: [], consensus: {}, model_vs_market: null, message: "No market lines currently available for this matchup." }} />);
    expect(screen.getByText(/No market lines currently available/i)).toBeInTheDocument();
  });
});
