import { createPlayer, createPool } from "./survivorPoolUtils.js";

const SURVIVOR_POOL_STORAGE_KEY = "survivor-pool-state-v2";

function createPoolName(index) {
  return `Pool ${index}`;
}

function normalizePick(pick) {
  if (!pick || typeof pick !== "object") return null;
  return {
    roundKey: typeof pick.roundKey === "string" ? pick.roundKey : "",
    teamIds: Array.isArray(pick.teamIds) ? pick.teamIds.filter((teamId) => typeof teamId === "string") : [],
    wasCorrect: typeof pick.wasCorrect === "boolean" ? pick.wasCorrect : null,
  };
}

function normalizePlayer(player, index) {
  const base = createPlayer({ name: `Player ${index + 1}` });
  return {
    ...base,
    ...player,
    id: typeof player?.id === "string" && player.id ? player.id : base.id,
    name: typeof player?.name === "string" && player.name.trim() ? player.name.trim() : base.name,
    eliminated: Boolean(player?.eliminated),
    eliminatedRound: typeof player?.eliminatedRound === "string" ? player.eliminatedRound : "",
    eliminationReason: typeof player?.eliminationReason === "string" ? player.eliminationReason : "",
    eliminationPickIds: Array.isArray(player?.eliminationPickIds) ? player.eliminationPickIds.filter((teamId) => typeof teamId === "string") : [],
    picks: Array.isArray(player?.picks) ? player.picks.map(normalizePick).filter(Boolean) : [],
    usedTeamIds: Array.isArray(player?.usedTeamIds) ? player.usedTeamIds.filter((teamId) => typeof teamId === "string") : [],
  };
}

function normalizePool(pool, fallbackName = "March Madness Survivor Pool") {
  if (!pool || typeof pool !== "object") {
    return createPool({ name: fallbackName });
  }
  return createPool({
    id: typeof pool.id === "string" && pool.id ? pool.id : undefined,
    name: typeof pool.name === "string" && pool.name.trim() ? pool.name.trim() : fallbackName,
    players: Array.isArray(pool.players) ? pool.players.map(normalizePlayer) : [],
    processedRoundKeys: Array.isArray(pool.processedRoundKeys)
      ? pool.processedRoundKeys.filter((roundKey) => typeof roundKey === "string")
      : [],
  });
}

function normalizeDraftPicks(draftPicks) {
  if (!draftPicks || typeof draftPicks !== "object") return {};
  return Object.fromEntries(
    Object.entries(draftPicks)
      .filter(([key, value]) => typeof key === "string" && Array.isArray(value))
      .map(([key, value]) => [key, value.filter((teamId) => typeof teamId === "string")]),
  );
}

function normalizePoolUi(ui) {
  if (!ui || typeof ui !== "object") {
    return {
      adminMode: false,
      rollbackRoundKey: "",
      selectedPlayerId: "",
    };
  }
  return {
    adminMode: Boolean(ui.adminMode),
    rollbackRoundKey: typeof ui.rollbackRoundKey === "string" ? ui.rollbackRoundKey : "",
    selectedPlayerId: typeof ui.selectedPlayerId === "string" ? ui.selectedPlayerId : "",
  };
}

function createSurvivorPoolEntry({ id, name, pool, draftPicks = {}, ui = null, updatedAt = new Date().toISOString() } = {}) {
  const basePool = normalizePool(pool, typeof name === "string" && name.trim() ? name.trim() : "March Madness Survivor Pool");
  const entryId = typeof id === "string" && id ? id : basePool.id;
  const nextName = typeof name === "string" && name.trim() ? name.trim() : basePool.name || "March Madness Survivor Pool";
  return {
    id: entryId,
    name: nextName,
    pool: {
      ...basePool,
      id: entryId,
      name: nextName,
    },
    draftPicks: normalizeDraftPicks(draftPicks),
    ui: normalizePoolUi(ui),
    updatedAt: typeof updatedAt === "string" ? updatedAt : new Date().toISOString(),
  };
}

function createSurvivorPoolWorkspace() {
  const entry = createSurvivorPoolEntry({ name: createPoolName(1), pool: createPool({ name: createPoolName(1) }) });
  return {
    activeSurvivorPoolId: entry.id,
    survivorPoolOrder: [entry.id],
    survivorPoolsById: {
      [entry.id]: entry,
    },
  };
}

function normalizeLegacyPoolWorkspace(raw) {
  const entry = createSurvivorPoolEntry({ pool: normalizePool(raw) });
  return {
    activeSurvivorPoolId: entry.id,
    survivorPoolOrder: [entry.id],
    survivorPoolsById: {
      [entry.id]: entry,
    },
  };
}

