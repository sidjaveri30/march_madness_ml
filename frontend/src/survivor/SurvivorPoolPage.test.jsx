import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { bracketDefinition, getAllMatchups } from "../bracket/bracketDefinition";
import { createBracketState } from "../bracket/bracketState";
import SurvivorPoolPage from "./SurvivorPoolPage";

function buildLiveFeedOverride() {
  const state = createBracketState(bracketDefinition);
  const firstRoundMatchups = getAllMatchups(bracketDefinition).filter((matchup) => matchup.round === "firstRound");
  const games = Object.fromEntries(
    firstRoundMatchups.map((matchup, index) => [
      matchup.id,
      {
        matchupId: matchup.id,
        status: "upcoming",
        startTime: `2099-03-${20 + (index % 4)}T1${index % 10}:00:00Z`,
      },
    ]),
  );

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

  it("renders the March Madness-specific survivor experience and removes the generic pool builder", () => {
    render(<SurvivorPoolPage liveFeedOverride={buildLiveFeedOverride()} />);

    expect(screen.getByText("March Madness survivor, driven by the official bracket")).toBeInTheDocument();
    expect(screen.getByText("Round of 64")).toBeInTheDocument();
    expect(screen.queryByText("Create / Configure Pool")).not.toBeInTheDocument();
    expect(screen.queryByText("Pool setup")).not.toBeInTheDocument();
  });

  it("adds a player and saves official current-round picks", async () => {
    const user = userEvent.setup();
    render(<SurvivorPoolPage liveFeedOverride={buildLiveFeedOverride()} />);

    await user.click(screen.getByRole("button", { name: "Add Player" }));
    expect(await screen.findByDisplayValue("Player 1")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox"), screen.getByRole("option", { name: "Player 1" }));

    const teamButtons = screen.getAllByRole("button").filter((button) => button.className.includes("survivor-team-pick") && !button.disabled);
    await user.click(teamButtons[0]);
    await user.click(teamButtons[1]);
    await user.click(teamButtons[2]);
    await user.click(screen.getByRole("button", { name: "Save Round Picks" }));

    expect(screen.getByText("Round picks saved.")).toBeInTheDocument();
  });
});
