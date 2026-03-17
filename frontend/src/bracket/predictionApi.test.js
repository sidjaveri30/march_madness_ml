import { describe, expect, it, vi } from "vitest";

import { fetchMatchupPrediction, inferSeedFallbackProbability, shouldSuppressFallbackReason } from "./predictionApi";
import { resetPredictionTeamCache } from "./teamNameResolver";

describe("fetchMatchupPrediction", () => {
  it("suppresses noisy unknown-team text in market fallback reasons", () => {
    expect(shouldSuppressFallbackReason("Unknown predictor team mapping: Cal Baptist")).toBe(true);
    expect(shouldSuppressFallbackReason("Unknown team: California Baptist")).toBe(true);
    expect(shouldSuppressFallbackReason("Backend timeout")).toBe(false);
  });

  it("builds a plausible seed-based fallback when neither predictor nor market can cover a matchup", async () => {
    resetPredictionTeamCache();
    global.fetch = vi.fn(async (url) => {
      if (String(url).endsWith("/teams")) {
        return {
          ok: true,
          json: async () => ({
            teams: ["Duke", "Siena"],
          }),
        };
      }
      if (String(url).includes("/teams/search?")) {
        return {
          ok: true,
          json: async () => ({
            exact_match: null,
            strong_match: null,
            matches: [],
          }),
        };
      }
      if (String(url).includes("/odds?")) {
        return {
          ok: true,
          json: async () => ({
            team_a: "Arizona",
            team_b: "Long Island",
            event_found: false,
            bookmakers: [],
            consensus: {},
            model_vs_market: null,
            message: "No market lines currently available for this matchup.",
          }),
        };
      }
      throw new Error(`Unhandled fetch ${url}`);
    });

    const result = await fetchMatchupPrediction("http://127.0.0.1:8000", "Arizona", "Long Island", { seedA: "1", seedB: "16" });
    expect(result.predicted_winner).toBe("Arizona");
    expect(result.win_probability_team_a).toBeGreaterThan(0.9);
    expect(result.top_reasons).toEqual(["Seed-based fallback used for this matchup."]);
  });

  it("normalizes fuzzy predictor names before sending any prediction request", async () => {
    resetPredictionTeamCache();
    global.fetch = vi.fn(async (url, options) => {
      if (String(url).endsWith("/teams")) {
        return {
          ok: true,
          json: async () => ({
            teams: ["Connecticut", "LIU"],
          }),
        };
      }
      if (String(url).endsWith("/predict")) {
        const payload = JSON.parse(options?.body || "{}");
        expect(payload.team_a).toBe("Connecticut");
        expect(payload.team_b).toBe("LIU");
        return {
          ok: true,
          json: async () => ({
            team_a: payload.team_a,
            team_b: payload.team_b,
            predicted_winner: payload.team_a,
            win_probability_team_a: 0.97,
            win_probability_team_b: 0.03,
            predicted_margin: 18.2,
            top_reasons: [],
            feature_snapshot: {},
          }),
        };
      }
      throw new Error(`Unhandled fetch ${url}`);
    });

    const result = await fetchMatchupPrediction("http://127.0.0.1:8000", "UConn", "Long Island");
    expect(result.predicted_winner).toBe("Connecticut");
  });

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
    expect(result.top_reasons).toEqual(["Market fallback used for this matchup."]);
  });

  it("produces sensible seed fallback probabilities for big and small seed gaps", () => {
    expect(inferSeedFallbackProbability("1", "16")).toBeGreaterThan(0.9);
    expect(inferSeedFallbackProbability("8", "9")).toBeGreaterThan(0.5);
    expect(inferSeedFallbackProbability("8", "9")).toBeLessThan(0.6);
    expect(inferSeedFallbackProbability("12", "5")).toBeLessThan(0.5);
  });
});
