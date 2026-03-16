import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bracketDefinition } from "./bracketDefinition";
import { buildOfficialBracketView } from "./liveBracketEngine";
import { createEspnLiveProvider } from "./espnLiveProvider";
import { createLiveStateStore } from "./liveStateStore";
import { createMockLiveProvider } from "./mockLiveProvider";

describe("liveBracketEngine", () => {
  it("advances final winners into the official live bracket state", () => {
    const view = buildOfficialBracketView({
      definition: bracketDefinition,
      games: [
        {
          gameId: "ff_midwest_16",
          teamA: "Howard",
          teamB: "UMBC",
          teamAKey: "howard",
          teamBKey: "umbc",
          status: "final",
          statusLabel: "FINAL",
          winner: "Howard",
          winnerKey: "howard",
          scoreA: 71,
          scoreB: 66,
        },
        {
          gameId: "east_r1_2",
          teamA: "Ohio St.",
          teamB: "TCU",
          teamAKey: "ohio state",
          teamBKey: "texas christian",
          status: "final",
          statusLabel: "FINAL",
          winner: "Ohio St.",
          winnerKey: "ohio state",
          scoreA: 71,
          scoreB: 66,
        },
      ],
    });

    expect(view.bracketState.picks.ff_midwest_16).toBe("Howard");
    expect(view.bracketState.picks.east_r1_2).toBe("Ohio St.");
    expect(view.bracketState.picks.midwest_r1_1).toBeUndefined();
    expect(view.games.ff_midwest_16.status).toBe("final");
  });
});

describe("espn live provider", () => {
  it("falls back to the mock provider when the scoreboard request fails", async () => {
    const provider = createEspnLiveProvider({
      fetchLiveScoreboard: vi.fn(async () => {
        throw new Error("network down");
      }),
      fallbackProvider: createMockLiveProvider(),
    });

    const view = await provider.getView({ definition: bracketDefinition });

    expect(view.meta.modeLabel).toBe("Fallback mock feed");
    expect(view.sections.live.length + view.sections.final.length + view.sections.upcoming.length).toBeGreaterThan(0);
  });
});

describe("liveStateStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls provider updates while active", async () => {
    const provider = {
      mode: "espn",
      pollIntervalMs: 30000,
      getInitialCursor: () => 0,
      canAdvance: () => false,
      getNextCursor: (cursor) => cursor,
      getResetCursor: () => 0,
      getView: vi
        .fn()
        .mockResolvedValueOnce({ id: "one", sections: { live: [], final: [], upcoming: [] }, bracketState: { picks: {} }, games: {}, meta: {} })
        .mockResolvedValueOnce({ id: "two", sections: { live: [], final: [], upcoming: [] }, bracketState: { picks: {} }, games: {}, meta: {} }),
    };

    const store = createLiveStateStore({ definition: bracketDefinition, provider });
    store.start();
    await Promise.resolve();
    expect(provider.getView).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30000);
    await Promise.resolve();
    expect(provider.getView).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().view.id).toBe("two");

    store.stop();
  });
});
