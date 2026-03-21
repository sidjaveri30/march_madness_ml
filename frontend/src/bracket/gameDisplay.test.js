import { describe, expect, it } from "vitest";

import { getDisplayGameInfo, getGameStatusDisplay, getMatchupHeaderMeta } from "./gameDisplay";

describe("gameDisplay", () => {
  it("formats live and final states compactly", () => {
    const live = getDisplayGameInfo({ status: "live", detail: "2H 05:51", scoreA: 68, scoreB: 64 });
    const final = getDisplayGameInfo({ status: "final", statusLabel: "FINAL", scoreA: 79, scoreB: 61 });

    expect(live.statusDisplay).toEqual({
      text: "05:51 2H",
      type: "live",
      liveLabel: "LIVE",
    });
    expect(final.statusDisplay).toEqual({
      text: "Final",
      type: "final",
    });
  });

  it("uses a single compact timestamp for upcoming games", () => {
    const matchup = { label: "East First Round", sublabel: "Seed meeting" };
    const upcoming = getDisplayGameInfo({ status: "upcoming", startTime: "2026-03-19T21:10:00Z" });
    const header = getMatchupHeaderMeta(matchup, upcoming);

    expect(upcoming.statusDisplay.type).toBe("upcoming");
    expect(upcoming.statusDisplay.text).toMatch(/Mar/);
    expect(upcoming.statusDisplay.text).toMatch(/3:10 PM|4:10 PM/);
    expect(header.label).toBe("");
    expect(header.detail).toBe("");
  });

  it("returns one status display row per game state", () => {
    expect(getGameStatusDisplay({ status: "live", detail: "LIVE 2H 08:42" })).toEqual({
      text: "08:42 2H",
      type: "live",
      liveLabel: "LIVE",
    });
    expect(getGameStatusDisplay({ status: "final" })).toEqual({
      text: "Final",
      type: "final",
    });
    expect(getGameStatusDisplay({ status: "upcoming", startTime: "2026-03-19T21:10:00Z" })).toEqual({
      text: "Mar 19 • 4:10 PM",
      type: "upcoming",
    });
  });
});
