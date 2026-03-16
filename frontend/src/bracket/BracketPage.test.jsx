import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BracketPage from "./BracketPage";

describe("BracketPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = vi.fn((url, options) => {
      if (String(url).includes("/odds")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            team_a: "Duke",
            team_b: "Siena",
            event_found: true,
            bookmakers: [
              {
                key: "draftkings",
                title: "DraftKings",
                last_update: "2026-03-15T12:05:00Z",
                moneyline: { team_a_price: -180, team_b_price: 150, team_a_implied_prob: 0.63, team_b_implied_prob: 0.37 },
                spread: { team_a_line: -5, team_a_price: -110, team_b_line: 5, team_b_price: -110 },
                total: null,
              },
            ],
            consensus: {
              team_a_moneyline_avg: -180,
              team_b_moneyline_avg: 150,
              team_a_implied_prob_avg: 0.63,
              team_b_implied_prob_avg: 0.37,
              spread_avg: -5,
              total_avg: null,
            },
            model_vs_market: {
              model_win_prob_team_a: 0.78,
              market_implied_prob_team_a: 0.63,
              moneyline_edge_team_a: 0.15,
              model_margin_team_a: 8.4,
              market_spread_team_a: -5,
              spread_edge_team_a: 3.4,
              edge_label: "Moderate edge",
              interpretation: "Moderate model lean on Duke moneyline. Model leans Duke against the spread.",
            },
            message: null,
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

  it("allows selecting a winner directly from the modal and keeps the modal in sync", async () => {
    const user = userEvent.setup();
    render(<BracketPage />);

    await user.click(screen.getByTestId("details-east_r1_1"));
    await user.click(screen.getByRole("button", { name: /Advance Duke/i }));

    expect(screen.getByText(/Current pick:/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Advance Duke/i })).toHaveClass("modal-team-card-selected");
    const dukeButton = within(screen.getByTestId("matchup-east_r1_1")).getByRole("button", { name: /Duke/i });
    expect(dukeButton).toHaveClass("team-slot-selected");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("clears downstream picks when an earlier winner changes from the modal", async () => {
    const user = userEvent.setup();
    render(<BracketPage />);

    const pickButton = (testId, label) =>
      within(screen.getByTestId(testId))
        .getAllByRole("button")
        .find((button) => button.textContent?.includes(label));

    await user.click(pickButton("matchup-south_r1_1", "Prairie View A&M / Lehigh"));
    await user.click(pickButton("matchup-south_r1_2", "Clemson"));
    await user.click(pickButton("matchup-south_r2_1", "Prairie View A&M / Lehigh"));

    await user.click(screen.getByTestId("details-south_r1_1"));
    await user.click(screen.getByRole("button", { name: /Advance Florida/i }));

    const southRoundTwo = screen.getByTestId("matchup-south_r2_1");
    expect(within(southRoundTwo).queryByRole("button", { name: /Prairie View A&M \/ Lehigh/i })).not.toBeInTheDocument();
    expect(within(southRoundTwo).getByRole("button", { name: /Florida/i })).toBeInTheDocument();
    expect(within(southRoundTwo).queryByRole("button", { name: /Clemson/i })).toBeInTheDocument();
    expect(within(southRoundTwo).queryByRole("button", { name: /Florida/i })).not.toHaveClass("team-slot-selected");
  });

  it("renders the core bracket structure with regions and center rounds", () => {
    const { container } = render(<BracketPage />);

    expect(container.querySelector(".visual-bracket")).toBeInTheDocument();
    expect(screen.getByText("East")).toBeInTheDocument();
    expect(screen.getByText("South")).toBeInTheDocument();
    expect(screen.getByText("West")).toBeInTheDocument();
    expect(screen.getByText("Midwest")).toBeInTheDocument();
    expect(screen.getByText("Final Four")).toBeInTheDocument();
    expect(screen.getByText("Championship")).toBeInTheDocument();
  });

  it("keeps both semifinal teams and championship teams visible in the center bracket", () => {
    render(<BracketPage />);

    const semifinalOne = screen.getByTestId("matchup-final_four_1");
    const semifinalTwo = screen.getByTestId("matchup-final_four_2");
    const championship = screen.getByTestId("matchup-championship");

    expect(within(semifinalOne).getAllByRole("button")).toHaveLength(3);
    expect(within(semifinalTwo).getAllByRole("button")).toHaveLength(3);
    expect(within(championship).getAllByRole("button")).toHaveLength(3);
  });

  it("shows first four placeholders in the main bracket and keeps them selectable", () => {
    render(<BracketPage />);

    const southFeeder = screen.getByTestId("matchup-south_r1_1");
    const westFeeder = screen.getByTestId("matchup-west_r1_5");
    const midwestTopFeeder = screen.getByTestId("matchup-midwest_r1_1");
    const midwestPlayInFeeder = screen.getByTestId("matchup-midwest_r1_5");

    expect(within(southFeeder).getByRole("button", { name: /Prairie View A&M \/ Lehigh/i })).not.toBeDisabled();
    expect(within(westFeeder).getByRole("button", { name: /Texas \/ NC State/i })).not.toBeDisabled();
    expect(within(midwestTopFeeder).getByRole("button", { name: /Howard \/ UMBC/i })).not.toBeDisabled();
    expect(within(midwestPlayInFeeder).getByRole("button", { name: /Miami \(Ohio\) \/ SMU/i })).not.toBeDisabled();
    expect(within(southFeeder).queryByText(/^TBD$/i)).not.toBeInTheDocument();
  });

  it("allows a play-in placeholder slot to advance like a normal bracket team", async () => {
    const user = userEvent.setup();
    render(<BracketPage />);

    const southFeeder = screen.getByTestId("matchup-south_r1_1");
    const placeholderButton = within(southFeeder).getByRole("button", { name: /Prairie View A&M \/ Lehigh/i });

    await user.click(placeholderButton);

    expect(placeholderButton).toHaveClass("team-slot-selected");
    expect(within(screen.getByTestId("matchup-south_r2_1")).getByRole("button", { name: /Prairie View A&M \/ Lehigh/i })).toBeInTheDocument();
  });

  it("does not require a separate manual first four pick flow", () => {
    render(<BracketPage />);
    expect(screen.queryByText("First Four")).not.toBeInTheDocument();
  });

  it("handles details for play-in placeholders without crashing", async () => {
    const user = userEvent.setup();
    render(<BracketPage />);

    await user.click(screen.getByTestId("details-south_r1_1"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Prediction details will appear when both teams are known/i)).toBeInTheDocument();
    expect(screen.getByText(/Market lines are unavailable until both teams are fully resolved/i)).toBeInTheDocument();
  });

  it("toggles bracket debug layout guides", async () => {
    const user = userEvent.setup();
    const { container } = render(<BracketPage />);

    expect(container.querySelector(".bracket-debug-column")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Show Layout Debug/i }));
    expect(container.querySelector(".bracket-debug-column")).toBeInTheDocument();
  });
});
