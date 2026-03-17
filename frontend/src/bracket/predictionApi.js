import { fetchJson } from "../apiClient.js";
import { resolvePredictionTeamName } from "./teamNameResolver.js";

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
    top_reasons: reason ? [`Market fallback used: ${reason}`] : ["Market fallback used."],
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
    return fetchOddsFallbackPrediction(apiUrl, teamA, teamB, error?.message || "Unknown team mapping");
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
      return fetchOddsFallbackPrediction(apiUrl, teamA, teamB, error.message);
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

export { createExactPredictionKey, createPredictionKey, fetchMatchupPrediction };
