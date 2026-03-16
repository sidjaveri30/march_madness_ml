import { getAllMatchups } from "../bracket/bracketDefinition";
import { getMatchupTeams } from "../bracket/bracketState";
import { getTeamId, getTeamName, isResolvedTeam } from "../bracket/bracketTeams";

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
    eliminationReason: "",
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
  const matchups = getRoundMatchups(definition, roundKey).map((matchup) => {
    const teams = getMatchupTeams(definition, officialBracketState, matchup.id);
    const gameInfo = gamesByMatchupId[matchup.id] || null;
    return {
      ...matchup,
      teams,
      gameInfo,
      resolvedTeams: teams.filter((team) => isResolvedTeam(team)).map((team) => ({
        id: getTeamId(team),
        name: getTeamName(team),
      })),
      winner: officialBracketState?.picks?.[matchup.id] || null,
    };
  });

  const availableTeams = matchups.flatMap((matchup) => matchup.resolvedTeams);
  const uniqueAvailableTeams = Array.from(new Map(availableTeams.map((team) => [team.id, team])).values());
  const roundComplete = matchups.length > 0 && matchups.every((matchup) => Boolean(matchup.winner));

  return {
    ...roundConfig,
    matchups,
    availableTeams: uniqueAvailableTeams,
    availableTeamIds: uniqueAvailableTeams.map((team) => team.id),
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
    const matchup = roundContext.matchups.find((entry) => entry.resolvedTeams.some((team) => team.id === teamId));
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

function processRoundResults(pool, roundContext, nextRoundContext = null) {
  if (!roundContext.roundComplete) {
    return {
      pool,
      error: "Wait until the official round is complete before processing survivor results.",
    };
  }

  const winningTeamIds = new Set(roundContext.matchups.map((matchup) => getTeamId(matchup.winner)).filter(Boolean));
  const nextPlayers = pool.players.map((player) => {
    if (player.eliminated) return player;

    const pick = getPlayerRoundPick(player, roundContext.roundKey);
    if (!pick || pick.teamIds.length !== roundContext.requiredPicks) {
      return {
        ...player,
        eliminated: true,
        eliminationReason: `${roundContext.label}: no valid picks submitted`,
      };
    }

    const survived = pick.teamIds.every((teamId) => winningTeamIds.has(teamId));
    const updatedPlayer = {
      ...player,
      eliminated: !survived,
      eliminationReason: survived ? "" : `${roundContext.label}: one or more picks lost`,
      usedTeamIds: survived ? Array.from(new Set([...player.usedTeamIds, ...pick.teamIds])) : player.usedTeamIds,
      picks: player.picks.map((entry) =>
        entry.roundKey === roundContext.roundKey
          ? {
              ...entry,
              wasCorrect: survived,
            }
          : entry,
      ),
    };

    if (!survived || !nextRoundContext) {
      return updatedPlayer;
    }

    const legalNextTeams = getLegalTeamOptionsForPlayer(updatedPlayer, nextRoundContext);
    if (legalNextTeams.length < nextRoundContext.requiredPicks) {
      return {
        ...updatedPlayer,
        eliminated: true,
        eliminationReason: `${nextRoundContext.label}: not enough unused teams remain`,
      };
    }

    return updatedPlayer;
  });

  return {
    pool: {
      ...pool,
      processedRoundKeys: [...pool.processedRoundKeys, roundContext.roundKey],
      players: nextPlayers,
    },
    error: "",
  };
}

function getPlayerUsedTeams(player, teamLookup) {
  return player.usedTeamIds.map((teamId) => teamLookup.get(teamId) || teamId);
}

export {
  SURVIVOR_ROUND_CONFIG,
  buildRoundContext,
  canPlayerMakeRoundPicks,
  createId,
  createPlayer,
  createPool,
  getActivePlayers,
  getCurrentRoundContext,
  getEliminatedPlayers,
  getGameStatus,
  getLegalTeamOptionsForPlayer,
  getNextRoundContext,
  getPlayerRoundPick,
  getPlayerUsedTeams,
  getRoundConfig,
  processRoundResults,
  setPlayerRoundPicks,
  validatePlayerRoundPicks,
};
