import { getAllMatchups } from "./bracketDefinition";
import { getTeamId } from "./bracketTeams";

const ROUND_ORDER = {
  firstFour: 0,
  firstRound: 1,
  secondRound: 2,
  sweet16: 3,
  elite8: 4,
  finalFour: 5,
  championship: 6,
};

function getWinningTeamId(game) {
  if (!game || game.status !== "final") return "";
  if (game.winner) return getTeamId(game.winner);

  const scoreA = game.team_a_score ?? game.teamAScore ?? game.scoreA ?? null;
  const scoreB = game.team_b_score ?? game.teamBScore ?? game.scoreB ?? null;
  if (scoreA === null || scoreB === null || scoreA === scoreB) return "";

  return scoreA > scoreB ? getTeamId(game.teamA) : getTeamId(game.teamB);
}

function buildTeamEliminationMap(definition, actualGamesByMatchup = {}) {
  const eliminationRoundByTeam = {};

  getAllMatchups(definition).forEach((matchup) => {
    const game = actualGamesByMatchup[matchup.id];
    const winningTeamId = getWinningTeamId(game);
    if (!winningTeamId) return;

    const teamIds = [getTeamId(game.teamA), getTeamId(game.teamB)].filter(Boolean);
    teamIds.forEach((teamId) => {
      if (!teamId || teamId === winningTeamId || eliminationRoundByTeam[teamId] !== undefined) return;
      eliminationRoundByTeam[teamId] = ROUND_ORDER[matchup.round] ?? Number.POSITIVE_INFINITY;
    });
  });

  return eliminationRoundByTeam;
}

function derivePickOutcomeByMatchup({ definition, picks = {}, actualGamesByMatchup = {} }) {
  const eliminationRoundByTeam = buildTeamEliminationMap(definition, actualGamesByMatchup);

  return Object.fromEntries(
    getAllMatchups(definition).map((matchup) => {
      const pickedTeamId = getTeamId(picks[matchup.id]);
      const actualGame = actualGamesByMatchup[matchup.id];
      const roundIndex = ROUND_ORDER[matchup.round] ?? Number.POSITIVE_INFINITY;

      if (!pickedTeamId) {
        return [matchup.id, "placeholder"];
      }

      const winningTeamId = getWinningTeamId(actualGame);
      if (actualGame?.status === "final" && winningTeamId) {
        return [matchup.id, pickedTeamId === winningTeamId ? "correct" : "incorrect"];
      }

      const eliminationRound = eliminationRoundByTeam[pickedTeamId];
      if (eliminationRound !== undefined && eliminationRound < roundIndex) {
        return [matchup.id, "busted"];
      }

      return [matchup.id, "pending"];
    }),
  );
}

export { derivePickOutcomeByMatchup, getWinningTeamId };
