function createPlayInPlaceholder(matchupId, teams) {
  return {
    id: `${matchupId}_placeholder`,
    isPlaceholder: true,
    matchupId,
    teams,
    name: teams.join(" / "),
  };
}

function isPlaceholderTeam(team) {
  return Boolean(team && typeof team === "object" && team.isPlaceholder);
}

function getTeamName(team) {
  if (!team) return "";
  return typeof team === "string" ? team : team.name || "";
}

function isPickableTeam(team) {
  return typeof team === "string" && team.length > 0;
}

export { createPlayInPlaceholder, getTeamName, isPickableTeam, isPlaceholderTeam };
