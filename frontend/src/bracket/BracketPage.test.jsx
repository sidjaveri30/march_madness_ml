import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BracketPage from "./BracketPage";

describe("BracketPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = vi.fn((url, options) => {
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

    await user.click(pickButton("matchup-ff_south_16", "Lehigh"));
    await user.click(pickButton("matchup-south_r1_1", "Florida"));
    await user.click(pickButton("matchup-south_r1_2", "Clemson"));
    await user.click(pickButton("matchup-south_r2_1", "Florida"));

    await user.click(screen.getByTestId("details-south_r1_1"));
    await user.click(screen.getByRole("button", { name: /Advance Lehigh/i }));

    const southRoundTwo = screen.getByTestId("matchup-south_r2_1");
    expect(within(southRoundTwo).queryByRole("button", { name: /Florida/i })).not.toBeInTheDocument();
    expect(within(southRoundTwo).getByRole("button", { name: /Lehigh/i })).toBeInTheDocument();
    expect(within(southRoundTwo).queryByRole("button", { name: /Clemson/i })).toBeInTheDocument();
    expect(within(southRoundTwo).queryByRole("button", { name: /Lehigh/i })).not.toHaveClass("team-slot-selected");
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

  it("shows first four placeholders in the main bracket and does not show TBD in those slots", () => {
    render(<BracketPage />);

    const southFeeder = screen.getByTestId("matchup-south_r1_1");
    const westFeeder = screen.getByTestId("matchup-west_r1_5");
    const midwestTopFeeder = screen.getByTestId("matchup-midwest_r1_1");
    const midwestPlayInFeeder = screen.getByTestId("matchup-midwest_r1_5");

    expect(within(southFeeder).getByRole("button", { name: /Prairie View A&M \/ Lehigh/i })).toBeDisabled();
    expect(within(westFeeder).getByRole("button", { name: /Texas \/ NC State/i })).toBeDisabled();
    expect(within(midwestTopFeeder).getByRole("button", { name: /Howard \/ UMBC/i })).toBeDisabled();
    expect(within(midwestPlayInFeeder).getByRole("button", { name: /Miami \(Ohio\) \/ SMU/i })).toBeDisabled();
    expect(within(southFeeder).queryByText(/^TBD$/i)).not.toBeInTheDocument();
  });
});
