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
      const view = await provider.getView({ cursor, definition });
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
