import { useEffect, useMemo, useState } from "react";

import { bracketDefinition } from "./bracketDefinition";
import { createEspnLiveProvider } from "./espnLiveProvider";
import { EMPTY_SECTIONS } from "./liveBracketEngine";
import { createLiveStateStore } from "./liveStateStore";
import { createMockLiveProvider } from "./mockLiveProvider";

const LIVE_PROVIDER = import.meta.env.VITE_LIVE_PROVIDER || "espn";
let sharedStoresByDefinition = new WeakMap();

function createLiveBracketProvider({ mode = LIVE_PROVIDER } = {}) {
  if (mode === "espn") {
    return createEspnLiveProvider();
  }
  return createMockLiveProvider();
}

function getSharedLiveFeedStore(definition, mode) {
  let storesForDefinition = sharedStoresByDefinition.get(definition);
  if (!storesForDefinition) {
    storesForDefinition = new Map();
    sharedStoresByDefinition.set(definition, storesForDefinition);
  }

  if (!storesForDefinition.has(mode)) {
    const provider = createLiveBracketProvider({ mode });
    const store = createLiveStateStore({ definition, provider });
    storesForDefinition.set(mode, {
      mode: provider.mode,
      provider,
      store,
      subscribers: 0,
    });
  }

  return storesForDefinition.get(mode);
}

function resetSharedLiveFeedStores() {
  sharedStoresByDefinition = new WeakMap();
}

function useLiveBracketFeed({ definition = bracketDefinition, mode = LIVE_PROVIDER, disabled = false } = {}) {
  const sharedController = useMemo(() => getSharedLiveFeedStore(definition, mode), [definition, mode]);
  const [snapshot, setSnapshot] = useState(sharedController.store.getSnapshot());

  useEffect(() => {
    if (disabled) {
      setSnapshot(sharedController.store.getSnapshot());
      return () => {};
    }
    const { store } = sharedController;
    const unsubscribe = store.subscribe(() => setSnapshot(store.getSnapshot()));
    sharedController.subscribers += 1;
    if (sharedController.subscribers === 1) {
      store.start();
    }
    return () => {
      unsubscribe();
      sharedController.subscribers = Math.max(0, sharedController.subscribers - 1);
      if (sharedController.subscribers === 0) {
        store.stop();
      }
    };
  }, [disabled, sharedController]);

  return {
    ...snapshot,
    mode: sharedController.mode,
    next() {
      sharedController.store.next();
    },
    refresh() {
      sharedController.store.refresh();
    },
    reset() {
      sharedController.store.reset();
    },
    view: snapshot.view,
  };
}

export { EMPTY_SECTIONS, createLiveBracketProvider, resetSharedLiveFeedStores, useLiveBracketFeed };
