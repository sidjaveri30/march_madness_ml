function compactWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatCommenceTime(value) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return compactWhitespace(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed).replace(",", " •");
}

function compactLiveDetail(statusLabel) {
  const normalized = compactWhitespace(statusLabel);
  const match = normalized.match(/^LIVE\s+(.+)$/i);
  return match ? match[1].toUpperCase() : normalized.toUpperCase();
}

function compactStatusLabel(game) {
  if (!game) return "";
  if (game.status === "live") return "LIVE";
  if (game.status === "final") return "FINAL";
  if (game.status === "upcoming") return "UPCOMING";
  return compactWhitespace(game.statusLabel || game.status || "");
}

function compactStatusDetail(game) {
  if (!game) return "";
  if (game.status === "live") return compactLiveDetail(game.statusLabel);
  if (game.status === "final") return "";
  if (game.status === "upcoming") {
    return formatCommenceTime(game.commenceTime || game.startTime || game.statusLabel);
  }
  return compactWhitespace(game.statusLabel);
}

function getDisplayGameInfo(game) {
  if (!game) return null;

  return {
    ...game,
    displayStatusLabel: compactStatusLabel(game),
    displayStatusDetail: compactStatusDetail(game),
    team_a_score: game.team_a_score ?? game.teamAScore ?? null,
    team_b_score: game.team_b_score ?? game.teamBScore ?? null,
  };
}

export {
  compactStatusDetail,
  compactStatusLabel,
  compactWhitespace,
  formatCommenceTime,
  getDisplayGameInfo,
};
