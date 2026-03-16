import { getAllMatchups } from "../bracket/bracketDefinition";
import { getMatchupTeams } from "../bracket/bracketState";
import { getTeamId, getTeamName, isPlaceholderTeam, isResolvedTeam } from "../bracket/bracketTeams";

const SURVIVOR_ROUND_CONFIG = [
  { roundKey: "firstRound", label: "Round 1", tournamentLabel: "Round of 64", requiredPicks: 3 },
  { roundKey: "secondRound", label: "Round 2", tournamentLabel: "Round of 32", requiredPicks: 2 },
  { roundKey: "sweet16", label: "Sweet 16", tournamentLabel: "Sweet 16", requiredPicks: 1 },
  { roundKey: "elite8", label: "Elite Eight", tournamentLabel: "Elite Eight", requiredPicks: 1 },
  { roundKey: "finalFour", label: "Final Four", tournamentLabel: "Final Four", requiredPicks: 1 },
  { roundKey: "championship", label: "Championship", tournamentLabel: "National Championship", requiredPicks: 1 },
];

function createId(prefix = "survivor") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPlayer(overrides = {}) {
  return {
    id: createId("player"),
    name: "Player 1",
    eliminated: false,
    eliminatedRound: "",
    eliminationReason: "",
    eliminationPickIds: [],
    picks: [],
    usedTeamIds: [],
    ...overrides,
  };
}

function createPool(overrides = {}) {
  return {
    id: createId("pool"),
    name: "March Madness Survivor Pool",
    players: [],
    processedRoundKeys: [],
    ...overrides,
  };
}

function clonePick(pick) {
  return {
    roundKey: pick.roundKey,
    teamIds: [...pick.teamIds],
    wasCorrect: typeof pick.wasCorrect === "boolean" ? pick.wasCorrect : null,
  };
}

function resetDerivedPlayerState(player) {
  return {
    ...player,
    eliminated: false,
    eliminatedRound: "",
    eliminationReason: "",
    eliminationPickIds: [],
    usedTeamIds: [],
    picks: player.picks.map((pick) => ({ ...clonePick(pick), wasCorrect: null })),
  };
}

function getActivePlayers(pool) {
  return pool.players.filter((player) => !player.eliminated);
}

function getEliminatedPlayers(pool) {
  return pool.players.filter((player) => player.eliminated);
}

function getPlayerRoundPick(player, roundKey) {
  return player.picks.find((pick) => pick.roundKey === roundKey) || null;
}

function getRoundConfig(roundKey) {
  return SURVIVOR_ROUND_CONFIG.find((round) => round.roundKey === roundKey) || null;
}

function getRoundMatchups(definition, roundKey) {
  return getAllMatchups(definition).filter((matchup) => matchup.round === roundKey);
}

function buildRoundContext(definition, officialBracketState, gamesByMatchupId = {}, roundKey) {
  const roundConfig = getRoundConfig(roundKey);
  if (!roundConfig) return null;

  const matchups = getRoundMatchups(definition, roundKey).map((matchup) => {
    const teams = getMatchupTeams(definition, officialBracketState, matchup.id);
    const gameInfo = gamesByMatchupId[matchup.id] || null;
    const resolvedTeams = teams.filter((team) => isResolvedTeam(team)).map((team) => ({
      id: getTeamId(team),
      name: getTeamName(team),
    }));
    const unresolvedTeams = teams.filter((team) => !isResolvedTeam(team)).map((team) => ({
      id: getTeamId(team),
      name: getTeamName(team),
      statusLabel: isPlaceholderTeam(team) ? "Play-in pending" : "Unavailable",
    }));

    return {
      ...matchup,
      teams,
      gameInfo,
      resolvedTeams,
      unresolvedTeams,
      winner: officialBracketState?.picks?.[matchup.id] || null,
    };
  });

  const availableTeams = matchups.flatMap((matchup) => matchup.resolvedTeams);
  const unresolvedTeams = Array.from(new Map(matchups.flatMap((matchup) => matchup.unresolvedTeams).map((team) => [team.id, team])).values());
  const uniqueAvailableTeams = Array.from(new Map(availableTeams.map((team) => [team.id, team])).values());
  const roundComplete = matchups.length > 0 && matchups.every((matchup) => Boolean(matchup.winner));

  return {
    ...roundConfig,
    matchups,
    availableTeams: uniqueAvailableTeams,
    availableTeamIds: uniqueAvailableTeams.map((team) => team.id),
    unresolvedTeams,
    roundComplete,
  };
}

