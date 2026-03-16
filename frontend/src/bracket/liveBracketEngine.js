import { getAllMatchups } from "./bracketDefinition";
import { applyWinnerPick, createBracketState, getMatchupTeams } from "./bracketState";
import { resolveLiveTeamKey, sameTeamKeys } from "./liveTeamIdentity";

const EMPTY_SECTIONS = { live: [], final: [], upcoming: [] };
const ROUND_ORDER = {
  firstFour: 0,
  firstRound: 1,
  secondRound: 2,
  sweet16: 3,
  elite8: 4,
  finalFour: 5,
  championship: 6,
};

function normalizeIncomingGame(game) {
  const status = game.status || "upcoming";
  const teamA = game.teamA || game.team_a || "";
  const teamB = game.teamB || game.team_b || "";
  const teamAKey = game.teamAKey || resolveLiveTeamKey(teamA);
  const teamBKey = game.teamBKey || resolveLiveTeamKey(teamB);
  const winner = game.winner || null;
  const winnerKey = game.winnerKey || (winner ? resolveLiveTeamKey(winner) : null);

  return {
    ...game,
    gameId: game.gameId || game.id || game.matchupId || `${teamAKey}__${teamBKey}`,
    matchupId: game.matchupId || null,
    teamA,
    teamB,
    teamAKey,
    teamBKey,
    winner,
    winnerKey,
    scoreA: game.scoreA ?? game.teamAScore ?? game.team_a_score ?? null,
    scoreB: game.scoreB ?? game.teamBScore ?? game.team_b_score ?? null,
    status,
    statusLabel: game.statusLabel || (status === "live" ? "LIVE" : status === "final" ? "FINAL" : "UPCOMING"),
    detail: game.detail || null,
    startTime: game.startTime || game.commenceTime || game.commence_time || null,
    round: game.round || null,
    region: game.region || null,
  };
}

function matchupTeamKeys(definition, bracketState, matchupId) {
  return getMatchupTeams(definition, bracketState, matchupId)
    .map((team) => (typeof team === "string" ? resolveLiveTeamKey(team) : null))
    .filter(Boolean);
}

function matchesTeams(expectedKeys, actualKeys) {
  if (expectedKeys.length !== 2 || actualKeys.length !== 2) return false;
  return (
    (sameTeamKeys(expectedKeys[0], actualKeys[0]) && sameTeamKeys(expectedKeys[1], actualKeys[1])) ||
    (sameTeamKeys(expectedKeys[0], actualKeys[1]) && sameTeamKeys(expectedKeys[1], actualKeys[0]))
  );
}

function findMatchingMatchup(definition, bracketState, game, usedMatchups, allMatchups) {
  if (game.matchupId && !usedMatchups.has(game.matchupId)) {
    return allMatchups.find((matchup) => matchup.id === game.matchupId) || null;
  }

  const actualKeys = [game.teamAKey, game.teamBKey];
  return (
    allMatchups.find((matchup) => {
      if (usedMatchups.has(matchup.id)) return false;
      return matchesTeams(matchupTeamKeys(definition, bracketState, matchup.id), actualKeys);
    }) || null
  );
}

function buildOfficialBracketView({ definition, games, id = "live-feed", label = "Live Feed", meta = {} }) {
  const allMatchups = getAllMatchups(definition);
  let bracketState = createBracketState(definition);
  const usedMatchups = new Set();
  const normalizedGames = games.map(normalizeIncomingGame);
  const unmatched = [...normalizedGames];
  const matchedGames = [];

  for (let pass = 0; pass < allMatchups.length && unmatched.length; pass += 1) {
    let matchedOnPass = false;
    for (let index = unmatched.length - 1; index >= 0; index -= 1) {
      const game = unmatched[index];
      const matchup = findMatchingMatchup(definition, bracketState, game, usedMatchups, allMatchups);
      if (!matchup) continue;

      const enriched = {
        ...game,
        matchupId: matchup.id,
        round: matchup.round,
        region: matchup.region,
        roundLabel: matchup.label,
      };
      matchedGames.push(enriched);
      unmatched.splice(index, 1);
      usedMatchups.add(matchup.id);
      matchedOnPass = true;

      if (enriched.status === "final" && enriched.winner) {
        const winnerName = sameTeamKeys(resolveLiveTeamKey(enriched.winner), enriched.teamAKey) ? enriched.teamA : enriched.teamB;
        bracketState = applyWinnerPick(definition, bracketState, matchup.id, winnerName);
      }
    }
    if (!matchedOnPass) break;
  }

  const unmatchedGames = unmatched.map((game) => ({
    ...game,
    matchupId: game.matchupId || `unmapped-${game.gameId}`,
  }));
  const orderedGames = [...matchedGames, ...unmatchedGames].sort((gameA, gameB) => {
    const roundA = ROUND_ORDER[gameA.round] ?? 99;
    const roundB = ROUND_ORDER[gameB.round] ?? 99;
    if (roundA !== roundB) return roundA - roundB;
    return String(gameA.matchupId).localeCompare(String(gameB.matchupId));
  });

  const sections = orderedGames.reduce(
    (accumulator, game) => {
      if (game.status === "live") accumulator.live.push(game);
      else if (game.status === "final") accumulator.final.push(game);
      else accumulator.upcoming.push(game);
      return accumulator;
    },
    { live: [], final: [], upcoming: [] },
  );

  return {
    id,
    label,
    bracketState,
    games: Object.fromEntries(matchedGames.map((game) => [game.matchupId, game])),
    orderedGames,
    sections,
    unmatchedGames,
    meta,
  };
}

export { EMPTY_SECTIONS, buildOfficialBracketView, normalizeIncomingGame };
