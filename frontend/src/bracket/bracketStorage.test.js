import { beforeEach, describe, expect, it } from "vitest";

import {
  clearBracketWorkspace,
  createBracketWorkspace,
  loadBracketState,
  loadBracketWorkspace,
  saveBracketState,
  saveBracketWorkspace,
} from "./bracketStorage";

describe("bracketStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates a default workspace with one active entry", () => {
    const workspace = loadBracketWorkspace({ initialAssignments: {}, picks: {} });

    expect(workspace.entries).toHaveLength(1);
    expect(workspace.activeEntryId).toBe(workspace.entries[0].id);
  });

  it("saves and restores a workspace with multiple entries", () => {
    const workspace = createBracketWorkspace({ initialAssignments: { east_1: "Duke" }, picks: {} });
    workspace.entries.push({
      id: "entry-2",
      name: "Upset Entry",
      state: { initialAssignments: { east_1: "Duke" }, picks: { east_r1_1: "Siena" } },
      updatedAt: "2026-03-15T00:00:00Z",
    });
    workspace.activeEntryId = "entry-2";

    saveBracketWorkspace(workspace);

    expect(loadBracketWorkspace()).toEqual(workspace);
  });

  it("updates the active entry state through compatibility helpers", () => {
    saveBracketState({ initialAssignments: { east_1: "Duke" }, picks: { east_r1_1: "Duke" } });

    expect(loadBracketState()).toEqual({
      initialAssignments: { east_1: "Duke" },
      picks: { east_r1_1: "Duke" },
    });
  });

  it("clears saved bracket workspace", () => {
    saveBracketWorkspace(createBracketWorkspace({ initialAssignments: {}, picks: {} }));
    clearBracketWorkspace();

    expect(window.localStorage.getItem("march-madness-bracket-workspace-v1")).toBeNull();
  });
});
