import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LiveBracketPage from "./LiveBracketPage";
import MyBracketPage from "./MyBracketPage";

describe("LiveBracketPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = vi.fn((url, options) => {
      if (String(url).includes("/odds")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            team_a: "Ohio St.",
            team_b: "TCU",
            event_found: false,
            bookmakers: [],
            consensus: {},
            model_vs_market: null,
            message: "No market lines currently available for this matchup.",
          }),
        });
      }
      if (String(url).includes("/predict")) {
        const payload = JSON.parse(options?.body || "{}");
        return Promise.resolve({
          ok: true,
          json: async () => ({
            team_a: payload.team_a || "Ohio St.",
            team_b: payload.team_b || "TCU",
            predicted_winner: payload.team_a || "Ohio St.",
            win_probability_team_a: 0.61,
            win_probability_team_b: 0.39,
            predicted_margin: 3.2,
            top_reasons: ["Ohio St. owns the stronger adjusted efficiency margin."],
            feature_snapshot: { adjem_diff: 4.4 },
          }),
        });
      }
      throw new Error(`Unhandled fetch ${url}`);
    });
  });

  it("renders live ticker content and advances official winners when mock updates progress", async () => {
    const user = userEvent.setup();
    render(<LiveBracketPage />);

    expect(screen.getByText("LIVE 2H 12:14")).toBeInTheDocument();
    expect(within(screen.getByTestId("matchup-midwest_r1_1")).getByRole("button", { name: /Howard \/ UMBC/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next Mock Update" }));

    expect(within(screen.getByTestId("matchup-midwest_r1_1")).getByRole("button", { name: /Howard/i })).toBeInTheDocument();
    expect(within(screen.getByTestId("matchup-east_r2_1")).getByRole("button", { name: /Ohio St\./i })).toBeInTheDocument();
  });

  it("does not let official live advancement modify My Bracket entries", async () => {
    const user = userEvent.setup();
    render(<MyBracketPage />);

    await user.click(within(screen.getByTestId("matchup-east_r1_2")).getByRole("button", { name: /TCU/i }));
    expect(within(screen.getByTestId("matchup-east_r1_2")).getByRole("button", { name: /TCU/i })).toHaveClass("team-slot-selected");

    render(<LiveBracketPage />);
    await user.click(screen.getByRole("button", { name: "Next Mock Update" }));

    expect(JSON.parse(window.localStorage.getItem("march-madness-bracket-workspace-v1")).entries[0].state.picks.east_r1_2).toBe("TCU");
  });

  it("handles live matchup details without crashing when teams are unresolved placeholders", async () => {
    const user = userEvent.setup();
    render(<LiveBracketPage />);

    await user.click(screen.getByTestId("details-midwest_r1_1"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Market lines are unavailable until both teams are fully resolved/i)).toBeInTheDocument();
  });
});
