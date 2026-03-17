import { createBracketState, getMatchupTeams, getOrderedMatchups, setWinnerPick } from "./bracketState";
import { isPickableTeam, isPlaceholderTeam, sameTeam } from "./bracketTeams";
import { chooseWinnerByMode, DEFAULT_AUTO_FILL_MODE } from "./autoFillModes";

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

function buildSeedLookup(definition, state) {
  const seedLookup = new Map();
  getOrderedMatchups(definition).forEach((matchup) => {
    matchup.slots.forEach((slot) => {
      if (slot.source.type !== "input") return;
      const teamName = state.initialAssignments?.[slot.source.slotId];
      if (typeof teamName === "string" && teamName && slot.seed) {
        seedLookup.set(teamName, slot.seed);
      }
    });
  });
  return seedLookup;
}

async function resolvePredictedWinner(teamA, teamB, predictMatchup, options = {}) {
  const { cache = new Map(), matchup = null, mode = DEFAULT_AUTO_FILL_MODE, rng = Math.random, seedLookup = new Map() } = options;
  if (!isPickableTeam(teamA) || !isPickableTeam(teamB)) return null;
  if (sameTeam(teamA, teamB)) return teamA;

  const teamAVariants = getPredictableTeamVariants(teamA);
  const teamBVariants = getPredictableTeamVariants(teamB);
  if (!teamAVariants.length || !teamBVariants.length) return null;

  let totalTeamAWinProb = 0;
  let totalComparisons = 0;
  const featureSnapshotTotals = {};

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
      Object.entries(prediction?.feature_snapshot || {}).forEach(([key, value]) => {
        if (typeof value !== "number") return;
        featureSnapshotTotals[key] = (featureSnapshotTotals[key] || 0) + value;
      });
    }
  }

  if (totalComparisons === 0) return null;
  const averagedFeatureSnapshot = Object.fromEntries(
    Object.entries(featureSnapshotTotals).map(([key, value]) => [key, value / totalComparisons]),
  );
  const aggregatedPrediction = {
    team_a: teamA,
    team_b: teamB,
    predicted_winner: totalTeamAWinProb >= 0.5 ? teamA : teamB,
    win_probability_team_a: totalTeamAWinProb / totalComparisons,
    win_probability_team_b: 1 - totalTeamAWinProb / totalComparisons,
    feature_snapshot: averagedFeatureSnapshot,
  };

  const selection = chooseWinnerByMode({
    matchup,
    mode,
    prediction: aggregatedPrediction,
    rng,
    seedA: seedLookup.get(teamA),
    seedB: seedLookup.get(teamB),
    teamA,
    teamB,
  });
  return selection.winner;
}

async function autoFillBracket({ definition, mode = DEFAULT_AUTO_FILL_MODE, overwrite = false, predictMatchup, rng = Math.random, state }) {
  const predictionCache = new Map();
  const seedLookup = buildSeedLookup(definition, state);
  let nextState = overwrite
    ? createBracketState(definition, { initialAssignments: state.initialAssignments, picks: {} })
    : state;
  let filledMatchups = 0;

  for (const matchup of getOrderedMatchups(definition)) {
    if (matchup.round === "firstFour") continue;
    if (!overwrite && nextState.picks[matchup.id]) continue;

    const teams = getMatchupTeams(definition, nextState, matchup.id);
    if (teams.length !== 2 || teams.some((team) => !isPickableTeam(team))) continue;

    const winner = await resolvePredictedWinner(teams[0], teams[1], predictMatchup, {
      cache: predictionCache,
      matchup,
      mode,
      rng,
      seedLookup,
    });
    if (!winner) continue;

    const before = nextState.picks[matchup.id];
    nextState = setWinnerPick(definition, nextState, matchup.id, winner);
    if (!sameTeam(before, nextState.picks[matchup.id])) {
      filledMatchups += 1;
    }
  }

  return {
    mode,
    state: nextState,
    filledMatchups,
    requestCount: predictionCache.size,
  };
}

export { autoFillBracket, buildSeedLookup, getPredictableTeamVariants, resolvePredictedWinner };