function getCurrentRoundContext(definition, officialBracketState, gamesByMatchupId, processedRoundKeys = []) {
  const nextRound = SURVIVOR_ROUND_CONFIG.find((round) => !processedRoundKeys.includes(round.roundKey));
  if (!nextRound) return null;
  return buildRoundContext(definition, officialBracketState, gamesByMatchupId, nextRound.roundKey);
}

function getNextRoundContext(definition, officialBracketState, gamesByMatchupId, processedRoundKeys = []) {
  const currentIndex = SURVIVOR_ROUND_CONFIG.findIndex((round) => !processedRoundKeys.includes(round.roundKey));
  if (currentIndex < 0 || currentIndex >= SURVIVOR_ROUND_CONFIG.length - 1) return null;
  return buildRoundContext(definition, officialBracketState, gamesByMatchupId, SURVIVOR_ROUND_CONFIG[currentIndex + 1].roundKey);
}

function getGameStatus(gameInfo, now = new Date()) {
  if (!gameInfo) return "open";
  if (gameInfo.status === "live" || gameInfo.status === "final") return "locked";
  if (!gameInfo.startTime) return "open";
  const start = new Date(gameInfo.startTime);
  if (Number.isNaN(start.getTime())) return "open";
  return start <= now ? "locked" : "open";
}

function canPlayerMakeRoundPicks(player, roundContext) {
  if (!player) {
    return { allowed: false, message: "Select a player first." };
  }
  if (player.eliminated) {
    return { allowed: false, message: "Eliminated players cannot make picks." };
  }
  if (!roundContext || !roundContext.availableTeams.length) {
    return { allowed: false, message: "Official round teams are not fully available yet." };
  }
  if (getLegalTeamOptionsForPlayer(player, roundContext).length < roundContext.requiredPicks) {
    return { allowed: false, message: "This player does not have enough unused teams left for the current round." };
  }
  return { allowed: true, message: "" };
}

function getLegalTeamOptionsForPlayer(player, roundContext) {
  const usedTeamIds = new Set(player?.usedTeamIds || []);
  return roundContext.availableTeams.filter((team) => !usedTeamIds.has(team.id));
}

function validatePlayerRoundPicks(player, roundContext, teamIds, now = new Date()) {
  const eligibility = canPlayerMakeRoundPicks(player, roundContext);
  if (!eligibility.allowed) return eligibility;

  const cleanedTeamIds = Array.isArray(teamIds) ? teamIds.filter(Boolean) : [];
  if (cleanedTeamIds.length !== roundContext.requiredPicks) {
    return { allowed: false, message: `Select exactly ${roundContext.requiredPicks} team${roundContext.requiredPicks === 1 ? "" : "s"} this round.` };
  }
  if (new Set(cleanedTeamIds).size !== cleanedTeamIds.length) {
    return { allowed: false, message: "You cannot select the same team twice in one round." };
  }

  const legalTeamIds = new Set(getLegalTeamOptionsForPlayer(player, roundContext).map((team) => team.id));
  for (const teamId of cleanedTeamIds) {
    if (!legalTeamIds.has(teamId)) {
      return { allowed: false, message: "That team is not available for this player in the current round." };
    }
    const matchup = findMatchupForTeam(roundContext, teamId);
    if (matchup?.gameInfo && getGameStatus(matchup.gameInfo, now) === "locked") {
      return { allowed: false, message: "Picks lock once the relevant game starts." };
    }
  }

  return { allowed: true, message: "" };
}

function setPlayerRoundPicks(pool, playerId, roundContext, teamIds, now = new Date()) {
  const player = pool.players.find((entry) => entry.id === playerId);
  const validation = validatePlayerRoundPicks(player, roundContext, teamIds, now);
  if (!validation.allowed) {
    return { pool, error: validation.message };
  }

  const nextPool = {
    ...pool,
    players: pool.players.map((entry) => {
      if (entry.id !== playerId) return entry;
      const nextPick = {
        roundKey: roundContext.roundKey,
        teamIds: [...teamIds],
        wasCorrect: null,
      };
      const existing = getPlayerRoundPick(entry, roundContext.roundKey);
      return {
        ...entry,
        picks: existing
          ? entry.picks.map((pick) => (pick.roundKey === roundContext.roundKey ? nextPick : pick))
          : [...entry.picks, nextPick],
      };
    }),
  };

  return { pool: nextPool, error: "" };
}

function clearPlayerRoundPicks(pool, playerId, roundKey) {
  return {
    ...pool,
    players: pool.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            picks: player.picks.filter((pick) => pick.roundKey !== roundKey),
          }
        : player,
    ),
  };
}

function resetPoolProgress(pool) {
  return {
    ...pool,
    processedRoundKeys: [],
    players: pool.players.map((player) =>
      createPlayer({
        id: player.id,
        name: player.name,
      }),
    ),
  };
}

