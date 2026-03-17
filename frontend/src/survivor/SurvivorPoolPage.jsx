import { useEffect, useMemo, useState } from "react";

import { bracketDefinition } from "../bracket/bracketDefinition";
import { createBracketState } from "../bracket/bracketState";
import { useLiveBracketFeed } from "../bracket/liveBracketProvider";
import AdminToolsSection from "./AdminToolsSection";
import PlayerManagementSection from "./PlayerManagementSection";
import PickEntrySection from "./PickEntrySection";
import PoolDashboard from "./PoolDashboard";
import ResultsProcessorSection from "./ResultsProcessorSection";
import { loadSurvivorPool, saveSurvivorPool } from "./survivorPoolStorage.js";
import {
  SURVIVOR_ROUND_CONFIG,
  buildRoundContext,
  clearPlayerRoundPicks,
  createPlayer,
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

export default function SurvivorPoolPage({ liveFeedOverride = null }) {
  const [pool, setPool] = useState(() => loadSurvivorPool());
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [pickError, setPickError] = useState("");
  const [resultsError, setResultsError] = useState("");
  const [resultsMessage, setResultsMessage] = useState("");
  const [rollbackRoundKey, setRollbackRoundKey] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const liveFeedFromStore = useLiveBracketFeed({ definition: bracketDefinition, disabled: Boolean(liveFeedOverride) });
  const liveFeed = liveFeedOverride || liveFeedFromStore;
  const fallbackBracketState = useMemo(() => createBracketState(bracketDefinition), []);
  const emptyGamesByMatchupId = useMemo(() => ({}), []);
  const officialBracketState = liveFeed.view?.bracketState || fallbackBracketState;
  const gamesByMatchupId = liveFeed.view?.games || emptyGamesByMatchupId;

  useEffect(() => {
    saveSurvivorPool(pool);
  }, [pool]);

  useEffect(() => {
    setPool((current) => recomputePoolState(current, bracketDefinition, officialBracketState, gamesByMatchupId));
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
  const roundLock = useMemo(() => getRoundLockStatus(currentRound, new Date()), [currentRound]);

  useEffect(() => {
    if (selectedPlayerId && pool.players.some((player) => player.id === selectedPlayerId && !player.eliminated)) return;
    const nextPlayer = pool.players.find((player) => !player.eliminated);
    setSelectedPlayerId(nextPlayer?.id || "");
  }, [pool.players, selectedPlayerId]);

  useEffect(() => {
    if (!selectedPlayerId || !currentRound) {
      setSelectedTeamIds([]);
      return;
    }
    const player = pool.players.find((entry) => entry.id === selectedPlayerId);
    const savedPick = player ? getPlayerRoundPick(player, currentRound.roundKey) : null;
    setSelectedTeamIds(savedPick?.teamIds || []);
    setPickError("");
    setResultsError("");
  }, [currentRound?.roundKey, pool.players, selectedPlayerId]);

  function updatePool(updater) {
    setPool((current) => (typeof updater === "function" ? updater(current) : updater));
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

    setPool(result.pool);
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

    setPool(result.pool);
    setResultsError("");
    setPickError("");
    setResultsMessage(currentRound.roundKey === "championship" ? "Championship results processed." : `${currentRound.tournamentLabel} results processed.`);
  }

  function handleClearCurrentPicks() {
    if (!currentRound || !selectedPlayerId) return;
    setPool((current) => clearPlayerRoundPicks(current, selectedPlayerId, currentRound.roundKey));
    setSelectedTeamIds([]);
    setPickError("");
    setResultsMessage("Current round picks cleared for the selected player.");
  }

  function handleRollbackRound() {
    if (!rollbackRoundKey) return;
    setPool((current) => rollbackPoolToRound(current, rollbackRoundKey, bracketDefinition, officialBracketState, gamesByMatchupId));
    setRollbackRoundKey("");
    setPickError("");
    setResultsError("");
    const label = SURVIVOR_ROUND_CONFIG.find((round) => round.roundKey === rollbackRoundKey)?.tournamentLabel || rollbackRoundKey;
    setResultsMessage(`Pool rolled back to ${label}.`);
  }

  function handleResetPool() {
    if (!window.confirm("Reset the Survivor Pool? This clears every pick, elimination, and processed round while keeping the player list.")) {
      return;
    }
    setPool((current) => resetPoolProgress(current));
    setSelectedTeamIds([]);
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
            Add players, pick surviving teams from the official bracket, and use host controls to correct mistakes without touching localStorage manually.
          </p>
          {adminMode ? <div className="save-status">Admin Override Enabled: round locks can be bypassed for corrections.</div> : null}
          {liveFeed.error ? <div className="inline-error">{liveFeed.error}</div> : null}
        </div>
        <div className="survivor-hero-meta">
          <div className="champion-chip">
            <span className="metric-label">Current Round</span>
            <strong>{currentRound?.tournamentLabel || "Tournament complete"}</strong>
          </div>
          <div className="champion-chip">
            <span className="metric-label">Picks This Round</span>
            <strong>{currentRound?.requiredPicks ?? 0}</strong>
          </div>
          <div className="champion-chip">
            <span className="metric-label">Official Feed</span>
            <strong>{liveFeed.mode === "espn" ? "ESPN" : "Mock"}</strong>
          </div>
        </div>
      </section>

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
