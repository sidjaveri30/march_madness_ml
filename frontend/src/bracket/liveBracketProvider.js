import { useEffect, useMemo, useState } from "react";

import { bracketDefinition, getAllMatchups } from "./bracketDefinition";
import { applyWinnerPick, createBracketState } from "./bracketState";
import { MOCK_LIVE_SNAPSHOTS } from "./liveBracketData";

const EMPTY_SECTIONS = { live: [], final: [], upcoming: [] };
const LIVE_BRACKET_MODE = import.meta.env.VITE_LIVE_BRACKET_MODE || "mock";
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getMatchupLookup(definition = bracketDefinition) {
  return Object.fromEntries(getAllMatchups(definition).map((matchup) => [matchup.id, matchup]));
}

function normalizeLiveGame(game, matchupLookup) {
  const matchup = matchupLookup[game.matchupId] || null;

  return {
    matchupId: game.matchupId,
    status: game.status,
    statusLabel: game.statusLabel || "",
    detail: game.detail || game.statusLabel || "",
    teamA: game.teamA || game.team_a || "",
    teamB: game.teamB || game.team_b || "",
    teamAScore: game.teamAScore ?? game.team_a_score ?? null,
    teamBScore: game.teamBScore ?? game.team_b_score ?? null,
    winner: game.winner || null,
    commenceTime: game.commenceTime || game.commence_time || null,
    region: matchup?.region || "",
    round: matchup?.round || "",
    roundLabel: matchup?.label || "",
  };
}

function groupGames(games) {
  return {
    live: games.filter((game) => game.status === "live"),
    final: games.filter((game) => game.status === "final"),
    upcoming: games.filter((game) => game.status === "upcoming"),
  };
}

function buildOfficialBracketState(definition, games) {
  let nextState = createBracketState(definition);

  for (const game of games) {
    if (game.status === "final" && game.winner) {
      nextState = applyWinnerPick(definition, nextState, game.matchupId, game.winner);
    }
  }

  return nextState;
}

function buildLiveBracketView(snapshot, definition = bracketDefinition, meta = {}) {
  const matchupLookup = getMatchupLookup(definition);
  const games = Object.values(snapshot?.games || {}).map((game) => normalizeLiveGame(game, matchupLookup));
  const gamesById = Object.fromEntries(games.map((game) => [game.matchupId, game]));
  const sections = groupGames(games);

  return {
    id: snapshot?.id || "live-view",
    label: snapshot?.label || "Live Feed",
    games: gamesById,
    orderedGames: games,
    sections,
    bracketState: buildOfficialBracketState(definition, games),
    meta: {
      sourceLabel: meta.sourceLabel || "Mock provider",
      modeLabel: meta.modeLabel || "Mock snapshot feed",
      helperText: meta.helperText || "Mock live mode is on so we can validate ticker behavior, official advancement, and First Four resolution before the games are actually live.",
      updatedAtLabel: meta.updatedAtLabel || snapshot?.updatedAtLabel || "",
    },
  };
}

function createMockLiveBracketProvider({ snapshots = MOCK_LIVE_SNAPSHOTS } = {}) {
  return {
    async getView({ cursor = 0, definition = bracketDefinition }) {
      const boundedCursor = Math.max(0, Math.min(cursor, snapshots.length - 1));
      const snapshot = snapshots[boundedCursor];

      return buildLiveBracketView(snapshot, definition, {
        sourceLabel: "Mock provider",
        modeLabel: "Mock snapshot feed",
        updatedAtLabel: `Step ${boundedCursor + 1} of ${snapshots.length}`,
      });
    },
    getInitialCursor() {
      return 0;
    },
    getNextCursor(cursor) {
      return Math.min(cursor + 1, snapshots.length - 1);
    },
    getResetCursor() {
      return 0;
    },
    canAdvance(cursor) {
      return cursor < snapshots.length - 1;
    },
  };
}

function createApiLiveBracketProvider({ apiUrl = API_URL, fetchImpl = fetch } = {}) {
  return {
    async getView({ definition = bracketDefinition }) {
      try {
        const response = await fetchImpl(`${apiUrl}/live-bracket`);
        if (!response.ok) {
          throw new Error("Live provider is not available yet.");
        }
        const payload = await response.json();
        return buildLiveBracketView(payload, definition, {
          sourceLabel: "Official provider",
          modeLabel: "Provider-backed feed",
          updatedAtLabel: payload.updatedAtLabel || "Live",
          helperText: "Official schedule and scoring feed mode is enabled. User bracket entries remain separate from this official bracket.",
        });
      } catch {
        return buildLiveBracketView({ id: "provider-unavailable", label: "Provider setup pending", games: {} }, definition, {
          sourceLabel: "Official provider",
          modeLabel: "Provider-backed feed",
          updatedAtLabel: "Unavailable",
          helperText: "The real live provider layer is prepared, but the backend feed is not connected yet. Switch back to mock mode to continue validating the UI.",
        });
      }
    },
    getInitialCursor() {
      return 0;
    },
    getNextCursor(cursor) {
      return cursor;
    },
    getResetCursor() {
      return 0;
    },
    canAdvance() {
      return false;
    },
  };
}

function createLiveBracketProvider({ mode = LIVE_BRACKET_MODE } = {}) {
  if (mode === "provider") {
    return createApiLiveBracketProvider();
  }
  return createMockLiveBracketProvider();
}

function useLiveBracketFeed({ definition = bracketDefinition, mode = LIVE_BRACKET_MODE } = {}) {
  const provider = useMemo(() => createLiveBracketProvider({ mode }), [mode]);
  const [cursor, setCursor] = useState(() => provider.getInitialCursor());
  const [state, setState] = useState({ error: "", loading: true, view: null });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: "" }));

    provider
      .getView({ cursor, definition })
      .then((view) => {
        if (!cancelled) {
          setState({ error: "", loading: false, view });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ error: error.message || "Could not load live bracket feed.", loading: false, view: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cursor, definition, provider]);

  return {
    canAdvance: provider.canAdvance(cursor),
    cursor,
    error: state.error,
    loading: state.loading,
    next() {
      setCursor((current) => provider.getNextCursor(current));
    },
    reset() {
      setCursor(provider.getResetCursor());
    },
    view: state.view,
  };
}

export {
  EMPTY_SECTIONS,
  buildLiveBracketView,
  buildOfficialBracketState,
  createApiLiveBracketProvider,
  createLiveBracketProvider,
  createMockLiveBracketProvider,
  normalizeLiveGame,
  useLiveBracketFeed,
};
