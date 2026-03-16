import { buildOfficialBracketView } from "./liveBracketEngine";
import { MOCK_LIVE_SNAPSHOTS } from "./liveBracketData";

function snapshotGames(snapshot) {
  return Object.values(snapshot?.games || {});
}

function createMockLiveProvider({ snapshots = MOCK_LIVE_SNAPSHOTS } = {}) {
  return {
    mode: "mock",
    pollIntervalMs: null,
    getInitialCursor() {
      return 0;
    },
    canAdvance(cursor) {
      return cursor < snapshots.length - 1;
    },
    getNextCursor(cursor) {
      return Math.min(cursor + 1, snapshots.length - 1);
    },
    getResetCursor() {
      return 0;
    },
    async getView({ cursor = 0, definition }) {
      const boundedCursor = Math.max(0, Math.min(cursor, snapshots.length - 1));
      const snapshot = snapshots[boundedCursor];
      return buildOfficialBracketView({
        definition,
        games: snapshotGames(snapshot),
        id: snapshot?.id || "mock-feed",
        label: snapshot?.label || "Mock Feed",
        meta: {
          sourceLabel: "Mock provider",
          modeLabel: "Mock snapshot feed",
          updatedAtLabel: `Step ${boundedCursor + 1} of ${snapshots.length}`,
          helperText:
            "Mock live mode is on so we can validate ticker behavior, official advancement, and First Four resolution before the games are actually live.",
        },
      });
    },
  };
}

export { createMockLiveProvider };
