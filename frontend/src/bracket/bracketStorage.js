const STORAGE_KEY = "march-madness-bracket-workspace-v1";

function createEntryId() {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEntryName(index) {
  return `Entry ${index}`;
}

function createBracketEntry({ id = createEntryId(), name = "Entry 1", state = null, updatedAt = new Date().toISOString() } = {}) {
  return {
    id,
    name,
    state,
    updatedAt,
  };
}

function createBracketWorkspace(defaultState = null) {
  const entry = createBracketEntry({ name: createEntryName(1), state: defaultState });
  return {
    activeEntryId: entry.id,
    entries: [entry],
  };
}

function normalizeBracketWorkspace(workspace, defaultState = null) {
  if (!workspace || typeof workspace !== "object") {
    return createBracketWorkspace(defaultState);
  }

  if ("initialAssignments" in workspace || "picks" in workspace) {
    return createBracketWorkspace(workspace);
  }

  const entries = Array.isArray(workspace.entries)
    ? workspace.entries
        .filter((entry) => entry && typeof entry === "object")
        .map((entry, index) =>
          createBracketEntry({
            id: typeof entry.id === "string" && entry.id ? entry.id : createEntryId(),
            name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : createEntryName(index + 1),
            state: entry.state ?? defaultState,
            updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString(),
          }),
        )
    : [];

  if (entries.length === 0) {
    return createBracketWorkspace(defaultState);
  }

  const activeEntryId =
    typeof workspace.activeEntryId === "string" && entries.some((entry) => entry.id === workspace.activeEntryId)
      ? workspace.activeEntryId
      : entries[0].id;

  return {
    activeEntryId,
    entries,
  };
}

function getActiveEntry(workspace) {
  return workspace.entries.find((entry) => entry.id === workspace.activeEntryId) || workspace.entries[0] || null;
}

function updateEntryTimestamp(entry, updates) {
  return {
    ...entry,
    ...updates,
    updatedAt: updates?.updatedAt || new Date().toISOString(),
  };
}

function updateWorkspaceEntry(workspace, entryId, updater) {
  return {
    ...workspace,
    entries: workspace.entries.map((entry) => (entry.id === entryId ? updateEntryTimestamp(entry, updater(entry)) : entry)),
  };
}

function setActiveWorkspaceEntry(workspace, entryId) {
  if (!workspace.entries.some((entry) => entry.id === entryId)) return workspace;
  return {
    ...workspace,
    activeEntryId: entryId,
  };
}

function addWorkspaceEntry(workspace, entry) {
  return {
    activeEntryId: entry.id,
    entries: [...workspace.entries, entry],
  };
}

function renameWorkspaceEntry(workspace, entryId, name) {
  const nextName = typeof name === "string" ? name.trim() : "";
  if (!nextName) return workspace;
  return updateWorkspaceEntry(workspace, entryId, () => ({ name: nextName }));
}

function replaceWorkspaceEntryState(workspace, entryId, state) {
  return updateWorkspaceEntry(workspace, entryId, () => ({ state }));
}

function deleteWorkspaceEntry(workspace, entryId) {
  if (workspace.entries.length <= 1) return workspace;
  const remainingEntries = workspace.entries.filter((entry) => entry.id !== entryId);
  return {
    activeEntryId: workspace.activeEntryId === entryId ? remainingEntries[0].id : workspace.activeEntryId,
    entries: remainingEntries,
  };
}

function loadBracketWorkspace(defaultState = null) {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createBracketWorkspace(defaultState);
  try {
    return normalizeBracketWorkspace(JSON.parse(raw), defaultState);
  } catch {
    return createBracketWorkspace(defaultState);
  }
}

function saveBracketWorkspace(workspace) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

function clearBracketWorkspace() {
  window.localStorage.removeItem(STORAGE_KEY);
}

function loadBracketState(defaultState = null) {
  const workspace = loadBracketWorkspace(defaultState);
  return workspace.entries.find((entry) => entry.id === workspace.activeEntryId)?.state || null;
}

function saveBracketState(state) {
  const workspace = loadBracketWorkspace(state);
  const nextEntries = workspace.entries.map((entry) =>
    entry.id === workspace.activeEntryId
      ? {
          ...entry,
          state,
          updatedAt: new Date().toISOString(),
        }
      : entry,
  );
  saveBracketWorkspace({ ...workspace, entries: nextEntries });
}

function clearBracketState() {
  clearBracketWorkspace();
}

export {
  STORAGE_KEY,
  addWorkspaceEntry,
  clearBracketState,
  clearBracketWorkspace,
  createBracketEntry,
  createBracketWorkspace,
  createEntryName,
  deleteWorkspaceEntry,
  getActiveEntry,
  loadBracketState,
  loadBracketWorkspace,
  normalizeBracketWorkspace,
  renameWorkspaceEntry,
  replaceWorkspaceEntryState,
  saveBracketState,
  saveBracketWorkspace,
  setActiveWorkspaceEntry,
  updateWorkspaceEntry,
};
