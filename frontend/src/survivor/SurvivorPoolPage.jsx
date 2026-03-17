import { useEffect, useMemo, useState } from "react";

import { bracketDefinition } from "../bracket/bracketDefinition";
import { createBracketState } from "../bracket/bracketState";
import { useLiveBracketFeed } from "../bracket/liveBracketProvider";
import AdminToolsSection from "./AdminToolsSection";
import PlayerManagementSection from "./PlayerManagementSection";
import PickEntrySection from "./PickEntrySection";
import PoolDashboard from "./PoolDashboard";
import ResultsProcessorSection from "./ResultsProcessorSection";
import SurvivorPoolManager from "./SurvivorPoolManager";
import {
  addSurvivorPool,
  createPoolName,
  createSurvivorPoolEntry,
  deleteSurvivorPool,
  getActiveSurvivorPoolEntry,
  loadSurvivorPoolWorkspace,
  renameSurvivorPool,
  saveSurvivorPoolWorkspace,
  setActiveSurvivorPool,
  updateSurvivorPoolEntry,
} from "./survivorPoolStorage.js";
import {
  SURVIVOR_ROUND_CONFIG,
  buildRoundContext,
  clearPlayerRoundPicks,
  createPlayer,
  createPool,
  getLegalTeamOptionsForPlayer,
  getActivePlayers,
  getCurrentRoundContext,
  getEliminatedPlayers,
  getNextRoundContext,
  getPlayerRoundPick,
  getRoundLockStatus,
  processRoundResults,
  recomputePoolState,
  resetPoolProgress,
  rollbackPoolToRound,
  setPlayerRoundPicks,
} from "./survivorPoolUtils.js";

function createTeamLookup(definition, officialBracketState, gamesByMatchupId) {
  const lookup = new Map();
  SURVIVOR_ROUND_CONFIG.forEach((round) => {
    const context = buildRoundContext(definition, officialBracketState, gamesByMatchupId, round.roundKey);
    context?.availableTeams?.forEach((team) => {
      lookup.set(team.id, team.name);
    });
    context?.unresolvedTeams?.forEach((team) => {
      lookup.set(team.id, team.name);
    });
  });
  return lookup;
}

function createDraftKey(poolId, playerId, roundKey) {
  if (!poolId || !playerId || !roundKey) return "";
  return `${poolId}::${playerId}::${roundKey}`;
}

function sameTeamIds(left = [], right = []) {
  return left.length === right.length && left.every((teamId, index) => teamId === right[index]);
}

