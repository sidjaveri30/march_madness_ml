import { getGameEspnUrl } from "./espnGameUrl";

const COMMENCE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
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
  const rawDetail = match ? match[1] : normalized;
  const periodFirst = rawDetail.match(/^(1H|2H|OT|\d+OT)\s+(\d{1,2}:\d{2})$/i);
  if (periodFirst) {
    return `${periodFirst[2]} ${periodFirst[1].toUpperCase()}`;
  }
  const clockFirst = rawDetail.match(/^(\d{1,2}:\d{2})\s+(1H|2H|OT|\d+OT)$/i);
  if (clockFirst) {
    return `${clockFirst[1]} ${clockFirst[2].toUpperCase()}`;
  }
  return rawDetail.toUpperCase();
}

function compactStatusDetail(game) {
  if (!game) return "";
  if (game.status === "live") return compactLiveDetail(game.detail || game.statusLabel);
  if (game.status === "upcoming") {
    return formatCommenceTime(game.commenceTime || game.startTime || game.statusLabel);
  }
  if (game.status === "final") return "Final";
  return compactWhitespace(game.statusLabel);
}

function getGameStatusDisplay(game) {
  if (!game) return null;
  if (game.status === "live") {
    return {
      text: compactStatusDetail(game),
      type: "live",
      liveLabel: "LIVE",
    };
  }

  if (game.status === "final") {
    return {
      text: "Final",
      type: "final",
    };
  }

  return {
    text: compactStatusDetail(game),
    type: "upcoming",
  };
}

function getMatchupHeaderMeta(matchup, game) {
  if (!game) {
    return {
      label: compactMatchupLabel(matchup.label),
      detail: "",
    };
  }

  return {
    label: "",
    detail: "",
  };
}

function getDisplayGameInfo(game) {
  if (!game) return null;

  return {
    ...game,
    espnUrl: getGameEspnUrl(game),
    statusDisplay: getGameStatusDisplay(game),
    team_a_score: game.team_a_score ?? game.teamAScore ?? game.scoreA ?? null,
    team_b_score: game.team_b_score ?? game.teamBScore ?? game.scoreB ?? null,
  };
}

export {
  compactStatusDetail,
  compactMatchupLabel,
  compactWhitespace,
  formatCommenceTime,
  getDisplayGameInfo,
  getGameStatusDisplay,
  getMatchupHeaderMeta,
};
