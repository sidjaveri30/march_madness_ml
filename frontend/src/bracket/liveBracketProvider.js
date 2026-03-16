import { useEffect, useMemo, useState } from "react";

import { bracketDefinition } from "./bracketDefinition";
import { createEspnLiveProvider } from "./espnLiveProvider";
import { EMPTY_SECTIONS } from "./liveBracketEngine";
import { createLiveStateStore } from "./liveStateStore";
import { createMockLiveProvider } from "./mockLiveProvider";

const LIVE_PROVIDER = import.meta.env.VITE_LIVE_PROVIDER || "espn";

function createLiveBracketProvider({ mode = LIVE_PROVIDER } = {}) {
  if (mode === "espn") {
    return createEspnLiveProvider();
  }
  return createMockLiveProvider();
}

function useLiveBracketFeed({ definition = bracketDefinition, mode = LIVE_PROVIDER, disabled = false } = {}) {
  const provider = useMemo(() => createLiveBracketProvider({ mode }), [mode]);
  const store = useMemo(() => createLiveStateStore({ definition, provider }), [definition, provider]);
  const [snapshot, setSnapshot] = useState(store.getSnapshot());

  useEffect(() => {
    if (disabled) {
      setSnapshot(store.getSnapshot());
      return () => {};
    }
    const unsubscribe = store.subscribe(() => setSnapshot(store.getSnapshot()));
    store.start();
    return () => {
      unsubscribe();
      store.stop();
    };
  }, [disabled, store]);

  return {
    ...snapshot,
    mode: provider.mode,
    next() {
      store.next();
    },
    refresh() {
      store.refresh();
    },
    reset() {
      store.reset();
    },
    view: snapshot.view,
  };
}

export { EMPTY_SECTIONS, createLiveBracketProvider, useLiveBracketFeed };
