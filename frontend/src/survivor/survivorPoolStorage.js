import { createPlayer, createPool } from "./survivorPoolUtils.js";

const SURVIVOR_POOL_STORAGE_KEY = "survivor-pool-state-v2";

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
    eliminationReason: typeof player?.eliminationReason === "string" ? player.eliminationReason : "",
    picks: Array.isArray(player?.picks) ? player.picks.map(normalizePick).filter(Boolean) : [],
    usedTeamIds: Array.isArray(player?.usedTeamIds) ? player.usedTeamIds.filter((teamId) => typeof teamId === "string") : [],
  };
}

function normalizeLegacyPool(pool) {
  if (!pool || typeof pool !== "object") return createPool();
  return createPool({
    id: typeof pool.id === "string" && pool.id ? pool.id : undefined,
    name: typeof pool.name === "string" && pool.name.trim() ? pool.name.trim() : "March Madness Survivor Pool",
    players: Array.isArray(pool.players) ? pool.players.map(normalizePlayer) : [],
    processedRoundKeys: Array.isArray(pool.processedRoundKeys)
      ? pool.processedRoundKeys.filter((roundKey) => typeof roundKey === "string")
      : [],
  });
}

function loadSurvivorPool() {
  const raw = window.localStorage.getItem(SURVIVOR_POOL_STORAGE_KEY);
  if (!raw) return createPool();
  try {
    return normalizeLegacyPool(JSON.parse(raw));
  } catch {
    return createPool();
  }
}

function saveSurvivorPool(pool) {
  window.localStorage.setItem(SURVIVOR_POOL_STORAGE_KEY, JSON.stringify(normalizeLegacyPool(pool)));
}

function clearSurvivorPool() {
  window.localStorage.removeItem(SURVIVOR_POOL_STORAGE_KEY);
}

export {
  SURVIVOR_POOL_STORAGE_KEY,
  clearSurvivorPool,
  loadSurvivorPool,
  normalizeLegacyPool as normalizePool,
  saveSurvivorPool,
};
