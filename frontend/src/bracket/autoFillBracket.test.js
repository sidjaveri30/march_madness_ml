import { describe, expect, it } from "vitest";

import { autoFillBracket } from "./autoFillBracket";
import { bracketDefinition, getAllMatchups } from "./bracketDefinition";
import { createBracketState } from "./bracketState";

describe("autoFillBracket", () => {
  it("completes the full non-play-in bracket traversal when predictions resolve", async () => {
    const state = createBracketState(bracketDefinition);
    const result = await autoFillBracket({
      definition: bracketDefinition,
      overwrite: false,
      predictMatchup: async (teamA, teamB) => ({
        team_a: teamA,
        team_b: teamB,
        predicted_winner: teamA,
        win_probability_team_a: 0.64,
        win_probability_team_b: 0.36,
      }),
      state,
    });

    const fillableMatchups = getAllMatchups(bracketDefinition).filter((matchup) => matchup.round !== "firstFour");
    expect(result.filledMatchups).toBe(fillableMatchups.length);
    expect(fillableMatchups.every((matchup) => result.state.picks[matchup.id])).toBe(true);
  });
});
