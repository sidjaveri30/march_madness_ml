function createPlayInPlaceholder(matchupId, teams) {
  return {
    id: `${matchupId}_placeholder`,
    canonicalName: `${matchupId}_placeholder`,
    isPlaceholder: true,
    matchupId,
    teams,
    displayName: teams.join(" / "),
    resolvedTeam: null,
  };
}

function isPlaceholderTeam(team) {
  return Boolean(team && typeof team === "object" && team.isPlaceholder);
}

function getTeamName(team) {
  if (!team) return "";
  return typeof team === "string" ? team : team.displayName || team.name || "";
}

function isPickableTeam(team) {
  return (typeof team === "string" && team.length > 0) || isPlaceholderTeam(team);
}

function isResolvedTeam(team) {
  return typeof team === "string" && team.length > 0;
}

function getTeamId(team) {
  if (!team) return "";
  if (typeof team === "string") return team;
  return team.id || team.canonicalName || team.displayName || "";
}

function sameTeam(left, right) {
  return getTeamId(left) !== "" && getTeamId(left) === getTeamId(right);
}

export { createPlayInPlaceholder, getTeamId, getTeamName, isPickableTeam, isPlaceholderTeam, isResolvedTeam, sameTeam };
