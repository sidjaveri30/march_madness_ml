const ESPN_LOGO_BASE = "https://a.espncdn.com/i/teamlogos/ncaa/500";
const TEAM_LOGO_ALIASES = {
  "prairie view a and m": "prairie view a m",
  "prairie view a and m panthers": "prairie view a m",
  "prairie view a m panthers": "prairie view a m",
  "texas a and m": "texas a m",
  "texas am": "texas a m",
  "texas aandm": "texas a m",
  "texas a and m aggies": "texas a m",
  "texas a m aggies": "texas a m",
  "texas a and m corpus christi": "texas a m corpus christi",
  "texas a m corpus christi": "texas a m corpus christi",
    "texas a and m corpus christi islanders": "texas a m corpus christi",
    "texas a m corpus christi islanders": "texas a m corpus christi",
    "kansas jayhawks": "kansas",
    "cal baptist lancers": "cal baptist",
    "california baptist lancers": "cal baptist",
    "prairie view a m panthers": "prairie view a m",
    "prairie view a and m panthers": "prairie view a m",
    "lehigh mountain hawks": "lehigh",
    "florida gators": "florida",
    "clemson tigers": "clemson",
    "iowa hawkeyes": "iowa",
    "st john s red storm": "st john s",
    "st johns red storm": "st john s",
    "northern iowa panthers": "northern iowa",
    "queens royals": "queens n c",
    "queens nc royals": "queens n c",
    "queens n c royals": "queens n c",
    "queens university": "queens n c",
    "queens university royals": "queens n c",
    "queens university nc": "queens n c",
    "queens university n c": "queens n c",
    "queens charlotte": "queens n c",
    "queens charlotte royals": "queens n c",
    "queens university of charlotte": "queens n c",
    "queens university of charlotte royals": "queens n c",
};

function canonicalizeTeamName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildLogoUrl(id) {
  return `${ESPN_LOGO_BASE}/${id}.png`;
}

function buildLookupCandidates(teamName) {
  const canonical = canonicalizeTeamName(teamName);
  const candidates = new Set([canonical]);
  const aliased = TEAM_LOGO_ALIASES[canonical];
  if (aliased) candidates.add(aliased);

  [canonical, aliased].filter(Boolean).forEach((value) => {
    const parts = value.split(" ").filter(Boolean);
    for (let count = parts.length - 1; count >= 2; count -= 1) {
      candidates.add(parts.slice(0, count).join(" "));
    }
  });

  return [...candidates];
}

const TEAM_LOGO_IDS = {
  duke: 150,
  siena: 2561,
  "ohio st": 194,
  "ohio state": 194,
  tcu: 2628,
  "st john s": 2599,
  "st johns": 2599,
  "northern iowa": 2460,
  kansas: 2305,
  "cal baptist": 2856,
  "california baptist": 2856,
  louisville: 97,
  "south florida": 58,
  "michigan st": 127,
  "michigan state": 127,
  "north dakota st": 2449,
  "north dakota state": 2449,
  "n dakota st": 2449,
  "n dakota state": 2449,
  ndsu: 2449,
  ucla: 26,
  ucf: 2116,
  uconn: 41,
  connecticut: 41,
  furman: 231,
  florida: 57,
  lehigh: 2329,
  "prairie view a m": 2504,
  "prairie view": 2504,
  clemson: 228,
  iowa: 2294,
  vanderbilt: 238,
  mcneese: 2377,
  nebraska: 158,
  troy: 2653,
  "north carolina": 153,
  vcu: 2670,
  illinois: 356,
  penn: 219,
  pennsylvania: 219,
  "saint mary s": 2608,
  "saint marys": 2608,
  "texas a m": 245,
  "texas aandm": 245,
  "texas a m corpus christi": 2837,
  houston: 248,
  idaho: 70,
  arizona: 12,
  "long island": 112358,
  villanova: 222,
  "utah st": 328,
  "utah state": 328,
  wisconsin: 275,
  "high point": 2272,
  arkansas: 8,
  hawaii: 62,
  "hawai i": 62,
  "hawai i rainbow warriors": 62,
  byu: 252,
  "brigham young": 252,
  "nc state": 152,
  "north carolina state": 152,
  texas: 251,
  gonzaga: 2250,
  "kennesaw st": 338,
  "kennesaw state": 338,
  "miami fl": 2390,
  miami: 2390,
  missouri: 142,
  purdue: 2509,
  michigan: 130,
  howard: 47,
  umbc: 2378,
  georgia: 61,
  "saint louis": 139,
  "texas tech": 2641,
  akron: 2006,
  alabama: 333,
  hofstra: 2275,
  tennessee: 2633,
  smu: 2567,
  "miami ohio": 193,
  "miami oh": 193,
  virginia: 258,
  "wright st": 2750,
  "wright state": 2750,
  kentucky: 96,
  "santa clara": 2541,
  "iowa st": 66,
  "iowa state": 66,
  "tennessee st": 2634,
  "tennessee state": 2634,
};

function getTeamLogoUrl(teamName) {
  const key = buildLookupCandidates(teamName).find((candidate) => TEAM_LOGO_IDS[candidate]);
  return key ? buildLogoUrl(TEAM_LOGO_IDS[key]) : null;
}

function getTeamInitials(teamName) {
  const parts = String(teamName || "TBD")
    .replace(/[()]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export { buildLookupCandidates, canonicalizeTeamName, getTeamInitials, getTeamLogoUrl };
