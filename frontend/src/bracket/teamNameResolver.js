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
  "n dakota st": "North Dakota St.",
  "n dakota state": "North Dakota St.",
  ndsu: "North Dakota St.",
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
  "queens (n c )": "Queens",
  "queens (n.c.)": "Queens",
  "queens n c": "Queens",
  "queens nc": "Queens",
  queens: "Queens",
  hawaii: "Hawaii",
  "hawai i": "Hawaii",
  "hawai i rainbow warriors": "Hawaii",
  "hawaii rainbow warriors": "Hawaii",
  "texas a m": "Texas A&M",
  "texas a&m": "Texas A&M",
  "texas aandm": "Texas A&M",
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

function scorePredictionNameMatch(target, candidate) {
  if (!target || !candidate) return 0;
  if (target === candidate) return 1;
  if (candidate.startsWith(target) || target.startsWith(candidate)) return 0.96;
  if (candidate.includes(target) || target.includes(candidate)) return 0.91;

  const targetTokens = new Set(target.split(" ").filter(Boolean));
  const candidateTokens = new Set(candidate.split(" ").filter(Boolean));
  const overlap = [...targetTokens].filter((token) => candidateTokens.has(token)).length;
  const tokenScore = overlap / Math.max(targetTokens.size, candidateTokens.size, 1);
  const lengthPenalty = Math.min(0.12, Math.abs(target.length - candidate.length) / 24);
  return tokenScore - lengthPenalty;
}

function findClosestPredictionTeam(teamName, teams) {
  const canonicalTarget = canonicalizeTeamName(teamName);
  let bestMatch = null;
  let bestScore = -Infinity;
  let secondBestScore = -Infinity;

  teams.forEach((team) => {
    const score = scorePredictionNameMatch(canonicalTarget, canonicalizeTeamName(team));
    if (score > bestScore) {
      secondBestScore = bestScore;
      bestScore = score;
      bestMatch = team;
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  });

  if (bestScore >= 0.88 && bestScore - secondBestScore >= 0.04) {
    return bestMatch;
  }
  return null;
}

const teamListCache = new Map();
const teamSearchCache = new Map();

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
  const { teams, lookup } = await loadPredictionTeams(apiUrl);
  const canonical = canonicalizeTeamName(teamName);
  const resolved = lookup.get(canonical);
  if (resolved) {
    return resolved;
  }
  const fuzzyMatch = findClosestPredictionTeam(teamName, teams);
  if (fuzzyMatch) return fuzzyMatch;
  const searchCacheKey = `${apiUrl}__${canonical}`;
  if (!teamSearchCache.has(searchCacheKey)) {
    const params = new URLSearchParams({ q: teamName });
    teamSearchCache.set(
      searchCacheKey,
      fetchJson(`${apiUrl}/teams/search?${params.toString()}`, {
        errorMessage: "Could not search predictor teams.",
      })
        .then((payload) => payload?.exact_match || payload?.strong_match || null)
        .catch(() => null),
    );
  }
  const searchedMatch = await teamSearchCache.get(searchCacheKey);
  if (typeof searchedMatch === "string" && searchedMatch.trim()) {
    return searchedMatch;
  }
  throw new Error(`Unknown predictor team mapping: ${teamName}`);
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
  teamSearchCache.clear();
}

export {
  PREDICTION_TEAM_ALIASES,
  buildPredictionNameLookup,
  canonicalizeTeamName,
  getBracketTeamNames,
  loadPredictionTeams,
  findClosestPredictionTeam,
  resetPredictionTeamCache,
  resolvePredictionTeamName,
  validateBracketPredictionNames,
};
