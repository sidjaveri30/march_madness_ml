import { buildOfficialBracketView } from "./liveBracketEngine";

function createHistoricalGameKey(game) {
  return game.matchupId || game.gameId || "";
}

function mergeHistoricalFinals(previousView, nextView, definition) {
  const priorGames = previousView?.orderedGames || [];
  const nextGames = nextView?.orderedGames || [];
  if (!priorGames.length || !nextGames.length) return nextView;

  const retainedFinals = priorGames.filter((game) => game.status === "final");
  if (!retainedFinals.length) return nextView;

  const nextKeys = new Set(nextGames.map(createHistoricalGameKey).filter(Boolean));
  const mergedGames = [...nextGames];

  retainedFinals.forEach((game) => {
    const key = createHistoricalGameKey(game);
    if (!key || nextKeys.has(key)) return;
    mergedGames.push(game);
  });

  if (mergedGames.length === nextGames.length) return nextView;

  return buildOfficialBracketView({
    definition,
    games: mergedGames,
    id: nextView.id,
    label: nextView.label,
    meta: nextView.meta,
  });
}

function createLiveStateStore({ definition, provider }) {
  let cursor = provider.getInitialCursor();
  let state = {
    canAdvance: provider.canAdvance(cursor),
    cursor,
    error: "",
    loading: true,
    view: null,
  };
  let intervalId = null;
  let refreshInFlight = false;
  const listeners = new Set();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  function setState(nextState) {
    state = {
      ...state,
      ...nextState,
      canAdvance: provider.canAdvance(cursor),
      cursor,
    };
    emit();
  }

  async function refresh() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    if (!state.view) {
      setState({ loading: true, error: "" });
    } else if (state.error) {
      setState({ error: "" });
    }
    try {
      const nextView = await provider.getView({ cursor, definition });
      const view = mergeHistoricalFinals(state.view, nextView, definition);
      setState({ loading: false, error: "", view });
    } catch (error) {
      setState({ loading: false, error: error.message || "Could not load live bracket feed." });
    } finally {
      refreshInFlight = false;
    }
  }

  function start() {
    if (intervalId) return;
    refresh();
    if (provider.pollIntervalMs) {
      intervalId = window.setInterval(refresh, provider.pollIntervalMs);
    }
  }

  function stop() {
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  return {
    getSnapshot() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start,
    stop,
    refresh,
    next() {
      cursor = provider.getNextCursor(cursor);
      setState({});
      refresh();
    },
    reset() {
      cursor = provider.getResetCursor();
      setState({});
      refresh();
    },
  };
}

export { createLiveStateStore };
