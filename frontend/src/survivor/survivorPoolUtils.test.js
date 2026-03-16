import { beforeEach, describe, expect, it } from "vitest";

import { bracketDefinition, getAllMatchups } from "../bracket/bracketDefinition";
import { applyWinnerPick, createBracketState, getMatchupTeams } from "../bracket/bracketState";
import { clearSurvivorPool, loadSurvivorPool, saveSurvivorPool } from "./survivorPoolStorage.js";
import {
  buildRoundContext,
  clearPlayerRoundPicks,
  createPlayer,
  createPool,
  getCurrentRoundContext,
  getNextRoundContext,
  getPickStatus,
  getPlayerCurrentRoundStatuses,
  processRoundResults,
  resetPoolProgress,
  rollbackPoolToRound,
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

function buildLiveGames(roundKey, status = "upcoming") {
  return Object.fromEntries(
    getAllMatchups(bracketDefinition)
      .filter((matchup) => matchup.round === roundKey)
      .map((matchup, index) => [
        matchup.id,
        {
          matchupId: matchup.id,
          status,
          startTime: `2099-03-${20 + (index % 4)}T1${index % 10}:00:00Z`,
          scoreA: 70,
          scoreB: 65,
        },
      ]),
  );
}

describe("survivorPoolUtils", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearSurvivorPool();
  });

  it("persists survivor pool state through localStorage", () => {
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

  it("blocks reused teams and wrong pick counts in the compact picker rules", () => {
    const roundContext = buildRoundContext(bracketDefinition, createBracketState(bracketDefinition), {}, "firstRound");
    const reusedTeam = roundContext.availableTeams[0].id;
    const player = createPlayer({ usedTeamIds: [reusedTeam] });

    expect(validatePlayerRoundPicks(player, roundContext, [roundContext.availableTeams[1].id], new Date("2099-03-19T12:00:00Z")).allowed).toBe(false);
    expect(
      validatePlayerRoundPicks(
        player,
        roundContext,
        [reusedTeam, roundContext.availableTeams[1].id, roundContext.availableTeams[2].id],
        new Date("2099-03-19T12:00:00Z"),
      ).message,
    ).toMatch(/not available/i);
  });

  it("reset current picks clears only the selected player's current round", () => {
    const roundContext = buildRoundContext(bracketDefinition, createBracketState(bracketDefinition), {}, "firstRound");
    const pool = createPool({
      players: [
        createPlayer({
          id: "sid",
          name: "Sid",
          picks: [{ roundKey: "firstRound", teamIds: roundContext.availableTeamIds.slice(0, 3), wasCorrect: null }],
        }),
        createPlayer({
          id: "taylor",
          name: "Taylor",
          picks: [{ roundKey: "firstRound", teamIds: roundContext.availableTeamIds.slice(3, 6), wasCorrect: null }],
        }),
      ],
    });

    const nextPool = clearPlayerRoundPicks(pool, "sid", "firstRound");

    expect(nextPool.players.find((player) => player.id === "sid").picks).toHaveLength(0);
    expect(nextPool.players.find((player) => player.id === "taylor").picks).toHaveLength(1);
  });

  it("reset pool clears picks, eliminations, and used-team history", () => {
    const pool = createPool({
      processedRoundKeys: ["firstRound"],
      players: [
        createPlayer({
          id: "sid",
          name: "Sid",
          eliminated: true,
          eliminationReason: "Round of 64: incorrect pick Duke",
          usedTeamIds: ["duke"],
          picks: [{ roundKey: "firstRound", teamIds: ["duke"], wasCorrect: false }],
        }),
      ],
    });

    const resetPool = resetPoolProgress(pool);

    expect(resetPool.processedRoundKeys).toEqual([]);
    expect(resetPool.players[0].eliminated).toBe(false);
    expect(resetPool.players[0].usedTeamIds).toEqual([]);
    expect(resetPool.players[0].picks).toEqual([]);
  });

  it("rollback reopens an earlier round while preserving saved picks for correction", () => {
    const resolvedFirstRound = resolveRound(createBracketState(bracketDefinition), "firstRound");
    const pool = createPool({
      processedRoundKeys: ["firstRound", "secondRound"],
      players: [
        createPlayer({
          id: "sid",
          name: "Sid",
          picks: [
            { roundKey: "firstRound", teamIds: ["Duke", "Kansas", "Arizona"], wasCorrect: true },
            { roundKey: "secondRound", teamIds: ["Duke", "Arizona"], wasCorrect: null },
          ],
          usedTeamIds: ["Duke", "Kansas", "Arizona"],
        }),
      ],
    });

    const nextPool = rollbackPoolToRound(pool, "firstRound", bracketDefinition, resolvedFirstRound, {});

    expect(nextPool.processedRoundKeys).toEqual([]);
    expect(nextPool.players[0].picks).toHaveLength(2);
    expect(nextPool.players[0].usedTeamIds).toEqual([]);
    expect(nextPool.players[0].eliminated).toBe(false);
  });

  it("eliminates players when any selected team loses and records why", () => {
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

    const result = processRoundResults(pool, currentRound, nextRound, bracketDefinition, state, {});

    expect(result.error).toBe("");
    expect(result.pool.players[0].eliminated).toBe(true);
    expect(result.pool.players[0].eliminationPickIds).toEqual([losingTeam]);
    expect(result.pool.players[0].eliminationReason).toMatch(/incorrect pick/i);
  });

  it("shows live/current pick status indicators from official game state", () => {
    const state = createBracketState(bracketDefinition);
    const games = buildLiveGames("firstRound", "live");
    const roundContext = buildRoundContext(bracketDefinition, state, games, "firstRound");
    const selectedTeamId = roundContext.matchups[0].resolvedTeams[0].id;
    const player = createPlayer({
      id: "sid",
      name: "Sid",
      picks: [{ roundKey: "firstRound", teamIds: [selectedTeamId, roundContext.availableTeamIds[1], roundContext.availableTeamIds[2]], wasCorrect: null }],
    });

    const status = getPickStatus(roundContext, selectedTeamId);
    const statuses = getPlayerCurrentRoundStatuses(player, roundContext, new Map(roundContext.availableTeams.map((team) => [team.id, team.name])));

    expect(status.code.startsWith("live")).toBe(true);
    expect(statuses[0].code.startsWith("live")).toBe(true);
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
