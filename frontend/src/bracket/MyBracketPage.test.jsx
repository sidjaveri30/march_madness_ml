import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bracketDefinition } from "./bracketDefinition";
import MyBracketPage from "./MyBracketPage";
import { PREDICTION_TEAM_ALIASES } from "./teamNameResolver";

describe("MyBracketPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    global.fetch = vi.fn((url, options) => {
      if (String(url).includes("/teams")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            teams: [
              ...new Set([
                ...Object.values(bracketDefinition.initialAssignments).filter(Boolean),
                ...Object.values(PREDICTION_TEAM_ALIASES),
              ]),
            ],
          }),
        });
      }
      if (String(url).includes("/odds")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            team_a: "Duke",
            team_b: "Siena",
            event_found: true,
            bookmakers: [],
            consensus: {
              team_a_implied_prob_avg: 0.62,
              team_b_implied_prob_avg: 0.38,
            },
            model_vs_market: null,
            message: "Consensus market available.",
          }),
        });
      }
      if (String(url).includes("/live-scoreboard")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            fetchedAt: "2026-03-18T18:00:00Z",
            games: [
              {
                matchupId: "east_r1_1",
                status: "final",
                winner: "Duke",
                teamA: "Duke",
                teamB: "Siena",
                teamAScore: 77,
                teamBScore: 61,
              },
              {
                matchupId: "east_r1_2",
                status: "live",
                teamA: "Ohio St.",
                teamB: "TCU",
                teamAScore: 31,
                teamBScore: 28,
                detail: "2H 11:12",
              },
            ],
          }),
        });
      }
      if (String(url).includes("/predict")) {
        const payload = JSON.parse(options?.body || "{}");
        return Promise.resolve({
          ok: true,
          json: async () => ({
            team_a: payload.team_a || "Florida",
            team_b: payload.team_b || "Lehigh",
            predicted_winner: payload.team_a || "Florida",
            win_probability_team_a: 0.78,
            win_probability_team_b: 0.22,
            predicted_margin: 8.4,
            top_reasons: [`${payload.team_a || "Florida"} owns the stronger adjusted efficiency margin.`],
            feature_snapshot: { adjem_diff: 18.1, sos_adjem_diff: 6.2 },
          }),
        });
      }
      throw new Error(`Unhandled fetch ${url}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates multiple bracket entries and switches between them independently", async () => {
    const user = userEvent.setup();
    render(<MyBracketPage />);

    expect(screen.getByRole("option", { name: "Human" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Analyst" })).not.toBeInTheDocument();

    const dukeButton = within(screen.getByTestId("matchup-east_r1_1")).getByRole("button", { name: /Duke/i });
    await user.click(dukeButton);
    expect(dukeButton).toHaveClass("team-slot-selected");

    await user.click(screen.getByRole("button", { name: "New Entry" }));

    expect(screen.getByRole("tab", { name: "Entry 2 Active" })).toHaveAttribute("aria-selected", "true");
    const freshDukeButton = within(screen.getByTestId("matchup-east_r1_1")).getByRole("button", { name: /Duke/i });
    expect(freshDukeButton).not.toHaveClass("team-slot-selected");

    await user.click(screen.getByRole("tab", { name: /Entry 1/i }));
    expect(within(screen.getByTestId("matchup-east_r1_1")).getByRole("button", { name: /Duke/i })).toHaveClass("team-slot-selected");
  });

  it("keeps placeholder-slot behavior intact in My Bracket", async () => {
    const user = userEvent.setup();
    render(<MyBracketPage />);

    const placeholderButton = within(screen.getByTestId("matchup-south_r1_1")).getByRole("button", { name: /Prairie View A&M \/ Lehigh/i });
    expect(placeholderButton).not.toBeDisabled();
    await user.click(placeholderButton);
    expect(placeholderButton).toHaveClass("team-slot-selected");
  });

  it("autofill mode updates only the active bracket entry", async () => {
    const user = userEvent.setup();
    render(<MyBracketPage />);

    await user.click(screen.getByRole("button", { name: "New Entry" }));
    await user.selectOptions(screen.getByLabelText(/Autofill mode/i), "chalk");
    await user.click(screen.getByRole("button", { name: "Auto-Fill Bracket" }));

    await waitFor(() => {
      expect(within(screen.getByTestId("matchup-east_r1_1")).getByRole("button", { name: /Duke/i })).toHaveClass("team-slot-selected");
    });

    await user.click(screen.getByRole("tab", { name: /Entry 1/i }));
    expect(within(screen.getByTestId("matchup-east_r1_1")).getByRole("button", { name: /Duke/i })).not.toHaveClass("team-slot-selected");
  });

  it("keeps manual edits available after autofill", async () => {
    const user = userEvent.setup();
    render(<MyBracketPage />);

    await user.selectOptions(screen.getByLabelText(/Autofill mode/i), "model");
    await user.click(screen.getByRole("button", { name: "Auto-Fill Bracket" }));

    await waitFor(() => {
      expect(within(screen.getByTestId("matchup-east_r1_1")).getByRole("button", { name: /Duke/i })).toHaveClass("team-slot-selected");
    });

    const sienaButton = within(screen.getByTestId("matchup-east_r1_1")).getByRole("button", { name: /Siena/i });
    await user.click(sienaButton);

    expect(sienaButton).toHaveClass("team-slot-selected");
  });

  it("shows correct and incorrect pick states for final games without affecting pending games", async () => {
    const user = userEvent.setup();
    render(<MyBracketPage />);

    const finalMatchup = screen.getByTestId("matchup-east_r1_1");
    const pendingMatchup = screen.getByTestId("matchup-south_r1_4");

    await user.click(within(finalMatchup).getByRole("button", { name: /Duke/i }));
    expect(finalMatchup).toHaveClass("matchup-card-outcome-correct");
    expect(within(finalMatchup).getByTitle("Pick correct")).toBeInTheDocument();

    await user.click(within(finalMatchup).getByRole("button", { name: /Siena/i }));
    expect(finalMatchup).toHaveClass("matchup-card-outcome-incorrect");
    expect(within(finalMatchup).getByTitle("Pick incorrect")).toBeInTheDocument();

    await user.click(within(pendingMatchup).getByRole("button", { name: /Nebraska/i }));
    expect(pendingMatchup).toHaveClass("matchup-card-outcome-pending");
    expect(within(pendingMatchup).queryByTitle(/Pick /i)).not.toBeInTheDocument();
  });
});