export default function SurvivorPoolPage({ liveFeedOverride = null }) {
  const [workspace, setWorkspace] = useState(() => loadSurvivorPoolWorkspace());
  const [poolNameDraft, setPoolNameDraft] = useState("");
  const [pickError, setPickError] = useState("");
  const [resultsError, setResultsError] = useState("");
  const [resultsMessage, setResultsMessage] = useState("");
  const liveFeedFromStore = useLiveBracketFeed({ definition: bracketDefinition, disabled: Boolean(liveFeedOverride) });
  const liveFeed = liveFeedOverride || liveFeedFromStore;
  const fallbackBracketState = useMemo(() => createBracketState(bracketDefinition), []);
  const emptyGamesByMatchupId = useMemo(() => ({}), []);
  const officialBracketState = liveFeed.view?.bracketState || fallbackBracketState;
  const gamesByMatchupId = liveFeed.view?.games || emptyGamesByMatchupId;

  const activePoolEntry = useMemo(() => getActiveSurvivorPoolEntry(workspace), [workspace]);
  const pool = activePoolEntry?.pool || createPool();
  const selectedPlayerId = activePoolEntry?.ui?.selectedPlayerId || "";
  const rollbackRoundKey = activePoolEntry?.ui?.rollbackRoundKey || "";
  const adminMode = Boolean(activePoolEntry?.ui?.adminMode);
  const draftPickSelections = activePoolEntry?.draftPicks || {};
  const poolEntries = useMemo(
    () => workspace.survivorPoolOrder.map((poolId) => workspace.survivorPoolsById[poolId]).filter(Boolean),
    [workspace],
  );

  useEffect(() => {
    saveSurvivorPoolWorkspace(workspace);
  }, [workspace]);

  useEffect(() => {
    setWorkspace((current) =>
      updateSurvivorPoolEntry(current, current.activeSurvivorPoolId, (entry) => ({
        pool: recomputePoolState(entry.pool, bracketDefinition, officialBracketState, gamesByMatchupId),
      })),
    );
  }, [officialBracketState, gamesByMatchupId]);

  const currentRound = useMemo(
    () => getCurrentRoundContext(bracketDefinition, officialBracketState, gamesByMatchupId, pool.processedRoundKeys),
    [gamesByMatchupId, officialBracketState, pool.processedRoundKeys],
  );
  const nextRound = useMemo(
    () => getNextRoundContext(bracketDefinition, officialBracketState, gamesByMatchupId, pool.processedRoundKeys),
    [gamesByMatchupId, officialBracketState, pool.processedRoundKeys],
  );
  const teamLookup = useMemo(
    () => createTeamLookup(bracketDefinition, officialBracketState, gamesByMatchupId),
    [gamesByMatchupId, officialBracketState],
  );
  const activePlayers = useMemo(() => getActivePlayers(pool), [pool]);
  const eliminatedPlayers = useMemo(() => getEliminatedPlayers(pool), [pool]);
  const selectedPlayer = pool.players.find((player) => player.id === selectedPlayerId) || null;
  const currentSavedPick = useMemo(
    () => (selectedPlayer && currentRound ? getPlayerRoundPick(selectedPlayer, currentRound.roundKey) : null),
    [currentRound, selectedPlayer],
  );
  const currentDraftKey = useMemo(
    () => createDraftKey(pool.id, selectedPlayerId, currentRound?.roundKey),
    [currentRound?.roundKey, pool.id, selectedPlayerId],
  );
  const selectedTeamIds = useMemo(() => {
    if (!currentDraftKey) return [];
    if (Object.prototype.hasOwnProperty.call(draftPickSelections, currentDraftKey)) {
      return draftPickSelections[currentDraftKey];
    }
    return currentSavedPick?.teamIds || [];
  }, [currentDraftKey, currentSavedPick, draftPickSelections]);
  const roundLock = useMemo(() => getRoundLockStatus(currentRound, new Date()), [currentRound]);

  useEffect(() => {
    setPoolNameDraft(activePoolEntry?.name || "");
  }, [activePoolEntry?.id, activePoolEntry?.name]);

  useEffect(() => {
    if (selectedPlayerId && pool.players.some((player) => player.id === selectedPlayerId && !player.eliminated)) return;
    const nextPlayer = pool.players.find((player) => !player.eliminated);
    const nextSelectedPlayerId = nextPlayer?.id || "";
    if (nextSelectedPlayerId === selectedPlayerId) return;
    setWorkspace((current) =>
      updateSurvivorPoolEntry(current, current.activeSurvivorPoolId, (entry) => ({
        ui: {
          ...entry.ui,
          selectedPlayerId: nextSelectedPlayerId,
        },
      })),
    );
  }, [pool.players, selectedPlayerId]);

  useEffect(() => {
    if (!currentDraftKey) {
      setPickError("");
      setResultsError("");
      return;
    }
    setPickError("");
    setResultsError("");
  }, [currentDraftKey]);

  useEffect(() => {
    if (!currentDraftKey || !selectedPlayer || !currentRound) return;
    const draftTeamIds = draftPickSelections[currentDraftKey];
    if (!draftTeamIds) return;

    const legalTeamIds = new Set(getLegalTeamOptionsForPlayer(selectedPlayer, currentRound).map((team) => team.id));
    const nextDraftTeamIds = draftTeamIds.filter((teamId) => legalTeamIds.has(teamId));
    if (sameTeamIds(draftTeamIds, nextDraftTeamIds)) return;

    setWorkspace((current) =>
      updateSurvivorPoolEntry(current, current.activeSurvivorPoolId, (entry) => ({
        draftPicks: {
          ...entry.draftPicks,
          [currentDraftKey]: nextDraftTeamIds,
        },
      })),
    );
    setPickError("Some draft picks were removed because they are no longer available for this round.");
  }, [currentDraftKey, currentRound, draftPickSelections, selectedPlayer]);

  function updateActivePoolEntry(updater) {
    setWorkspace((current) => updateSurvivorPoolEntry(current, current.activeSurvivorPoolId, updater));
  }

  function updatePool(updater) {
    updateActivePoolEntry((entry) => ({
      pool: typeof updater === "function" ? updater(entry.pool) : updater,
    }));
  }

  function setSelectedPlayerId(nextPlayerId) {
    updateActivePoolEntry((entry) => ({
      ui: {
        ...entry.ui,
        selectedPlayerId: nextPlayerId,
      },
    }));
  }

  function setRollbackRoundKey(nextRoundKey) {
    updateActivePoolEntry((entry) => ({
      ui: {
        ...entry.ui,
        rollbackRoundKey: nextRoundKey,
      },
    }));
  }

  function setAdminMode(updater) {
    updateActivePoolEntry((entry) => ({
      ui: {
        ...entry.ui,
        adminMode: typeof updater === "function" ? updater(Boolean(entry.ui?.adminMode)) : Boolean(updater),
      },
    }));
  }

  function setSelectedTeamIds(updater) {
    if (!currentDraftKey) return;
    updateActivePoolEntry((entry) => {
      const baseTeamIds = Object.prototype.hasOwnProperty.call(entry.draftPicks, currentDraftKey) ? entry.draftPicks[currentDraftKey] : currentSavedPick?.teamIds || [];
      const nextTeamIds = typeof updater === "function" ? updater(baseTeamIds) : updater;
      if (Object.prototype.hasOwnProperty.call(entry.draftPicks, currentDraftKey) && sameTeamIds(baseTeamIds, nextTeamIds)) {
        return {};
      }
      return {
        draftPicks: {
          ...entry.draftPicks,
          [currentDraftKey]: [...nextTeamIds],
        },
      };
    });
  }

  function addPlayer() {
    updatePool((current) => ({
      ...current,
      players: [...current.players, createPlayer({ name: `Player ${current.players.length + 1}` })],
    }));
  }

  function renamePlayer(playerId, nextName) {
    updatePool((current) => ({
      ...current,
      players: current.players.map((player) => (player.id === playerId ? { ...player, name: nextName } : player)),
    }));
  }

  function removePlayer(playerId) {
    updatePool((current) => ({
      ...current,
      players: current.players.filter((player) => player.id !== playerId),
    }));
  }

  function handleCreatePool() {
    const requestedName = window.prompt("Name the new Survivor Pool.", createPoolName(poolEntries.length + 1));
    const nextName = requestedName?.trim() || createPoolName(poolEntries.length + 1);
    const nextPool = createPool({ name: nextName });
    const nextEntry = createSurvivorPoolEntry({
      id: nextPool.id,
      name: nextName,
      pool: nextPool,
      draftPicks: {},
    });
    setWorkspace((current) => addSurvivorPool(current, nextEntry));
    setPickError("");
    setResultsError("");
    setResultsMessage(`Created ${nextName}.`);
  }

  function handleRenamePool() {
    const nextName = poolNameDraft.trim();
    if (!nextName || !activePoolEntry) return;
    setWorkspace((current) => renameSurvivorPool(current, activePoolEntry.id, nextName));
    setResultsMessage("Pool renamed.");
  }

  function handleDeletePool() {
    if (!activePoolEntry) return;
    if (!window.confirm(`Delete ${activePoolEntry.name}? This only removes this Survivor Pool.`)) {
      return;
    }
    setWorkspace((current) => deleteSurvivorPool(current, activePoolEntry.id));
    setPickError("");
    setResultsError("");
    setResultsMessage(`Deleted ${activePoolEntry.name}.`);
  }

  function handleSubmitPicks() {
    if (!currentRound) {
      setPickError("The official tournament round has not loaded yet.");
      return;
    }

    const result = setPlayerRoundPicks(pool, selectedPlayerId, currentRound, selectedTeamIds, new Date(), { adminOverride: adminMode });
    if (result.error) {
      setPickError(result.error);
      return;
    }

    updateActivePoolEntry((entry) => {
      const nextDraftPicks = { ...entry.draftPicks };
      if (currentDraftKey) {
        delete nextDraftPicks[currentDraftKey];
      }
      return {
        pool: result.pool,
        draftPicks: nextDraftPicks,
      };
    });
    setPickError("");
    setResultsError("");
    setResultsMessage("Round picks saved.");
  }

  function handleProcessResults() {
    if (!currentRound) {
      setResultsError("No official round is available to process.");
      return;
    }
    const result = processRoundResults(
      pool,
      currentRound,
      nextRound,
      bracketDefinition,
      officialBracketState,
      gamesByMatchupId,
    );
    if (result.error) {
      setResultsError(result.error);
      return;
    }

    updatePool(result.pool);
    setResultsError("");
    setPickError("");
    setResultsMessage(currentRound.roundKey === "championship" ? "Championship results processed." : `${currentRound.tournamentLabel} results processed.`);
  }

  function handleClearCurrentPicks() {
    if (!currentRound || !selectedPlayerId) return;
    updateActivePoolEntry((entry) => {
      const nextDraftPicks = { ...entry.draftPicks };
      if (currentDraftKey) {
        delete nextDraftPicks[currentDraftKey];
      }
      return {
        pool: clearPlayerRoundPicks(entry.pool, selectedPlayerId, currentRound.roundKey),
        draftPicks: nextDraftPicks,
      };
    });
    setPickError("");
    setResultsMessage("Current round picks cleared for the selected player.");
  }

  function handleRollbackRound() {
    if (!rollbackRoundKey) return;
    updateActivePoolEntry((entry) => ({
      pool: rollbackPoolToRound(entry.pool, rollbackRoundKey, bracketDefinition, officialBracketState, gamesByMatchupId),
      ui: {
        ...entry.ui,
        rollbackRoundKey: "",
      },
    }));
    setPickError("");
    setResultsError("");
    const label = SURVIVOR_ROUND_CONFIG.find((round) => round.roundKey === rollbackRoundKey)?.tournamentLabel || rollbackRoundKey;
    setResultsMessage(`Pool rolled back to ${label}.`);
  }

  function handleResetPool() {
    if (!window.confirm(`Reset ${pool.name}? This clears every pick, elimination, and processed round while keeping the player list.`)) {
      return;
    }
    updateActivePoolEntry((entry) => ({
      pool: resetPoolProgress(entry.pool),
      draftPicks: {},
      ui: {
        ...entry.ui,
        rollbackRoundKey: "",
      },
    }));
    setPickError("");
    setResultsError("");
    setResultsMessage("Survivor Pool reset to Round of 64.");
  }

  return (
    <section className="mode-panel survivor-mode">
      <section className="survivor-hero">
        <div className="survivor-hero-copy">
          <div className="eyebrow">Survivor Pool</div>
          <h2>March Madness survivor, driven by the official bracket</h2>
          <p className="subtle">
            Create multiple pools, manage separate player groups, and score each pool against the same official March Madness bracket.
          </p>
          {adminMode ? <div className="save-status">Admin Override Enabled: round locks can be bypassed for corrections.</div> : null}
          {liveFeed.error ? <div className="inline-error">{liveFeed.error}</div> : null}
        </div>
        <div className="survivor-hero-meta">
          <div className="champion-chip">
            <span className="metric-label">Active Pool</span>
            <strong>{pool.name}</strong>
          </div>
          <div className="champion-chip">
            <span className="metric-label">Current Round</span>
            <strong>{currentRound?.tournamentLabel || "Tournament complete"}</strong>
          </div>
          <div className="champion-chip">
            <span className="metric-label">Official Feed</span>
            <strong>{liveFeed.mode === "espn" ? "ESPN" : "Mock"}</strong>
          </div>
        </div>
      </section>

      <SurvivorPoolManager
        activePool={activePoolEntry}
        activePoolId={workspace.activeSurvivorPoolId}
        draftName={poolNameDraft}
        onCreatePool={handleCreatePool}
        onDeletePool={handleDeletePool}
        onRenameDraft={setPoolNameDraft}
        onRenamePool={handleRenamePool}
        onSelectPool={(poolId) => setWorkspace((current) => setActiveSurvivorPool(current, poolId))}
        pools={poolEntries}
      />

      <PoolDashboard
        activePlayers={activePlayers}
        currentRound={currentRound}
        eliminatedPlayers={eliminatedPlayers}
        pool={pool}
        processedRoundCount={pool.processedRoundKeys.length}
      />

      <PlayerManagementSection onAddPlayer={addPlayer} onRemovePlayer={removePlayer} onRenamePlayer={renamePlayer} pool={pool} />

      <PickEntrySection
        adminMode={adminMode}
        now={new Date()}
        onSubmitPicks={handleSubmitPicks}
        pickError={pickError}
        pool={pool}
        roundContext={currentRound}
        selectedPlayerId={selectedPlayerId}
        selectedTeamIds={selectedTeamIds}
        setPickError={setPickError}
        setSelectedPlayerId={setSelectedPlayerId}
        setSelectedTeamIds={setSelectedTeamIds}
      />

      <AdminToolsSection
        adminMode={adminMode}
        currentRound={currentRound}
        lockStatus={roundLock}
        onClearCurrentPicks={handleClearCurrentPicks}
        onToggleAdminMode={() => setAdminMode((current) => !current)}
        onResetPool={handleResetPool}
        onRollbackRound={handleRollbackRound}
        pool={pool}
        rollbackRoundKey={rollbackRoundKey}
        selectedPlayer={selectedPlayer}
        setRollbackRoundKey={setRollbackRoundKey}
      />

      <ResultsProcessorSection
        activePlayers={activePlayers}
        currentRound={currentRound}
        eliminatedPlayers={eliminatedPlayers}
        onProcessResults={handleProcessResults}
        pool={pool}
        resultsError={resultsError}
        resultsMessage={resultsMessage}
        roundContext={currentRound}
        teamLookup={teamLookup}
      />
    </section>
  );
}
