import { describe, expect, it } from "vitest";

import { bracketDefinition } from "./bracketDefinition";
import { derivePickOutcomeByMatchup, getWinningTeamId } from "./pickOutcome";

describe("pickOutcome", () => {
  it("detects winners for final games", () => {
    expect(
      getWinningTeamId({
        status: "final",
        teamA: "Duke",
        teamB: "Siena",
        teamAScore: 77,
        teamBScore: 61,
      }),
    ).toBe("duke");
  });

  it("marks later-round picks as busted when the picked team already lost", () => {
    const outcomeByMatchup = derivePickOutcomeByMatchup({
      definition: bracketDefinition,
      picks: {
        west_r1_3: "Wisconsin",
        west_r1_4: "Arkansas",
        west_r2_2: "Wisconsin",
      },
      actualGamesByMatchup: {
        west_r1_3: {
          status: "final",
          teamA: "Wisconsin",
          teamB: "High Point",
          teamAScore: 64,
          teamBScore: 68,
          winner: "High Point",
        },
      },
    });

    expect(outcomeByMatchup.west_r1_3).toBe("incorrect");
    expect(outcomeByMatchup.west_r2_2).toBe("busted");
  });

  it("keeps future picks pending when the picked team is still alive", () => {
    const outcomeByMatchup = derivePickOutcomeByMatchup({
      definition: bracketDefinition,
      picks: {
        west_r1_3: "Wisconsin",
        west_r1_4: "Arkansas",
        west_r2_2: "Wisconsin",
      },
      actualGamesByMatchup: {},
    });

    expect(outcomeByMatchup.west_r1_3).toBe("pending");
    expect(outcomeByMatchup.west_r2_2).toBe("pending");
  });
});
