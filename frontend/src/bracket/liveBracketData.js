import { bracketDefinition } from "./bracketDefinition";
import { applyWinnerPick, createBracketState } from "./bracketState";

const MOCK_LIVE_SNAPSHOTS = [
  {
    id: "snapshot-1",
    label: "Opening Window",
    games: {
      ff_midwest_16: {
        matchupId: "ff_midwest_16",
        status: "live",
        statusLabel: "LIVE 2H 12:14",
        teamA: "Howard",
        teamB: "UMBC",
        teamAScore: 34,
        teamBScore: 29,
      },
      ff_west_11: {
        matchupId: "ff_west_11",
        status: "final",
        statusLabel: "FINAL",
        teamA: "Texas",
        teamB: "NC State",
        teamAScore: 71,
        teamBScore: 66,
        winner: "Texas",
      },
      east_r1_2: {
        matchupId: "east_r1_2",
        status: "live",
        statusLabel: "LIVE 1H 08:42",
        teamA: "Ohio St.",
        teamB: "TCU",
        teamAScore: 26,
        teamBScore: 22,
      },
      south_r1_4: {
        matchupId: "south_r1_4",
        status: "upcoming",
        statusLabel: "Thu 3:15 PM",
        teamA: "Nebraska",
        teamB: "Troy",
      },
      west_r1_1: {
        matchupId: "west_r1_1",
        status: "upcoming",
        statusLabel: "Thu 4:10 PM",
        teamA: "Arizona",
        teamB: "Long Island",
      },
    },
  },
  {
    id: "snapshot-2",
    label: "Later Update",
    games: {
      ff_midwest_16: {
        matchupId: "ff_midwest_16",
        status: "final",
        statusLabel: "FINAL",
        teamA: "Howard",
        teamB: "UMBC",
        teamAScore: 71,
        teamBScore: 66,
        winner: "Howard",
      },
      ff_west_11: {
        matchupId: "ff_west_11",
        status: "final",
        statusLabel: "FINAL",
        teamA: "Texas",
        teamB: "NC State",
        teamAScore: 71,
        teamBScore: 66,
        winner: "Texas",
      },
      east_r1_2: {
        matchupId: "east_r1_2",
        status: "final",
        statusLabel: "FINAL",
        teamA: "Ohio St.",
        teamB: "TCU",
        teamAScore: 71,
        teamBScore: 66,
        winner: "Ohio St.",
      },
      south_r1_4: {
        matchupId: "south_r1_4",
        status: "live",
        statusLabel: "LIVE 2H 05:51",
        teamA: "Nebraska",
        teamB: "Troy",
        teamAScore: 58,
        teamBScore: 54,
      },
      west_r1_1: {
        matchupId: "west_r1_1",
        status: "upcoming",
        statusLabel: "Thu 4:10 PM",
        teamA: "Arizona",
        teamB: "Long Island",
      },
    },
  },
];

function buildLiveBracketState(snapshot, definition = bracketDefinition) {
  let state = createBracketState(definition);
  const games = snapshot?.games || {};

  Object.values(games).forEach((game) => {
    if (game.status === "final" && game.winner) {
      state = applyWinnerPick(definition, state, game.matchupId, game.winner);
    }
  });

  return {
    bracketState: state,
    games,
  };
}

function getTickerSections(snapshot) {
  const games = Object.values(snapshot?.games || {});
  return {
    live: games.filter((game) => game.status === "live"),
    final: games.filter((game) => game.status === "final"),
    upcoming: games.filter((game) => game.status === "upcoming"),
  };
}

export { MOCK_LIVE_SNAPSHOTS, buildLiveBracketState, getTickerSections };
