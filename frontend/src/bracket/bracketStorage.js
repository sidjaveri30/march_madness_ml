const STORAGE_KEY = "march-madness-bracket-state-v1";

function loadBracketState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveBracketState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearBracketState() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY, clearBracketState, loadBracketState, saveBracketState };
