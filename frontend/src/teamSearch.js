function normalizeTeamName(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function scoreTeam(query, team) {
  const normalizedQuery = normalizeTeamName(query);
  const normalizedTeam = normalizeTeamName(team);
  if (!normalizedQuery) return 0;
  if (normalizedTeam === normalizedQuery) return 1;
  if (normalizedTeam.startsWith(normalizedQuery)) return 0.96;
  if (normalizedTeam.includes(normalizedQuery)) return 0.82;
  const distance = levenshteinDistance(normalizedQuery, normalizedTeam);
  return 1 - distance / Math.max(normalizedQuery.length, normalizedTeam.length, 1);
}

function getTeamSuggestions(query, teams, limit = 6) {
  if (!query.trim()) {
    return teams.slice(0, limit);
  }
  return [...teams]
    .map((team) => ({ team, score: scoreTeam(query, team) }))
    .filter((item) => item.score >= 0.35)
    .sort((left, right) => right.score - left.score || left.team.localeCompare(right.team))
    .slice(0, limit)
    .map((item) => item.team);
}

function resolveTeamInput(input, teams) {
  const normalizedInput = normalizeTeamName(input);
  const exactMatch = teams.find((team) => normalizeTeamName(team) === normalizedInput) || null;
  const suggestions = getTeamSuggestions(input, teams);
  const strongSuggestion =
    !exactMatch && suggestions.length > 0 && scoreTeam(input, suggestions[0]) >= 0.68 ? suggestions[0] : null;
  return {
    exactMatch,
    suggestions,
    strongSuggestion,
  };
}

export { getTeamSuggestions, normalizeTeamName, resolveTeamInput, scoreTeam };
