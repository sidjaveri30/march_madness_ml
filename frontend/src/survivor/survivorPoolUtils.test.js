import { beforeEach, describe, expect, it } from "vitest";

import { bracketDefinition, getAllMatchups } from "../bracket/bracketDefinition";
import { applyWinnerPick, createBracketState, getMatchupTeams } from "../bracket/bracketState";
import { clearSurvivorPool, loadSurvivorPool, saveSurvivorPool } from "./survivorPoolStorage.js";
import {
  buildRoundContext,
  createPlayer,
  createPool,
  getCurrentRoundContext,
  getNextRoundContext,
  processRoundResults,
  setPlayerRoundPicks,
  validatePlayerRoundPicks,
} from "./survivorPoolUtils.js";

function resolveRound(state, roundKey) {
  return getAllMatchups(bracketDefinition)
    .filter((matchup) => matchup.round === roundKey)
    .reduce((currentState, matchup) => {
      const [winner] = getMatchupTeams(bracketDefinition, currentState, matchup.id).filter(Boolean);
      return applyWinnerPick(bracketDefinition, currentState, matchup.id, winner);
    }, state);
}

describe("survivorPoolUtils", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearSurvivorPool();
  });

  it("persists simplified survivor pool state through localStorage", () => {
    const pool = createPool({
      name: "Friends Pool",
      processedRoundKeys: ["firstRound"],
      players: [createPlayer({ id: "sid", name: "Sid", usedTeamIds: ["duke"] })],
    });

    saveSurvivorPool(pool);

    const restored = loadSurvivorPool();
    expect(restored.name).toBe("Friends Pool");
    expect(restored.processedRoundKeys).toEqual(["firstRound"]);
    expect(restored.players[0].usedTeamIds).toEqual(["duke"]);
  });

  it("uses only official March Madness round teams and games", () => {
    const state = createBracketState(bracketDefinition);
    const roundContext = getCurrentRoundContext(bracketDefinition, state, {}, []);

    expect(roundContext.roundKey).toBe("firstRound");
    expect(roundContext.matchups.every((matchup) => matchup.round === "firstRound")).toBe(true);
    expect(roundContext.availableTeams).toHaveLength(64);
  });

  it("enforces the official pick requirements by round", () => {
    const firstRound = buildRoundContext(bracketDefinition, createBracketState(bracketDefinition), {}, "firstRound");
    const secondRound = buildRoundContext(bracketDefinition, resolveRound(createBracketState(bracketDefinition), "firstRound"), {}, "secondRound");
    const sweet16 = buildRoundContext(
      bracketDefinition,
      resolveRound(resolveRound(createBracketState(bracketDefinition), "firstRound"), "secondRound"),
      {},
      "sweet16",
    );

    expect(firstRound.requiredPicks).toBe(3);
    expect(secondRound.requiredPicks).toBe(2);
    expect(sweet16.requiredPicks).toBe(1);
  });

  it("prevents players from reusing a previously selected team", () => {
    const roundContext = buildRoundContext(bracketDefinition, createBracketState(bracketDefinition), {}, "firstRound");
    const reusedTeam = roundContext.availableTeams[0].id;
    const player = createPlayer({ usedTeamIds: [reusedTeam] });
    const selection = [reusedTeam, roundContext.availableTeams[1].id, roundContext.availableTeams[2].id];

    const result = validatePlayerRoundPicks(player, roundContext, selection, new Date("2099-03-19T12:00:00Z"));

    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/not available for this player/i);
  });

  it("eliminates a player when any selected team loses", () => {
    const state = resolveRound(createBracketState(bracketDefinition), "firstRound");
    const currentRound = buildRoundContext(bracketDefinition, state, {}, "firstRound");
    const nextRound = getNextRoundContext(bracketDefinition, state, {}, []);
    const losingTeam = currentRound.matchups[0].resolvedTeams.find((team) => team.id !== currentRound.matchups[0].winner).id;
    const winningTeamIds = currentRound.matchups.slice(1, 3).map((matchup) => matchup.winner);
    const pool = createPool({
      players: [
        createPlayer({
          id: "sid",
          name: "Sid",
          picks: [{ roundKey: "firstRound", teamIds: [losingTeam, ...winningTeamIds], wasCorrect: null }],
        }),
      ],
    });

    const result = processRoundResults(pool, currentRound, nextRound);

    expect(result.error).toBe("");
    expect(result.pool.players[0].eliminated).toBe(true);
    expect(result.pool.players[0].eliminationReason).toMatch(/one or more picks lost/i);
  });

  it("eliminates a surviving player who will not have enough unused teams for the next round", () => {
    const state = resolveRound(createBracketState(bracketDefinition), "firstRound");
    const currentRound = buildRoundContext(bracketDefinition, state, {}, "firstRound");
    const nextRound = getNextRoundContext(bracketDefinition, state, {}, []);
    const winningTeamIds = currentRound.matchups.slice(0, 3).map((matchup) => matchup.winner);
    const preUsedNextRoundTeams = nextRound.availableTeamIds.filter((teamId) => !winningTeamIds.includes(teamId));
    const pool = createPool({
      players: [
        createPlayer({
          id: "sid",
          name: "Sid",
          usedTeamIds: preUsedNextRoundTeams,
          picks: [{ roundKey: "firstRound", teamIds: winningTeamIds, wasCorrect: null }],
        }),
      ],
    });

    const result = processRoundResults(pool, currentRound, nextRound);

    expect(result.pool.players[0].eliminated).toBe(true);
    expect(result.pool.players[0].eliminationReason).toMatch(/not enough unused teams remain/i);
  });

  it("advances with the official tournament round and shrinks the available team set", () => {
    const initialState = createBracketState(bracketDefinition);
    const roundOne = getCurrentRoundContext(bracketDefinition, initialState, {}, []);
    const resolvedState = resolveRound(initialState, "firstRound");
    const roundTwo = getCurrentRoundContext(bracketDefinition, resolvedState, {}, ["firstRound"]);

    expect(roundOne.roundKey).toBe("firstRound");
    expect(roundTwo.roundKey).toBe("secondRound");
    expect(roundTwo.availableTeams).toHaveLength(32);
  });

  it("allows valid official-round picks and stores them by round key", () => {
    const roundContext = buildRoundContext(bracketDefinition, createBracketState(bracketDefinition), {}, "firstRound");
    const pool = createPool({
      players: [createPlayer({ id: "sid", name: "Sid" })],
    });
    const teamIds = roundContext.availableTeamIds.slice(0, 3);

    const result = setPlayerRoundPicks(pool, "sid", roundContext, teamIds, new Date("2099-03-19T12:00:00Z"));

    expect(result.error).toBe("");
    expect(result.pool.players[0].picks[0]).toEqual({
      roundKey: "firstRound",
      teamIds,
      wasCorrect: null,
    });
  });
});
