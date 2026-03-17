import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { autoFillBracket } from "./autoFillBracket";
import { AUTO_FILL_MODE_DETAILS, AUTO_FILL_MODE_OPTIONS, DEFAULT_AUTO_FILL_MODE } from "./autoFillModes";
import { bracketDefinition } from "./bracketDefinition";
import { applyWinnerPick, clearWinnerPick, createBracketState, getChampion, getMatchupTeams, setWinnerPick } from "./bracketState";
import {
  addWorkspaceEntry,
  createBracketEntry,
  createEntryName,
  deleteWorkspaceEntry,
  getActiveEntry,
  loadBracketWorkspace,
  renameWorkspaceEntry,
  replaceWorkspaceEntryState,
  saveBracketWorkspace,
  setActiveWorkspaceEntry,
} from "./bracketStorage";
import BracketBoard from "./BracketBoard";
import EntryManager from "./EntryManager";
import MatchupDetailsModal from "./MatchupDetailsModal";
import { isResolvedTeam, sameTeam } from "./bracketTeams";
import { createExactPredictionKey, createPredictionKey, fetchMatchupPrediction } from "./predictionApi";
import SaveBracketControls from "./SaveBracketControls";
import { validateBracketPredictionNames } from "./teamNameResolver";
import { useDebouncedEffect } from "../useDebouncedEffect";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function sanitizeEntryState(entry) {
  return createBracketState(bracketDefinition, entry?.state);
}

