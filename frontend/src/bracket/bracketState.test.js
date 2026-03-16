import { describe, expect, it } from "vitest";

import { bracketDefinition } from "./bracketDefinition";
import { applyWinnerPick, createBracketState, getMatchupTeams } from "./bracketState";
import { getTeamName, isPlaceholderTeam } from "./bracketTeams";

describe("bracketState", () => {
  it("advances winners into the next round", () => {
    let state = createBracketState(bracketDefinition);
    state = applyWinnerPick(bracketDefinition, state, "east_r1_1", "Duke");
    state = applyWinnerPick(bracketDefinition, state, "east_r1_2", "Ohio St.");

    const teams = getMatchupTeams(bracketDefinition, state, "east_r2_1");
    expect(teams).toEqual(["Duke", "Ohio St."]);
  });

  it("clears downstream picks when an earlier winner changes", () => {
    let state = createBracketState(bracketDefinition);
    state = applyWinnerPick(bracketDefinition, state, "ff_south_16", "Lehigh");
    state = applyWinnerPick(bracketDefinition, state, "south_r1_1", "Florida");
    state = applyWinnerPick(bracketDefinition, state, "south_r1_2", "Clemson");
    state = applyWinnerPick(bracketDefinition, state, "south_r2_1", "Florida");
    state = applyWinnerPick(bracketDefinition, state, "south_s16_1", "Florida");

    state = applyWinnerPick(bracketDefinition, state, "south_r1_1", "Lehigh");

    expect(state.picks.south_r1_1).toBe("Lehigh");
    expect(state.picks.south_r2_1).toBeUndefined();
    expect(state.picks.south_s16_1).toBeUndefined();
  });

  it("renders first four feeder slots as locked placeholders instead of TBD", () => {
    const state = createBracketState(bracketDefinition);

    const southTeams = getMatchupTeams(bracketDefinition, state, "south_r1_1");
    const westTeams = getMatchupTeams(bracketDefinition, state, "west_r1_5");
    const midwestOneTeams = getMatchupTeams(bracketDefinition, state, "midwest_r1_1");
    const midwestSixTeams = getMatchupTeams(bracketDefinition, state, "midwest_r1_5");

    expect(getTeamName(southTeams[1])).toBe("Prairie View A&M / Lehigh");
    expect(getTeamName(westTeams[1])).toBe("Texas / NC State");
    expect(getTeamName(midwestOneTeams[1])).toBe("Howard / UMBC");
    expect(getTeamName(midwestSixTeams[1])).toBe("Miami (Ohio) / SMU");
    expect(isPlaceholderTeam(southTeams[1])).toBe(true);
    expect(isPlaceholderTeam(westTeams[1])).toBe(true);
  });
});