function normalizeSurvivorPoolWorkspace(workspace) {
  if (!workspace || typeof workspace !== "object") {
    return createSurvivorPoolWorkspace();
  }

  if ("players" in workspace || "processedRoundKeys" in workspace) {
    return normalizeLegacyPoolWorkspace(workspace);
  }

  const rawPoolsById = workspace.survivorPoolsById && typeof workspace.survivorPoolsById === "object" ? workspace.survivorPoolsById : {};
  const rawOrder = Array.isArray(workspace.survivorPoolOrder) ? workspace.survivorPoolOrder.filter((id) => typeof id === "string") : [];
  const normalizedEntries = Object.entries(rawPoolsById)
    .filter(([id, value]) => typeof id === "string" && value && typeof value === "object")
    .map(([id, value]) =>
      createSurvivorPoolEntry({
        id,
        name: value.name,
        pool: value.pool || value,
        draftPicks: value.draftPicks,
        ui: value.ui,
        updatedAt: value.updatedAt,
      }),
    );

  const survivorPoolsById = Object.fromEntries(normalizedEntries.map((entry) => [entry.id, entry]));
  const orderedIds = [
    ...rawOrder.filter((id) => survivorPoolsById[id]),
    ...normalizedEntries.map((entry) => entry.id).filter((id) => !rawOrder.includes(id)),
  ];

  if (orderedIds.length === 0) {
    return createSurvivorPoolWorkspace();
  }

  const activeSurvivorPoolId =
    typeof workspace.activeSurvivorPoolId === "string" && survivorPoolsById[workspace.activeSurvivorPoolId]
      ? workspace.activeSurvivorPoolId
      : orderedIds[0];

  return {
    activeSurvivorPoolId,
    survivorPoolOrder: orderedIds,
    survivorPoolsById,
  };
}

function getActiveSurvivorPoolEntry(workspace) {
  return workspace.survivorPoolsById[workspace.activeSurvivorPoolId] || workspace.survivorPoolsById[workspace.survivorPoolOrder[0]] || null;
}

function updateEntryTimestamp(entry, updates) {
  return createSurvivorPoolEntry({
    ...entry,
    ...updates,
    updatedAt: updates?.updatedAt || new Date().toISOString(),
  });
}

function updateSurvivorPoolEntry(workspace, entryId, updater) {
  const entry = workspace.survivorPoolsById[entryId];
  if (!entry) return workspace;
  const updates = updater(entry);
  if (!updates || (typeof updates === "object" && Object.keys(updates).length === 0)) {
    return workspace;
  }
  return {
    ...workspace,
    survivorPoolsById: {
      ...workspace.survivorPoolsById,
      [entryId]: updateEntryTimestamp(entry, updates),
    },
  };
}

function setActiveSurvivorPool(workspace, entryId) {
  if (!workspace.survivorPoolsById[entryId]) return workspace;
  return {
    ...workspace,
    activeSurvivorPoolId: entryId,
  };
}

function addSurvivorPool(workspace, entry) {
  return {
    activeSurvivorPoolId: entry.id,
    survivorPoolOrder: [...workspace.survivorPoolOrder, entry.id],
    survivorPoolsById: {
      ...workspace.survivorPoolsById,
      [entry.id]: entry,
    },
  };
}

function renameSurvivorPool(workspace, entryId, name) {
  const nextName = typeof name === "string" ? name.trim() : "";
  if (!nextName) return workspace;
  return updateSurvivorPoolEntry(workspace, entryId, (entry) => ({
    name: nextName,
    pool: {
      ...entry.pool,
      name: nextName,
    },
  }));
}

function deleteSurvivorPool(workspace, entryId) {
  const remainingIds = workspace.survivorPoolOrder.filter((id) => id !== entryId);
  if (remainingIds.length === 0) {
    return createSurvivorPoolWorkspace();
  }
  const survivorPoolsById = { ...workspace.survivorPoolsById };
  delete survivorPoolsById[entryId];
  return {
    activeSurvivorPoolId: workspace.activeSurvivorPoolId === entryId ? remainingIds[0] : workspace.activeSurvivorPoolId,
    survivorPoolOrder: remainingIds,
    survivorPoolsById,
  };
}

function loadSurvivorPoolWorkspace() {
  const raw = window.localStorage.getItem(SURVIVOR_POOL_STORAGE_KEY);
  if (!raw) return createSurvivorPoolWorkspace();
  try {
    return normalizeSurvivorPoolWorkspace(JSON.parse(raw));
  } catch {
    return createSurvivorPoolWorkspace();
  }
}

function saveSurvivorPoolWorkspace(workspace) {
  window.localStorage.setItem(SURVIVOR_POOL_STORAGE_KEY, JSON.stringify(normalizeSurvivorPoolWorkspace(workspace)));
}

function clearSurvivorPool() {
  window.localStorage.removeItem(SURVIVOR_POOL_STORAGE_KEY);
}

function loadSurvivorPool() {
  return getActiveSurvivorPoolEntry(loadSurvivorPoolWorkspace())?.pool || createPool();
}

function saveSurvivorPool(pool) {
  const normalizedPool = normalizePool(pool);
  const entry = createSurvivorPoolEntry({ id: normalizedPool.id, name: normalizedPool.name, pool: normalizedPool });
  saveSurvivorPoolWorkspace({
    activeSurvivorPoolId: entry.id,
    survivorPoolOrder: [entry.id],
    survivorPoolsById: {
      [entry.id]: entry,
    },
  });
}

export {
  SURVIVOR_POOL_STORAGE_KEY,
  addSurvivorPool,
  clearSurvivorPool,
  createPoolName,
  createSurvivorPoolEntry,
  createSurvivorPoolWorkspace,
  deleteSurvivorPool,
  getActiveSurvivorPoolEntry,
  loadSurvivorPool,
  loadSurvivorPoolWorkspace,
  normalizePool,
  normalizeSurvivorPoolWorkspace,
  renameSurvivorPool,
  saveSurvivorPool,
  saveSurvivorPoolWorkspace,
  setActiveSurvivorPool,
  updateSurvivorPoolEntry,
};
