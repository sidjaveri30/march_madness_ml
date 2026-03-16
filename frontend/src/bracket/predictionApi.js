import { fetchJson } from "../apiClient.js";

async function fetchMatchupPrediction(apiUrl, teamA, teamB, options = {}) {
  return fetchJson(`${apiUrl}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      team_a: teamA,
      team_b: teamB,
      neutral_site: options.neutralSite ?? true,
    }),
    errorMessage: "Prediction unavailable",
  });
}

function createPredictionKey(teams) {
  return [...teams].sort().join("__");
}

function createExactPredictionKey(teamA, teamB) {
  return `${teamA}__${teamB}`;
}

export { createExactPredictionKey, createPredictionKey, fetchMatchupPrediction };
