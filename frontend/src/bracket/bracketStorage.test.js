import { beforeEach, describe, expect, it } from "vitest";

import { clearBracketState, loadBracketState, saveBracketState } from "./bracketStorage";

describe("bracketStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and restores bracket state", () => {
    const bracket = {
      initialAssignments: { east_1: "Team 1" },
      picks: { east_r1_1: "Team 1" },
    };
    saveBracketState(bracket);

    expect(loadBracketState()).toEqual(bracket);
  });

  it("clears saved bracket state", () => {
    saveBracketState({ initialAssignments: {}, picks: {} });
    clearBracketState();

    expect(loadBracketState()).toBeNull();
  });
});
