async function fetchMatchupPrediction(apiUrl, teamA, teamB, options = {}) {
  const response = await fetch(`${apiUrl}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      team_a: teamA,
      team_b: teamB,
      neutral_site: options.neutralSite ?? true,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || "Prediction unavailable");
  }

  return response.json();
}

function createPredictionKey(teams) {
  return [...teams].sort().join("__");
}

function createExactPredictionKey(teamA, teamB) {
  return `${teamA}__${teamB}`;
}

export { createExactPredictionKey, createPredictionKey, fetchMatchupPrediction };
