import { createBracketState, getMatchupTeams, getOrderedMatchups, setWinnerPick } from "./bracketState";
import { isPickableTeam, isPlaceholderTeam, sameTeam } from "./bracketTeams";

function getPredictableTeamVariants(team) {
  if (!team) return [];
  if (typeof team === "string") return [team];
  if (isPlaceholderTeam(team)) {
    return Array.isArray(team.teams) ? team.teams.filter((value) => typeof value === "string" && value) : [];
  }
  return [];
}

async function getCachedPrediction(teamA, teamB, predictMatchup, cache) {
  const key = `${teamA}__${teamB}`;
  if (!cache.has(key)) {
    cache.set(key, Promise.resolve(predictMatchup(teamA, teamB)));
  }
  return cache.get(key);
}

async function resolvePredictedWinner(teamA, teamB, predictMatchup, cache = new Map()) {
  if (!isPickableTeam(teamA) || !isPickableTeam(teamB)) return null;
  if (sameTeam(teamA, teamB)) return teamA;

  const teamAVariants = getPredictableTeamVariants(teamA);
  const teamBVariants = getPredictableTeamVariants(teamB);
  if (!teamAVariants.length || !teamBVariants.length) return null;

  let totalTeamAWinProb = 0;
  let totalComparisons = 0;

  for (const teamAName of teamAVariants) {
    for (const teamBName of teamBVariants) {
      if (teamAName === teamBName) {
        totalTeamAWinProb += 0.5;
        totalComparisons += 1;
        continue;
      }

      const prediction = await getCachedPrediction(teamAName, teamBName, predictMatchup, cache);
      const probability =
        typeof prediction?.win_probability_team_a === "number"
          ? prediction.win_probability_team_a
          : prediction?.predicted_winner === teamAName
            ? 1
            : 0;

      totalTeamAWinProb += probability;
      totalComparisons += 1;
    }
  }

  if (totalComparisons === 0) return null;
  return totalTeamAWinProb / totalComparisons >= 0.5 ? teamA : teamB;
}

async function autoFillBracket({ definition, overwrite = false, predictMatchup, state }) {
  const predictionCache = new Map();
  let nextState = overwrite
    ? createBracketState(definition, { initialAssignments: state.initialAssignments, picks: {} })
    : state;
  let filledMatchups = 0;

  for (const matchup of getOrderedMatchups(definition)) {
    if (matchup.round === "firstFour") continue;
    if (!overwrite && nextState.picks[matchup.id]) continue;

    const teams = getMatchupTeams(definition, nextState, matchup.id);
    if (teams.length !== 2 || teams.some((team) => !isPickableTeam(team))) continue;

    const winner = await resolvePredictedWinner(teams[0], teams[1], predictMatchup, predictionCache);
    if (!winner) continue;

    const before = nextState.picks[matchup.id];
    nextState = setWinnerPick(definition, nextState, matchup.id, winner);
    if (!sameTeam(before, nextState.picks[matchup.id])) {
      filledMatchups += 1;
    }
  }

  return {
    state: nextState,
    filledMatchups,
    requestCount: predictionCache.size,
  };
}

export { autoFillBracket, getPredictableTeamVariants, resolvePredictedWinner };
