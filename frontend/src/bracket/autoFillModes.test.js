import { describe, expect, it } from "vitest";

import { AUTO_FILL_MODE_DETAILS, chooseWinnerByMode, getModeProbability } from "./autoFillModes";

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
  it("exposes the updated human-facing labels and descriptions", () => {
    expect(AUTO_FILL_MODE_DETAILS.model.description).toMatch(/strict/i);
    expect(AUTO_FILL_MODE_DETAILS.human.label).toBe("Human");
    expect(AUTO_FILL_MODE_DETAILS.human.description).toMatch(/smart-fan/i);
    expect(AUTO_FILL_MODE_DETAILS.chaos.description).toMatch(/plausible/i);
  });

  it("chalk mode strongly prefers favorites", () => {
    const wins = countTeamAWins("chalk", {
      win_probability_team_a: 0.7,
      feature_snapshot: {},
    });
    expect(wins).toBeGreaterThan(1500);
  });

  it("model mode always chooses the higher-probability team", () => {
    const result = chooseWinnerByMode({
      mode: "model",
      prediction: {
        win_probability_team_a: 0.03,
        predicted_winner: "Favorite",
        feature_snapshot: {},
      },
      matchup: { round: "firstRound" },
      seedA: "1",
      seedB: "16",
      rng: createSeededRng(99),
      teamA: "Favorite",
      teamB: "Underdog",
    });
    expect(result.winner).toBe("Underdog");
  });

  it("model mode is deterministic and does not sample randomly", () => {
    const wins = countTeamAWins("model", {
      win_probability_team_a: 0.7,
      feature_snapshot: {},
    });
    expect(wins).toBe(2000);
  });

  it("random mode behaves like a coin flip", () => {
    const wins = countTeamAWins("random", {
      win_probability_team_a: 0.9,
      feature_snapshot: {},
    });
    expect(wins).toBeGreaterThan(900);
    expect(wins).toBeLessThan(1100);
  });

  it("chaos mode produces more underdog picks than human", () => {
    const humanWins = countTeamAWins("human", {
      win_probability_team_a: 0.7,
      feature_snapshot: {},
    });
    const chaosWins = countTeamAWins("chaos", {
      win_probability_team_a: 0.7,
      feature_snapshot: {},
    });
    expect(chaosWins).toBeLessThan(humanWins);
  });

  it("chalk stays more conservative than human", () => {
    const chalkWins = countTeamAWins("chalk", {
      win_probability_team_a: 0.68,
      feature_snapshot: {},
    });
    const humanWins = countTeamAWins("human", {
      win_probability_team_a: 0.68,
      feature_snapshot: {},
    });
    expect(chalkWins).toBeGreaterThan(humanWins);
  });

  it("human gives classic upset profiles a modest bump without becoming absurd", () => {
    const chalkProbability = getModeProbability({
      mode: "chalk",
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
    const humanProbability = getModeProbability({
      mode: "human",
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
    const chaosProbability = getModeProbability({
      mode: "chaos",
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

    expect(humanProbability).toBeLessThan(chalkProbability);
    expect(humanProbability).toBeGreaterThan(0.5);
    expect(chaosProbability).toBeLessThan(humanProbability);
  });
});
