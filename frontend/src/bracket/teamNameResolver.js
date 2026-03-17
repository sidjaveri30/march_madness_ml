import { fetchJson } from "../apiClient.js";

const PREDICTION_TEAM_ALIASES = {
  "cal baptist": "Cal Baptist",
  "california baptist": "Cal Baptist",
  "ohio st": "Ohio St.",
  "ohio state": "Ohio St.",
  "michigan st": "Michigan St.",
  "michigan state": "Michigan St.",
  "iowa st": "Iowa St.",
  "iowa state": "Iowa St.",
  "nc state": "N.C. State",
  "n c state": "N.C. State",
  "north carolina state": "N.C. State",
  "miami fl": "Miami FL",
  "miami florida": "Miami FL",
  "miami (fl)": "Miami FL",
  "miami ohio": "Miami OH",
  "miami oh": "Miami OH",
  "miami (ohio)": "Miami OH",
  "miami (oh)": "Miami OH",
  "st john s": "St. John's",
  "st johns": "St. John's",
  "saint john s": "St. John's",
  "saint johns": "St. John's",
  "saint mary s": "Saint Mary's",
  "saint marys": "Saint Mary's",
  "st mary s": "Saint Mary's",
  "st marys": "Saint Mary's",
  "north dakota st": "North Dakota St.",
  "north dakota state": "North Dakota St.",
  "long island": "LIU",
  liu: "LIU",
  "long island university": "LIU",
  "utah st": "Utah St.",
  "utah state": "Utah St.",
  "kennesaw st": "Kennesaw St.",
  "kennesaw state": "Kennesaw St.",
  "wright st": "Wright St.",
  "wright state": "Wright St.",
  "prairie view a m": "Prairie View A&M",
  "prairie view a&m": "Prairie View A&M",
  "queens (n c)": "Queens",
  "queens n c": "Queens",
  "queens nc": "Queens",
  queens: "Queens",
  "texas a m": "Texas A&M",
  "texas a&m": "Texas A&M",
  byu: "BYU",
  smu: "SMU",
  ucf: "UCF",
  uconn: "Connecticut",
  "u conn": "Connecticut",
  connecticut: "Connecticut",
  vcu: "VCU",
  ucla: "UCLA",
  tcu: "TCU",
  umbc: "UMBC",
};

function canonicalizeTeamName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\buniversity\b/g, " ")
    .replace(/\bof\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPredictionNameLookup(teams) {
  const lookup = new Map();
  teams.forEach((team) => {
    const canonical = canonicalizeTeamName(team);
    if (canonical) lookup.set(canonical, team);
  });
  Object.entries(PREDICTION_TEAM_ALIASES).forEach(([alias, canonicalTeam]) => {
    const resolvedTeam = lookup.get(canonicalizeTeamName(canonicalTeam));
    if (resolvedTeam) {
      lookup.set(canonicalizeTeamName(alias), resolvedTeam);
    }
  });
  return lookup;
}

const teamListCache = new Map();

async function loadPredictionTeams(apiUrl) {
  if (!teamListCache.has(apiUrl)) {
    teamListCache.set(
      apiUrl,
      fetchJson(`${apiUrl}/teams`, {
        errorMessage: "Could not load predictor teams.",
      }).then((payload) => {
        const teams = Array.isArray(payload?.teams) ? payload.teams.filter((team) => typeof team === "string" && team.trim()) : [];
        return {
          teams,
          lookup: buildPredictionNameLookup(teams),
        };
      }),
    );
  }
  return teamListCache.get(apiUrl);
}

async function resolvePredictionTeamName(apiUrl, teamName) {
  const { lookup } = await loadPredictionTeams(apiUrl);
  const canonical = canonicalizeTeamName(teamName);
  const resolved = lookup.get(canonical);
  if (!resolved) {
    throw new Error(`Unknown predictor team mapping: ${teamName}`);
  }
  return resolved;
}

function getBracketTeamNames(definition) {
  const names = new Set();
  Object.values(definition?.initialAssignments || {}).forEach((team) => {
    if (typeof team === "string" && team.trim()) names.add(team);
  });
  return [...names].sort((left, right) => left.localeCompare(right));
}

async function validateBracketPredictionNames(apiUrl, definition) {
  const teamNames = getBracketTeamNames(definition);
  const resolvedEntries = await Promise.all(
    teamNames.map(async (teamName) => {
      try {
        return {
          source: teamName,
          canonical: await resolvePredictionTeamName(apiUrl, teamName),
          mode: "predictor",
        };
      } catch {
        return {
          source: teamName,
          canonical: null,
          mode: "fallback",
        };
      }
    }),
  );
  return {
    totalTeams: resolvedEntries.length,
    fallbackCount: resolvedEntries.filter((entry) => entry.mode === "fallback").length,
    teams: resolvedEntries,
  };
}

function resetPredictionTeamCache() {
  teamListCache.clear();
}

export {
  PREDICTION_TEAM_ALIASES,
  buildPredictionNameLookup,
  canonicalizeTeamName,
  getBracketTeamNames,
  loadPredictionTeams,
  resetPredictionTeamCache,
  resolvePredictionTeamName,
  validateBracketPredictionNames,
};
