import { getGameEspnUrl } from "./espnGameUrl";

const COMMENCE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function compactWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compactMatchupLabel(label) {
  const normalized = compactWhitespace(label);
  if (!normalized) return "";

  return normalized
    .replace(/\bFirst Round\b/i, "R1")
    .replace(/\bSecond Round\b/i, "R2")
    .replace(/\bSweet 16\b/i, "S16")
    .replace(/\bElite 8\b/i, "E8")
    .replace(/\bChampionship\b/i, "Title")
    .replace(/\s+/g, " ");
}

function formatCommenceTime(value) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return compactWhitespace(value);
  }

  return COMMENCE_TIME_FORMATTER.format(parsed).replace(",", " •");
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
  if (game.status === "upcoming") return "TIP";
  return compactWhitespace(game.statusLabel || game.status || "");
}

function compactStatusDetail(game) {
  if (!game) return "";
  if (game.status === "live") return compactLiveDetail(game.detail || game.statusLabel);
  if (game.status === "final") return "";
  if (game.status === "upcoming") {
    return formatCommenceTime(game.commenceTime || game.startTime || game.statusLabel);
  }
  return compactWhitespace(game.statusLabel);
}

function getMatchupHeaderMeta(matchup, game) {
  if (!game) {
    return {
      label: compactMatchupLabel(matchup.label),
      detail: "",
    };
  }

  if (game.status === "live") {
    return {
      label: "LIVE",
      detail: compactStatusDetail(game),
    };
  }

  if (game.status === "final") {
    return {
      label: "FINAL",
      detail: "",
    };
  }

  return {
    label: compactMatchupLabel(matchup.label),
    detail: compactStatusDetail(game),
  };
}

function getDisplayGameInfo(game) {
  if (!game) return null;

  return {
    ...game,
    espnUrl: getGameEspnUrl(game),
    displayStatusLabel: compactStatusLabel(game),
    displayStatusDetail: compactStatusDetail(game),
    team_a_score: game.team_a_score ?? game.teamAScore ?? game.scoreA ?? null,
    team_b_score: game.team_b_score ?? game.teamBScore ?? game.scoreB ?? null,
  };
}

export {
  compactStatusDetail,
  compactStatusLabel,
  compactMatchupLabel,
  compactWhitespace,
  formatCommenceTime,
  getDisplayGameInfo,
  getMatchupHeaderMeta,
};
