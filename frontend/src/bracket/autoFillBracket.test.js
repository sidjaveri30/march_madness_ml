import { describe, expect, it } from "vitest";

import { autoFillBracket } from "./autoFillBracket";
import { AUTO_FILL_MODE_OPTIONS } from "./autoFillModes";
import { bracketDefinition, getAllMatchups } from "./bracketDefinition";
import { createBracketState } from "./bracketState";

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

describe("autoFillBracket", () => {
  it("completes the full non-play-in bracket traversal in every mode", async () => {
    const fillableMatchups = getAllMatchups(bracketDefinition).filter((matchup) => matchup.round !== "firstFour");

    for (const mode of AUTO_FILL_MODE_OPTIONS) {
      const state = createBracketState(bracketDefinition);
      const result = await autoFillBracket({
        definition: bracketDefinition,
        mode: mode.id,
        overwrite: false,
        predictMatchup: async (teamA, teamB) => ({
          team_a: teamA,
          team_b: teamB,
          predicted_winner: teamA,
          win_probability_team_a: 0.64,
          win_probability_team_b: 0.36,
          feature_snapshot: {
            recent_form_rating_diff: 0.4,
            turnover_matchup_diff: 0.2,
          },
        }),
        rng: createSeededRng(123),
        state,
      });

      expect(result.mode).toBe(mode.id);
      expect(result.filledMatchups).toBe(fillableMatchups.length);
      expect(fillableMatchups.every((matchup) => result.state.picks[matchup.id])).toBe(true);
    }
  });

  it("preserves placeholder-slot logic while resolving first-round games", async () => {
    const state = createBracketState(bracketDefinition);
    const result = await autoFillBracket({
      definition: bracketDefinition,
      mode: "model",
      overwrite: false,
      predictMatchup: async (teamA, teamB) => ({
        team_a: teamA,
        team_b: teamB,
        predicted_winner: teamA,
        win_probability_team_a: 0.59,
        win_probability_team_b: 0.41,
        feature_snapshot: {},
      }),
      rng: () => 0.2,
      state,
    });

    expect(result.state.picks.south_r1_1).toBeTruthy();
    expect(result.state.picks.midwest_r1_1).toBeTruthy();
  });
});
