import { describe, expect, it } from "vitest";

import { getTeamSuggestions, resolveTeamInput } from "./teamSearch";

const TEAMS = ["Duke", "Drake", "Duquesne", "Gonzaga", "Vanderbilt"];

describe("teamSearch", () => {
  it("filters suggestions while typing", () => {
    expect(getTeamSuggestions("du", TEAMS)).toEqual(["Duke", "Duquesne"]);
  });

  it("returns an exact match immediately", () => {
    expect(resolveTeamInput("Duke", TEAMS).exactMatch).toBe("Duke");
  });

  it("returns a fuzzy suggestion for a typo", () => {
    const resolution = resolveTeamInput("Gonzgaa", TEAMS);
    expect(resolution.strongSuggestion).toBe("Gonzaga");
    expect(resolution.suggestions).toContain("Gonzaga");
  });
});