export default function MyBracketPage() {
  const [workspace, setWorkspace] = useState(() => {
    const defaultState = createBracketState(bracketDefinition);
    return loadBracketWorkspace(defaultState);
  });
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [predictionCache, setPredictionCache] = useState({});
  const [saveStatus, setSaveStatus] = useState("");
  const [autoFillBusy, setAutoFillBusy] = useState(false);
  const [autoFillMode, setAutoFillMode] = useState(DEFAULT_AUTO_FILL_MODE);
  const [debugLayout, setDebugLayout] = useState(false);
  const autoFillPredictionCacheRef = useRef(new Map());

  const activeEntry = useMemo(() => getActiveEntry(workspace), [workspace]);
  const bracketState = useMemo(() => sanitizeEntryState(activeEntry), [activeEntry]);
  const [entryNameDraft, setEntryNameDraft] = useState(activeEntry?.name || "");

  useDebouncedEffect(() => {
    saveBracketWorkspace(workspace);
  }, 250, [workspace]);

  useEffect(() => {
    setEntryNameDraft(activeEntry?.name || "");
  }, [activeEntry?.id, activeEntry?.name]);

  useEffect(() => {
    if (!selectedMatchup) return;
    const teams = getMatchupTeams(bracketDefinition, bracketState, selectedMatchup.id);
    if (teams.some((team) => !isResolvedTeam(team))) return;

    const key = createPredictionKey(teams);
    if (predictionCache[key]?.data || predictionCache[key]?.loading) return;

    setPredictionCache((current) => ({ ...current, [key]: { loading: true } }));
    fetchMatchupPrediction(API_URL, teams[0], teams[1])
      .then((data) => setPredictionCache((current) => ({ ...current, [key]: { data } })))
      .catch((error) => setPredictionCache((current) => ({ ...current, [key]: { error: error.message } })));
  }, [bracketState, predictionCache, selectedMatchup]);

  const champion = useMemo(() => getChampion(bracketState), [bracketState]);
  const selectedAutoFillMode = AUTO_FILL_MODE_DETAILS[autoFillMode] || AUTO_FILL_MODE_DETAILS[DEFAULT_AUTO_FILL_MODE];

  function flashStatus(message, duration = 1800) {
    setSaveStatus(message);
    window.setTimeout(() => setSaveStatus(""), duration);
  }

  const commitState = useCallback((nextState) => {
    setWorkspace((current) =>
      replaceWorkspaceEntryState(current, current.activeEntryId, nextState),
    );
  }, []);

  const handlePick = useCallback((matchupId, winner) => {
    setWorkspace((current) => {
      const currentEntry = getActiveEntry(current);
      const currentState = sanitizeEntryState(currentEntry);
      const currentWinner = currentState.picks[matchupId];
      const nextState = sameTeam(currentWinner, winner)
        ? clearWinnerPick(bracketDefinition, currentState, matchupId)
        : applyWinnerPick(bracketDefinition, currentState, matchupId, winner);
      return replaceWorkspaceEntryState(current, current.activeEntryId, nextState);
    });
  }, []);

  const handlePickFromModal = useCallback((matchupId, winner) => {
    setWorkspace((current) => {
      const currentEntry = getActiveEntry(current);
      const currentState = sanitizeEntryState(currentEntry);
      return replaceWorkspaceEntryState(current, current.activeEntryId, setWinnerPick(bracketDefinition, currentState, matchupId, winner));
    });
  }, []);

  function handleSave() {
    setWorkspace((current) => {
      const renamedWorkspace = entryNameDraft.trim() ? renameWorkspaceEntry(current, current.activeEntryId, entryNameDraft) : current;
      return replaceWorkspaceEntryState(renamedWorkspace, renamedWorkspace.activeEntryId, bracketState);
    });
    flashStatus("Entry saved locally.");
  }

  function handleReset() {
    commitState(createBracketState(bracketDefinition));
    flashStatus("Active entry reset.");
  }

  function handleExport() {
    const payload = {
      name: activeEntry?.name || "Entry 1",
      state: bracketState,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${(activeEntry?.name || "entry").toLowerCase().replace(/\s+/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    try {
      const imported = JSON.parse(raw);
      const nextState = createBracketState(bracketDefinition, imported.state || imported);
      const nextName = typeof imported.name === "string" && imported.name.trim() ? imported.name.trim() : activeEntry?.name || "Imported Entry";
      setEntryNameDraft(nextName);
      setWorkspace((current) =>
        replaceWorkspaceEntryState(renameWorkspaceEntry(current, current.activeEntryId, nextName), current.activeEntryId, nextState),
      );
      flashStatus("Entry imported.");
    } catch {
      flashStatus("Could not import bracket JSON.", 2200);
    }
  }

  function handleCreateEntry() {
    setWorkspace((current) => {
      const nextEntry = createBracketEntry({
        name: createEntryName(current.entries.length + 1),
        state: createBracketState(bracketDefinition),
      });
      return addWorkspaceEntry(current, nextEntry);
    });
    flashStatus("Created a new bracket entry.");
  }

  function handleSelectEntry(entryId) {
    setWorkspace((current) => setActiveWorkspaceEntry(current, entryId));
    setSelectedMatchup(null);
  }

  function handleRenameEntry() {
    const nextName = entryNameDraft.trim();
    if (!nextName) return;
    setWorkspace((current) => renameWorkspaceEntry(current, current.activeEntryId, nextName));
    flashStatus("Entry renamed.");
  }

  function handleDeleteEntry() {
    setWorkspace((current) => deleteWorkspaceEntry(current, current.activeEntryId));
    setSelectedMatchup(null);
    flashStatus("Entry deleted.");
  }

  async function getAutoFillPrediction(teamA, teamB, options = {}) {
    const key = createExactPredictionKey(teamA, teamB);
    if (!autoFillPredictionCacheRef.current.has(key)) {
      autoFillPredictionCacheRef.current.set(key, fetchMatchupPrediction(API_URL, teamA, teamB, options));
    }
    return autoFillPredictionCacheRef.current.get(key);
  }

  async function handleAutoFill(overwrite = false) {
    setAutoFillBusy(true);
    try {
      await validateBracketPredictionNames(API_URL, bracketDefinition);
      const result = await autoFillBracket({
        definition: bracketDefinition,
        mode: autoFillMode,
        overwrite,
        predictMatchup: getAutoFillPrediction,
        state: bracketState,
      });

      commitState(result.state);
      flashStatus(
        result.filledMatchups > 0
          ? `${overwrite ? `${selectedAutoFillMode.label} overwrite complete.` : `${selectedAutoFillMode.label} auto-fill complete.`} ${result.filledMatchups} matchup${result.filledMatchups === 1 ? "" : "s"} updated.`
          : "No unresolved matchups were updated.",
        2200,
      );
    } catch (error) {
      flashStatus(error.message || "Auto-fill failed.", 2400);
    } finally {
      setAutoFillBusy(false);
    }
  }

  const selectedTeams = selectedMatchup ? getMatchupTeams(bracketDefinition, bracketState, selectedMatchup.id) : [];
  const selectedPrediction =
    selectedMatchup && selectedTeams.every((team) => isResolvedTeam(team))
      ? predictionCache[createPredictionKey(selectedTeams)]
      : null;

  return (
    <section className="mode-panel bracket-mode bracket-mode-clean">
      <section className="bracket-toolbar">
        <div className="bracket-title-block">
          <div className="eyebrow">My Bracket</div>
          <h2>Build and save your entries</h2>
          <p className="subtle">Your picks stay personal here. Official results will never overwrite your saved bracket entries.</p>
        </div>
        <div className="bracket-toolbar-meta">
          <div className="champion-chip">
            <span className="metric-label">Champion</span>
            <strong>{champion || "TBD"}</strong>
          </div>
          <button className={`secondary-button ${debugLayout ? "secondary-button-active" : ""}`} onClick={() => setDebugLayout((current) => !current)} type="button">
            {debugLayout ? "Hide Layout Debug" : "Show Layout Debug"}
          </button>
        </div>
      </section>

      <section className="workspace-header">
        <EntryManager
          activeEntry={activeEntry}
          activeEntryId={workspace.activeEntryId}
          draftName={entryNameDraft}
          entries={workspace.entries}
          onCreateEntry={handleCreateEntry}
          onDeleteEntry={handleDeleteEntry}
          onRenameDraft={setEntryNameDraft}
          onRenameEntry={handleRenameEntry}
          onSelectEntry={handleSelectEntry}
        />
        <div className="save-controls-wrap">
          <SaveBracketControls
            autoFillBusy={autoFillBusy}
            autoFillMode={selectedAutoFillMode.id}
            autoFillModeDescription={selectedAutoFillMode.description}
            autoFillModeOptions={AUTO_FILL_MODE_OPTIONS}
            onAutoFill={() => handleAutoFill(false)}
            onAutoFillModeChange={setAutoFillMode}
            onAutoFillOverwrite={() => handleAutoFill(true)}
            onExport={handleExport}
            onImport={handleImport}
            onReset={handleReset}
            onSave={handleSave}
            saveLabel="Save Entry"
            saveStatus={saveStatus}
          />
        </div>
      </section>

      <div className="bracket-board-shell">
        <BracketBoard
          debugLayout={debugLayout}
          definition={bracketDefinition}
          getTeams={(matchupId) => getMatchupTeams(bracketDefinition, bracketState, matchupId)}
          getWinner={(matchupId) => bracketState.picks[matchupId]}
          onDetails={(matchup) => setSelectedMatchup(matchup)}
          onPick={handlePick}
        />
      </div>

      <MatchupDetailsModal
        matchup={selectedMatchup}
        onClose={() => setSelectedMatchup(null)}
        onPick={(winner) => handlePickFromModal(selectedMatchup.id, winner)}
        prediction={selectedPrediction}
        teams={selectedTeams}
        winner={selectedMatchup ? bracketState.picks[selectedMatchup.id] : null}
      />
    </section>
  );
}
