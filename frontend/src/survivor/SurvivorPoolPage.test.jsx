import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { bracketDefinition, getAllMatchups } from "../bracket/bracketDefinition";
import { applyWinnerPick, createBracketState, getMatchupTeams } from "../bracket/bracketState";
import SurvivorPoolPage from "./SurvivorPoolPage";

function buildLiveFeedOverride({ live = false, resolvedFirstRound = false, started = false } = {}) {
  let state = createBracketState(bracketDefinition);
  const firstRoundMatchups = getAllMatchups(bracketDefinition).filter((matchup) => matchup.round === "firstRound");
  const games = Object.fromEntries(
    firstRoundMatchups.map((matchup, index) => [
      matchup.id,
      {
        matchupId: matchup.id,
        status: live ? "live" : "upcoming",
        startTime: started ? `2000-03-${20 + (index % 4)}T1${index % 10}:00:00Z` : `2099-03-${20 + (index % 4)}T1${index % 10}:00:00Z`,
        scoreA: 70,
        scoreB: 66,
      },
    ]),
  );

  if (resolvedFirstRound) {
    state = firstRoundMatchups.reduce((currentState, matchup) => {
      const [winner] = getMatchupTeams(bracketDefinition, currentState, matchup.id).filter(Boolean);
      return applyWinnerPick(bracketDefinition, currentState, matchup.id, winner);
    }, state);
  }

  return {
    error: "",
    loading: false,
    mode: "mock",
    refresh() {},
    reset() {},
    next() {},
    view: {
      bracketState: state,
      games,
    },
  };
}

describe("SurvivorPoolPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function getEnabledTeamButtons() {
    return screen.getAllByRole("button").filter((button) => button.className.includes("survivor-team-tile") && !button.disabled);
  }

  async function addAndSelectFirstPlayer(user) {
    await user.click(screen.getByRole("button", { name: "Add Player" }));
    await user.selectOptions(screen.getAllByRole("combobox")[0], screen.getByRole("option", { name: "Player 1" }));
  }

  it("renders the compact March Madness survivor experience and admin tools", () => {
    render(<SurvivorPoolPage liveFeedOverride={buildLiveFeedOverride()} />);

    expect(screen.getByText("March Madness survivor, driven by the official bracket")).toBeInTheDocument();
    expect(screen.getByText("Compact team board")).toBeInTheDocument();
    expect(screen.getByText("Admin Tools")).toBeInTheDocument();
    expect(screen.queryByText("Create / Configure Pool")).not.toBeInTheDocument();
  });

  it("adds a player, saves current-round picks, and can clear them again", async () => {
    const user = userEvent.setup();
    render(<SurvivorPoolPage liveFeedOverride={buildLiveFeedOverride()} />);

    await addAndSelectFirstPlayer(user);
    expect(await screen.findByRole("textbox", { name: "Player 1 name" })).toBeInTheDocument();

    const teamButtons = getEnabledTeamButtons();
    await user.click(teamButtons[0]);
    await user.click(teamButtons[1]);
    await user.click(teamButtons[2]);
    await user.click(screen.getByRole("button", { name: "Save Round Picks" }));

    expect(screen.getByText("Round picks saved.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear Current Picks" }));
    expect(screen.getByText(/Current round picks cleared/i)).toBeInTheDocument();
  });

  it("shows live pick indicators for active players", async () => {
    const user = userEvent.setup();
    render(<SurvivorPoolPage liveFeedOverride={buildLiveFeedOverride({ live: true })} />);

    await addAndSelectFirstPlayer(user);

    const teamButtons = getEnabledTeamButtons();
    await user.click(teamButtons[0]);
    await user.click(teamButtons[1]);
    await user.click(teamButtons[2]);
    await user.click(screen.getByRole("button", { name: "Save Round Picks" }));

    expect(screen.getAllByText(/LIVE/i).length).toBeGreaterThan(0);
  });

  it("locks normal editing once the round has started and allows admin override", async () => {
    const user = userEvent.setup();
    render(<SurvivorPoolPage liveFeedOverride={buildLiveFeedOverride({ started: true })} />);

    await addAndSelectFirstPlayer(user);

    expect(screen.getAllByText(/Picks are locked because Round of 64 has started/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Save Round Picks" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Enable Admin Mode" }));
    expect(screen.getByText("Admin Override Enabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Override Picks" })).not.toBeDisabled();
  });

  it("keeps unsaved draft picks visible while waiting and across rerenders", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SurvivorPoolPage liveFeedOverride={buildLiveFeedOverride()} />);

    await addAndSelectFirstPlayer(user);

    const [firstTeamButton] = getEnabledTeamButtons();
    await user.click(firstTeamButton);
    expect(screen.getByText("1 / 3 selected")).toBeInTheDocument();

    vi.useFakeTimers();
    vi.advanceTimersByTime(15000);
    rerender(<SurvivorPoolPage liveFeedOverride={buildLiveFeedOverride()} />);
    expect(screen.getByText("1 / 3 selected")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("preserves draft picks across background live-feed updates when the teams stay valid", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SurvivorPoolPage liveFeedOverride={buildLiveFeedOverride()} />);

    await addAndSelectFirstPlayer(user);

    const teamButtons = getEnabledTeamButtons();
    await user.click(teamButtons[0]);
    await user.click(teamButtons[1]);
    expect(screen.getByText("2 / 3 selected")).toBeInTheDocument();

    rerender(<SurvivorPoolPage liveFeedOverride={buildLiveFeedOverride({ live: true })} />);

    expect(screen.getByText("2 / 3 selected")).toBeInTheDocument();
  });

  it("keeps separate draft picks by player until they are saved", async () => {
    const user = userEvent.setup();
    render(<SurvivorPoolPage liveFeedOverride={buildLiveFeedOverride()} />);

    await user.click(screen.getByRole("button", { name: "Add Player" }));
    await user.click(screen.getByRole("button", { name: "Add Player" }));
    await user.selectOptions(screen.getAllByRole("combobox")[0], screen.getByRole("option", { name: "Player 1" }));

    let teamButtons = getEnabledTeamButtons();
    await user.click(teamButtons[0]);
    expect(screen.getByText("1 / 3 selected")).toBeInTheDocument();

    await user.selectOptions(screen.getAllByRole("combobox")[0], screen.getByRole("option", { name: "Player 2" }));
    expect(screen.getByText("0 / 3 selected")).toBeInTheDocument();

    teamButtons = getEnabledTeamButtons();
    await user.click(teamButtons[1]);
    await user.click(teamButtons[2]);
    expect(screen.getByText("2 / 3 selected")).toBeInTheDocument();

    await user.selectOptions(screen.getAllByRole("combobox")[0], screen.getByRole("option", { name: "Player 1" }));
    expect(screen.getByText("1 / 3 selected")).toBeInTheDocument();
  });
});
