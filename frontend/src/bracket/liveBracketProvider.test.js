import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bracketDefinition } from "./bracketDefinition";
import { buildOfficialBracketView } from "./liveBracketEngine";
import { createEspnLiveProvider } from "./espnLiveProvider";
import { resetSharedLiveFeedStores } from "./liveBracketProvider";
import { createLiveStateStore } from "./liveStateStore";
import { getMatchupTeams } from "./bracketState";
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

  it("maps ESPN shorthand winners back to bracket team names before advancing", () => {
    const view = buildOfficialBracketView({
      definition: bracketDefinition,
      games: [
        {
          gameId: "401856483",
          teamA: "Michigan St",
          teamB: "N Dakota St",
          teamAKey: "michigan state",
          teamBKey: "north dakota st",
          status: "final",
          statusLabel: "FINAL",
          winner: "Michigan St",
          winnerKey: "michigan state",
          scoreA: 92,
          scoreB: 67,
        },
        {
          gameId: "401856436",
          teamA: "SMU",
          teamB: "Miami OH",
          teamAKey: "southern methodist",
          teamBKey: "miami ohio",
          status: "final",
          statusLabel: "FINAL",
          winner: "Miami OH",
          winnerKey: "miami ohio",
          scoreA: 79,
          scoreB: 89,
        },
      ],
    });

    expect(view.bracketState.picks.east_r1_6).toBe("Michigan St.");
    expect(view.bracketState.picks.ff_midwest_11).toBe("Miami (Ohio)");
    expect(getMatchupTeams(bracketDefinition, view.bracketState, "east_r2_3")[1]).toBe("Michigan St.");
    expect(getMatchupTeams(bracketDefinition, view.bracketState, "midwest_r1_5")[1]).toBe("Miami (Ohio)");
  });

  it("matches texas a&m and hawaii alias variants from the official feed", () => {
    const view = buildOfficialBracketView({
      definition: bracketDefinition,
      games: [
        {
          gameId: "401856492",
          teamA: "Saint Mary's",
          teamB: "Texas A&M",
          teamAKey: "saint marys",
          teamBKey: "texas aandm",
          status: "live",
          statusLabel: "LIVE",
          detail: "1H 0:00",
          scoreA: 26,
          scoreB: 37,
        },
        {
          gameId: "401856481",
          teamA: "Arkansas",
          teamB: "Hawai'i",
          teamAKey: "arkansas",
          teamBKey: "hawaii",
          status: "final",
          statusLabel: "FINAL",
          winner: "Arkansas",
          winnerKey: "arkansas",
          scoreA: 84,
          scoreB: 63,
        },
      ],
    });

    expect(view.games.south_r1_7?.status).toBe("live");
    expect(view.games.west_r1_4?.status).toBe("final");
    expect(view.bracketState.picks.west_r1_4).toBe("Arkansas");
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
    resetSharedLiveFeedStores();
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

  it("retains earlier final games so later official matchups keep resolving", async () => {
    const provider = {
      mode: "espn",
      pollIntervalMs: 30000,
      getInitialCursor: () => 0,
      canAdvance: () => false,
      getNextCursor: (cursor) => cursor,
      getResetCursor: () => 0,
      getView: vi
        .fn()
        .mockResolvedValueOnce(
          buildOfficialBracketView({
            definition: bracketDefinition,
            games: [
              {
                gameId: "401856487",
                teamA: "Texas",
                teamB: "NC State",
                teamAKey: "texas",
                teamBKey: "north carolina state",
                status: "final",
                statusLabel: "FINAL",
                winner: "Texas",
                winnerKey: "texas",
                scoreA: 76,
                scoreB: 69,
              },
            ],
            id: "view-one",
            label: "Official Live Feed",
          }),
        )
        .mockResolvedValueOnce(
          buildOfficialBracketView({
            definition: bracketDefinition,
            games: [
              {
                gameId: "401856484",
                teamA: "BYU",
                teamB: "Texas",
                teamAKey: "brigham young",
                teamBKey: "texas",
                status: "live",
                statusLabel: "LIVE",
                detail: "1H 0:31",
                scoreA: 34,
                scoreB: 43,
              },
            ],
            id: "view-two",
            label: "Official Live Feed",
          }),
        ),
    };

    const store = createLiveStateStore({ definition: bracketDefinition, provider });
    store.start();
    await Promise.resolve();
    expect(store.getSnapshot().view.bracketState.picks.ff_west_11).toBe("Texas");

    vi.advanceTimersByTime(30000);
    await Promise.resolve();

    const secondView = store.getSnapshot().view;
    expect(secondView.bracketState.picks.ff_west_11).toBe("Texas");
    expect(secondView.games.west_r1_5?.status).toBe("live");

    store.stop();
  });
});
