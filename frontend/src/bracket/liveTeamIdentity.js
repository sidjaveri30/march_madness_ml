import { canonicalizeTeamName } from "../teamMetadata";

const TEAM_KEY_ALIASES = {
  uconn: "connecticut",
  unc: "north carolina",
  byu: "brigham young",
  vcu: "virginia commonwealth",
  tcu: "texas christian",
  smu: "southern methodist",
  usf: "south florida",
  "s florida": "south florida",
  "st mary s": "saint marys",
  "saint mary s": "saint marys",
  "st mary s ca": "saint marys",
  "st john s": "st johns",
  "saint john s": "st johns",
  "ohio st": "ohio state",
  "michigan st": "michigan state",
  "iowa st": "iowa state",
  "utah st": "utah state",
  "kennesaw st": "kennesaw state",
  "wright st": "wright state",
  "tennessee st": "tennessee state",
  "north dakota state": "north dakota st",
  "north dakota st": "north dakota st",
  "nc state": "north carolina state",
  "n c state": "north carolina state",
  "n c state wolfpack": "north carolina state",
  "miami fl": "miami",
  "miami florida": "miami",
  "miami ohio": "miami ohio",
  "miami oh": "miami ohio",
  "miami of ohio": "miami ohio",
  "queens n c": "queens nc",
  "queens nc": "queens nc",
  "california baptist": "cal baptist",
  "cal baptist university": "cal baptist",
  "prairie view a m": "prairie view aandm",
  "prairie view a and m": "prairie view aandm",
  "texas a m": "texas am",
  "texas a and m": "texas am",
};

function resolveLiveTeamKey(teamName) {
  const canonical = canonicalizeTeamName(teamName);
  return TEAM_KEY_ALIASES[canonical] || canonical;
}

function sameTeamKeys(teamAKey, teamBKey) {
  return resolveLiveTeamKey(teamAKey) === resolveLiveTeamKey(teamBKey);
}

export { resolveLiveTeamKey, sameTeamKeys };
