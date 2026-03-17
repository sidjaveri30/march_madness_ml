import { describe, expect, it, vi } from "vitest";

import { fetchMatchupPrediction } from "./predictionApi";
import { resetPredictionTeamCache } from "./teamNameResolver";

describe("fetchMatchupPrediction", () => {
  it("sends canonical predictor team names to the backend", async () => {
    resetPredictionTeamCache();
    global.fetch = vi.fn(async (url, options) => {
      if (String(url).endsWith("/teams")) {
        return {
          ok: true,
          json: async () => ({
            teams: ["Cal Baptist", "Ohio St."],
          }),
        };
      }
      if (String(url).endsWith("/predict")) {
        const payload = JSON.parse(options?.body || "{}");
        expect(payload.team_a).toBe("Cal Baptist");
        expect(payload.team_b).toBe("Ohio St.");
        return {
          ok: true,
          json: async () => ({
            team_a: payload.team_a,
            team_b: payload.team_b,
            predicted_winner: payload.team_a,
            win_probability_team_a: 0.7,
            win_probability_team_b: 0.3,
            predicted_margin: 5.4,
            top_reasons: [],
            feature_snapshot: {},
          }),
        };
      }
      throw new Error(`Unhandled fetch ${url}`);
    });

    const result = await fetchMatchupPrediction("http://127.0.0.1:8000", "Cal Baptist", "Ohio St.");
    expect(result.predicted_winner).toBe("Cal Baptist");
  });

  it("falls back to market consensus when a bracket team is unavailable in predictor inventory", async () => {
    resetPredictionTeamCache();
    global.fetch = vi.fn(async (url, options) => {
      if (String(url).endsWith("/teams")) {
        return {
          ok: true,
          json: async () => ({
            teams: ["Kansas", "Ohio St."],
          }),
        };
      }
      if (String(url).includes("/odds?")) {
        return {
          ok: true,
          json: async () => ({
            team_a: "Kansas",
            team_b: "Cal Baptist",
            event_found: true,
            bookmakers: [],
            consensus: {
              team_a_implied_prob_avg: 0.91,
              team_b_implied_prob_avg: 0.09,
            },
            model_vs_market: null,
            message: null,
          }),
        };
      }
      throw new Error(`Unhandled fetch ${url}`);
    });

    const result = await fetchMatchupPrediction("http://127.0.0.1:8000", "Kansas", "Cal Baptist");
    expect(result.predicted_winner).toBe("Kansas");
    expect(result.win_probability_team_a).toBe(0.91);
  });
});
