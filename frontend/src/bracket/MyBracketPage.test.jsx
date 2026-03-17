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
});
