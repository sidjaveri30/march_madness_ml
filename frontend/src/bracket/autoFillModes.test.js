import { describe, expect, it } from "vitest";

import { chooseWinnerByMode, getModeProbability } from "./autoFillModes";

function createSeededRng(seed = 1) {
  let current = seed >>> 0;
  return () => {
    current += 0x6d2b79f5;
    let value = current;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function countTeamAWins(mode, prediction, iterations = 2000) {
  const rng = createSeededRng(42);
  let wins = 0;
  for (let index = 0; index < iterations; index += 1) {
    const result = chooseWinnerByMode({
      mode,
      prediction,
      matchup: { round: "firstRound" },
      rng,
      seedA: "5",
      seedB: "12",
      teamA: "Favorite",
      teamB: "Underdog",
    });
    if (result.winner === "Favorite") wins += 1;
  }
  return wins;
}

describe("autoFillModes", () => {
  it("chalk mode strongly prefers favorites", () => {
    const wins = countTeamAWins("chalk", {
      win_probability_team_a: 0.7,
      feature_snapshot: {},
    });
    expect(wins).toBeGreaterThan(1500);
  });

  it("model mode samples from probabilities instead of always taking the favorite", () => {
    const wins = countTeamAWins("model", {
      win_probability_team_a: 0.7,
      feature_snapshot: {},
    });
    expect(wins).toBeGreaterThan(1300);
    expect(wins).toBeLessThan(1500);
  });

  it("random mode behaves like a coin flip", () => {
    const wins = countTeamAWins("random", {
      win_probability_team_a: 0.9,
      feature_snapshot: {},
    });
    expect(wins).toBeGreaterThan(900);
    expect(wins).toBeLessThan(1100);
  });

  it("chaos mode produces more underdog picks than chalk", () => {
    const chalkWins = countTeamAWins("chalk", {
      win_probability_team_a: 0.7,
      feature_snapshot: {},
    });
    const chaosWins = countTeamAWins("chaos", {
      win_probability_team_a: 0.7,
      feature_snapshot: {},
    });
    expect(chaosWins).toBeLessThan(chalkWins);
  });

  it("analyst mode gives classic upset profiles a modest bump over pure model", () => {
    const modelProbability = getModeProbability({
      mode: "model",
      prediction: {
        win_probability_team_a: 0.66,
        feature_snapshot: {
          recent_form_rating_diff: -1.6,
          recent_win_pct_5_diff: -0.18,
          three_point_matchup_diff: -0.9,
          turnover_matchup_diff: -0.55,
          tempo_clash_abs: 5.1,
        },
      },
      matchup: { round: "firstRound" },
      seedA: "5",
      seedB: "12",
      teamA: "Favorite",
    });
    const analystProbability = getModeProbability({
      mode: "analyst",
      prediction: {
        win_probability_team_a: 0.66,
        feature_snapshot: {
          recent_form_rating_diff: -1.6,
          recent_win_pct_5_diff: -0.18,
          three_point_matchup_diff: -0.9,
          turnover_matchup_diff: -0.55,
          tempo_clash_abs: 5.1,
        },
      },
      matchup: { round: "firstRound" },
      seedA: "5",
      seedB: "12",
      teamA: "Favorite",
    });

    expect(analystProbability).toBeLessThan(modelProbability);
    expect(analystProbability).toBeGreaterThan(0.5);
  });
});
