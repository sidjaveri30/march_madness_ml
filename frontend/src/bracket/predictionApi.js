import { fetchJson } from "../apiClient.js";
import { resolvePredictionTeamName } from "./teamNameResolver.js";

function shouldSuppressFallbackReason(reason = "") {
  return /unknown team|unknown predictor team mapping/i.test(reason);
}

function inferSeedFallbackProbability(seedA, seedB) {
  const numericSeedA = Number(seedA);
  const numericSeedB = Number(seedB);
  if (!Number.isFinite(numericSeedA) || !Number.isFinite(numericSeedB) || numericSeedA === numericSeedB) {
    return 0.5;
  }

  const seedDiff = numericSeedB - numericSeedA;
  let probabilityTeamA = 1 / (1 + Math.exp(-seedDiff / 6));
  const favoriteSeed = Math.min(numericSeedA, numericSeedB);
  const underdogSeed = Math.max(numericSeedA, numericSeedB);
  const gap = underdogSeed - favoriteSeed;

  if (favoriteSeed <= 2 && gap >= 12) probabilityTeamA = numericSeedA < numericSeedB ? 0.965 : 0.035;
  else if (favoriteSeed <= 4 && gap >= 9) probabilityTeamA = numericSeedA < numericSeedB ? Math.max(probabilityTeamA, 0.9) : Math.min(probabilityTeamA, 0.1);
  else if (favoriteSeed <= 6 && gap >= 7) probabilityTeamA = numericSeedA < numericSeedB ? Math.max(probabilityTeamA, 0.78) : Math.min(probabilityTeamA, 0.22);

  return Math.min(0.985, Math.max(0.015, probabilityTeamA));
}

function buildSyntheticFallbackPrediction(teamA, teamB, options = {}, reason = "") {
  const probabilityTeamA = inferSeedFallbackProbability(options.seedA, options.seedB);
  return {
    team_a: teamA,
    team_b: teamB,
    predicted_winner: probabilityTeamA >= 0.5 ? teamA : teamB,
    win_probability_team_a: probabilityTeamA,
    win_probability_team_b: 1 - probabilityTeamA,
    predicted_margin: null,
    top_reasons: [
      shouldSuppressFallbackReason(reason)
        ? "Seed-based fallback used for this matchup."
        : reason
          ? `Seed-based fallback used: ${reason}`
          : "Seed-based fallback used for this matchup.",
    ],
    feature_snapshot: {},
  };
}

async function fetchOddsFallbackPrediction(apiUrl, teamA, teamB, reason = "") {
  const params = new URLSearchParams({
    team_a: teamA,
    team_b: teamB,
  });
  const odds = await fetchJson(`${apiUrl}/odds?${params.toString()}`, {
    errorMessage: "Prediction unavailable",
  });

  const probabilityTeamA = odds?.consensus?.team_a_implied_prob_avg;
  const probabilityTeamB = odds?.consensus?.team_b_implied_prob_avg;
  if (!odds?.event_found || typeof probabilityTeamA !== "number" || typeof probabilityTeamB !== "number") {
    throw new Error(reason || odds?.message || "Prediction unavailable");
  }

  return {
    team_a: teamA,
    team_b: teamB,
    predicted_winner: probabilityTeamA >= probabilityTeamB ? teamA : teamB,
    win_probability_team_a: probabilityTeamA,
    win_probability_team_b: probabilityTeamB,
    predicted_margin: null,
    top_reasons: shouldSuppressFallbackReason(reason)
      ? ["Market fallback used for this matchup."]
      : reason
        ? [`Market fallback used: ${reason}`]
        : ["Market fallback used."],
    feature_snapshot: {},
  };
}

async function fetchMatchupPrediction(apiUrl, teamA, teamB, options = {}) {
  let canonicalTeamA = teamA;
  let canonicalTeamB = teamB;

  try {
    canonicalTeamA = await resolvePredictionTeamName(apiUrl, teamA);
    canonicalTeamB = await resolvePredictionTeamName(apiUrl, teamB);
  } catch (error) {
    try {
      return await fetchOddsFallbackPrediction(apiUrl, teamA, teamB, error?.message || "Unknown team mapping");
    } catch (fallbackError) {
      return buildSyntheticFallbackPrediction(teamA, teamB, options, fallbackError?.message || error?.message || "Unknown team mapping");
    }
  }

  try {
    return await fetchJson(`${apiUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_a: canonicalTeamA,
        team_b: canonicalTeamB,
        neutral_site: options.neutralSite ?? true,
      }),
      errorMessage: "Prediction unavailable",
    });
  } catch (error) {
    if (/unknown team/i.test(error?.message || "")) {
      try {
        return await fetchOddsFallbackPrediction(apiUrl, teamA, teamB, error.message);
      } catch (fallbackError) {
        return buildSyntheticFallbackPrediction(teamA, teamB, options, fallbackError?.message || error.message);
      }
    }
    throw error;
  }
}

function createPredictionKey(teams) {
  return [...teams].sort().join("__");
}

function createExactPredictionKey(teamA, teamB) {
  return `${teamA}__${teamB}`;
}

export {
  buildSyntheticFallbackPrediction,
  createExactPredictionKey,
  createPredictionKey,
  fetchMatchupPrediction,
  inferSeedFallbackProbability,
  shouldSuppressFallbackReason,
};