function findMatchupForTeam(roundContext, teamId) {
  return roundContext?.matchups?.find((matchup) => matchup.resolvedTeams.some((team) => team.id === teamId)) || null;
}

function getMatchupTeamSnapshot(matchup, teamId) {
  const teamIndex = matchup?.resolvedTeams?.findIndex((team) => team.id === teamId);
  if (teamIndex < 0) return null;

  const isTeamA = teamIndex === 0;
  const score = isTeamA ? matchup.gameInfo?.scoreA : matchup.gameInfo?.scoreB;
  const opponentScore = isTeamA ? matchup.gameInfo?.scoreB : matchup.gameInfo?.scoreA;

  return {
    score,
    opponentScore,
    isTeamA,
  };
}

function getPickStatus(roundContext, teamId) {
  const matchup = findMatchupForTeam(roundContext, teamId);
  if (!matchup) {
    return { code: "missing", label: "Unavailable", icon: "?", tone: "muted" };
  }

  if (matchup.winner) {
    const won = getTeamId(matchup.winner) === teamId;
    return {
      code: won ? "won" : "lost",
      label: won ? "Won" : "Lost",
      icon: won ? "check" : "x",
      tone: won ? "success" : "danger",
    };
  }

  if (matchup.gameInfo?.status === "live") {
    const snapshot = getMatchupTeamSnapshot(matchup, teamId);
    if (snapshot && Number.isFinite(snapshot.score) && Number.isFinite(snapshot.opponentScore)) {
      if (snapshot.score > snapshot.opponentScore) {
        return { code: "live-leading", label: "LIVE leading", icon: "live", tone: "success" };
      }
      if (snapshot.score < snapshot.opponentScore) {
        return { code: "live-trailing", label: "LIVE trailing", icon: "live", tone: "danger" };
      }
    }
    return { code: "live", label: "LIVE", icon: "live", tone: "accent" };
  }

  if (matchup.gameInfo?.status === "final") {
    const snapshot = getMatchupTeamSnapshot(matchup, teamId);
    if (snapshot && Number.isFinite(snapshot.score) && Number.isFinite(snapshot.opponentScore)) {
      const won = snapshot.score > snapshot.opponentScore;
      return {
        code: won ? "won" : "lost",
        label: won ? "Won" : "Lost",
        icon: won ? "check" : "x",
        tone: won ? "success" : "danger",
      };
    }
  }

  return { code: "pending", label: "Pending", icon: "pending", tone: "muted" };
}

function teamNamesFromIds(teamIds, teamLookup) {
  return teamIds.map((teamId) => teamLookup.get(teamId) || teamId);
}

function applyProcessedRoundToPool(pool, roundContext, nextRoundContext = null) {
  const teamLookup = new Map(roundContext.availableTeams.map((team) => [team.id, team.name]));
  const winningTeamIds = new Set(roundContext.matchups.map((matchup) => getTeamId(matchup.winner)).filter(Boolean));

  return {
    ...pool,
    players: pool.players.map((player) => {
      if (player.eliminated) return player;

      const pick = getPlayerRoundPick(player, roundContext.roundKey);
      if (!pick || pick.teamIds.length !== roundContext.requiredPicks) {
        return {
          ...player,
          eliminated: true,
          eliminatedRound: roundContext.roundKey,
          eliminationReason: `${roundContext.tournamentLabel}: no valid picks submitted`,
          eliminationPickIds: [],
        };
      }

      const losingPickIds = pick.teamIds.filter((teamId) => !winningTeamIds.has(teamId));
      const nextPlayer = {
        ...player,
        picks: player.picks.map((entry) =>
          entry.roundKey === roundContext.roundKey
            ? {
                ...entry,
                wasCorrect: losingPickIds.length === 0,
              }
            : entry,
        ),
      };

      if (losingPickIds.length > 0) {
        return {
          ...nextPlayer,
          eliminated: true,
          eliminatedRound: roundContext.roundKey,
          eliminationPickIds: losingPickIds,
          eliminationReason: `${roundContext.tournamentLabel}: incorrect pick ${teamNamesFromIds(losingPickIds, teamLookup).join(", ")}`,
        };
      }

      const progressedPlayer = {
        ...nextPlayer,
        usedTeamIds: Array.from(new Set([...nextPlayer.usedTeamIds, ...pick.teamIds])),
      };

      if (!nextRoundContext) {
        return progressedPlayer;
      }

      const legalNextTeams = getLegalTeamOptionsForPlayer(progressedPlayer, nextRoundContext);
      if (legalNextTeams.length < nextRoundContext.requiredPicks) {
        return {
          ...progressedPlayer,
          eliminated: true,
          eliminatedRound: nextRoundContext.roundKey,
          eliminationPickIds: [],
          eliminationReason: `${nextRoundContext.tournamentLabel}: not enough unused teams remain`,
        };
      }

      return progressedPlayer;
    }),
  };
}

