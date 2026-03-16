import { describe, expect, it } from "vitest";

import { getDisplayGameInfo, getMatchupHeaderMeta } from "./gameDisplay";

describe("gameDisplay", () => {
  it("formats live and final states compactly", () => {
    const live = getDisplayGameInfo({ status: "live", detail: "2H 05:51", scoreA: 68, scoreB: 64 });
    const final = getDisplayGameInfo({ status: "final", statusLabel: "FINAL", scoreA: 79, scoreB: 61 });

    expect(live.displayStatusLabel).toBe("LIVE");
    expect(live.displayStatusDetail).toBe("2H 05:51");
    expect(final.displayStatusLabel).toBe("FINAL");
    expect(final.displayStatusDetail).toBe("");
  });

  it("uses round plus compact tip time for upcoming headers", () => {
    const matchup = { label: "East First Round", sublabel: "Seed meeting" };
    const upcoming = getDisplayGameInfo({ status: "upcoming", startTime: "2026-03-19T21:10:00Z" });
    const header = getMatchupHeaderMeta(matchup, upcoming);

    expect(upcoming.displayStatusLabel).toBe("TIP");
    expect(header.label).toBe("East First Round");
    expect(header.detail).toMatch(/3\/19|3\/20/);
  });

  it("replaces round labels with live or final status in bracket cards", () => {
    const matchup = { label: "National Semifinal", sublabel: "East champion vs South champion" };

    expect(getMatchupHeaderMeta(matchup, { status: "live", detail: "2H 05:51" })).toEqual({
      label: "LIVE",
      detail: "2H 05:51",
    });
    expect(getMatchupHeaderMeta(matchup, { status: "final" })).toEqual({
      label: "FINAL",
      detail: "",
    });
  });
});
