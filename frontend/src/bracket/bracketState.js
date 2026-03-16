import { getAllMatchups, getFirstFourMatchup, INITIAL_ASSIGNMENTS } from "./bracketDefinition";
import { createPlayInPlaceholder, sameTeam } from "./bracketTeams";

function getOrderedMatchups(definition) {
  const roundOrder = {
    firstFour: 0,
    firstRound: 1,
    secondRound: 2,
    sweet16: 3,
    elite8: 4,
    finalFour: 5,
    championship: 6,
  };
  return [...getAllMatchups(definition)].sort((left, right) => roundOrder[left.round] - roundOrder[right.round]);
}

function getMatchupById(definition, matchupId) {
  return getAllMatchups(definition).find((matchup) => matchup.id === matchupId);
}

function getPlayInPlaceholder(definition, state, matchupId) {
  const matchup = getFirstFourMatchup(definition, matchupId);
  if (!matchup) return null;
  const teams = matchup.slots
    .map((slot) => (slot.source.type === "input" ? state.initialAssignments[slot.source.slotId] : null))
    .filter(Boolean);
  return teams.length === 2 ? createPlayInPlaceholder(matchupId, teams) : null;
}

function resolveSlotTeam(definition, state, slot) {
  if (slot.source.type === "input") {
    return state.initialAssignments[slot.source.slotId] || null;
  }
  if (slot.source.type === "winner") {
    const winner = state.picks[slot.source.matchupId];
    if (winner) return winner;
    return getPlayInPlaceholder(definition, state, slot.source.matchupId);
  }
  return null;
}

function getMatchupTeams(definition, state, matchupId) {
  const matchup = getMatchupById(definition, matchupId);
  if (!matchup) return [];
  return matchup.slots.map((slot) => resolveSlotTeam(definition, state, slot));
}

function sanitizePicks(definition, state) {
  const ordered = getOrderedMatchups(definition);
  const picks = { ...state.picks };
  let changed = true;
  while (changed) {
    changed = false;
    for (const matchup of ordered) {
      const currentPick = picks[matchup.id];
      if (!currentPick) continue;
      const matchupState = { ...state, picks };
      const teams = getMatchupTeams(definition, matchupState, matchup.id).filter(Boolean);
      if (!teams.some((team) => sameTeam(team, currentPick))) {
        delete picks[matchup.id];
        changed = true;
      }
    }
  }
  return picks;
}

function applyWinnerPick(definition, state, matchupId, winner) {
  const nextState = {
    ...state,
    picks: {
      ...state.picks,
      [matchupId]: winner,
    },
  };
  return {
    ...nextState,
    picks: sanitizePicks(definition, nextState),
  };
}

function setWinnerPick(definition, state, matchupId, winner) {
  if (!winner) return clearWinnerPick(definition, state, matchupId);
  if (sameTeam(state.picks[matchupId], winner)) {
    return state;
  }
  return applyWinnerPick(definition, state, matchupId, winner);
}

function clearWinnerPick(definition, state, matchupId) {
  const nextPicks = { ...state.picks };
  delete nextPicks[matchupId];
  const nextState = { ...state, picks: nextPicks };
  return {
    ...nextState,
    picks: sanitizePicks(definition, nextState),
  };
}

function createBracketState(definition, savedState = null) {
  const initialAssignments = savedState?.initialAssignments || INITIAL_ASSIGNMENTS;
  const state = {
    initialAssignments: { ...initialAssignments },
    picks: savedState?.picks || {},
  };
  return {
    ...state,
    picks: sanitizePicks(definition, state),
  };
}

function getChampion(state) {
  return state.picks.championship || null;
}

export {
  applyWinnerPick,
  clearWinnerPick,
  createBracketState,
  getChampion,
  getMatchupById,
  getMatchupTeams,
  getOrderedMatchups,
  getPlayInPlaceholder,
  setWinnerPick,
  sanitizePicks,
};