function recomputePoolState(pool, definition, officialBracketState, gamesByMatchupId = {}) {
  const processedRoundKeys = SURVIVOR_ROUND_CONFIG.filter((round) => pool.processedRoundKeys.includes(round.roundKey)).map((round) => round.roundKey);
  let nextPool = {
    ...pool,
    processedRoundKeys,
    players: pool.players.map(resetDerivedPlayerState),
  };

  for (let index = 0; index < processedRoundKeys.length; index += 1) {
    const roundKey = processedRoundKeys[index];
    const roundContext = buildRoundContext(definition, officialBracketState, gamesByMatchupId, roundKey);
    const nextRoundContext =
      index < SURVIVOR_ROUND_CONFIG.length - 1
        ? buildRoundContext(definition, officialBracketState, gamesByMatchupId, SURVIVOR_ROUND_CONFIG[index + 1]?.roundKey)
        : null;
    nextPool = applyProcessedRoundToPool(nextPool, roundContext, nextRoundContext);
  }

  return nextPool;
}

function processRoundResults(pool, roundContext, nextRoundContext = null, definition, officialBracketState, gamesByMatchupId = {}) {
  if (!roundContext.roundComplete) {
    return {
      pool,
      error: "Wait until the official round is complete before processing survivor results.",
    };
  }

  const nextProcessed = Array.from(new Set([...pool.processedRoundKeys, roundContext.roundKey]));
  const nextPool = recomputePoolState(
    {
      ...pool,
      processedRoundKeys: nextProcessed,
    },
    definition,
    officialBracketState,
    gamesByMatchupId,
  );

  return {
    pool: nextPool,
    error: "",
  };
}

function rollbackPoolToRound(pool, roundKey, definition, officialBracketState, gamesByMatchupId = {}) {
  const rollbackIndex = SURVIVOR_ROUND_CONFIG.findIndex((round) => round.roundKey === roundKey);
  if (rollbackIndex < 0) return pool;

  const keptProcessed = SURVIVOR_ROUND_CONFIG.slice(0, rollbackIndex)
    .map((round) => round.roundKey)
    .filter((entry) => pool.processedRoundKeys.includes(entry));

  const nextPool = {
    ...pool,
    processedRoundKeys: keptProcessed,
  };

  return recomputePoolState(nextPool, definition, officialBracketState, gamesByMatchupId);
}

function getPlayerUsedTeams(player, teamLookup) {
  return player.usedTeamIds.map((teamId) => teamLookup.get(teamId) || teamId);
}

function getPlayerRoundHistory(player, teamLookup) {
  return SURVIVOR_ROUND_CONFIG.map((round) => {
    const pick = getPlayerRoundPick(player, round.roundKey);
    return {
      ...round,
      pick,
      teamNames: pick ? teamNamesFromIds(pick.teamIds, teamLookup) : [],
      wasCorrect: pick?.wasCorrect ?? null,
      wasEliminatedRound: player.eliminatedRound === round.roundKey,
    };
  }).filter((entry) => entry.pick || entry.wasEliminatedRound);
}

function getPlayerCurrentRoundStatuses(player, roundContext, teamLookup) {
  const pick = getPlayerRoundPick(player, roundContext?.roundKey);
  if (!pick) return [];
  return pick.teamIds.map((teamId) => ({
    teamId,
    teamName: teamLookup.get(teamId) || teamId,
    ...getPickStatus(roundContext, teamId),
  }));
}

export {
  SURVIVOR_ROUND_CONFIG,
  buildRoundContext,
  canPlayerMakeRoundPicks,
  clearPlayerRoundPicks,
  createId,
  createPlayer,
  createPool,
  findMatchupForTeam,
  getActivePlayers,
  getCurrentRoundContext,
  getEliminatedPlayers,
  getGameStatus,
  getLegalTeamOptionsForPlayer,
  getNextRoundContext,
  getPickStatus,
  getPlayerCurrentRoundStatuses,
  getPlayerRoundHistory,
  getPlayerRoundPick,
  getPlayerUsedTeams,
  getRoundConfig,
  processRoundResults,
  recomputePoolState,
  resetPoolProgress,
  rollbackPoolToRound,
  setPlayerRoundPicks,
  validatePlayerRoundPicks,
};
