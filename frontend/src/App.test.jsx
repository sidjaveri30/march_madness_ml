import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("Bracket app", () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = vi.fn((url) => {
      if (String(url).includes("/teams")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ teams: ["Duke", "Vanderbilt", "Houston", "UConn"] }),
        });
      }
      if (String(url).includes("/predict")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            team_a: "Duke",
            team_b: "Siena",
            predicted_winner: "Duke",
            win_probability_team_a: 0.7,
            win_probability_team_b: 0.3,
            predicted_margin: 6.2,
            top_reasons: ["Duke owns the stronger adjusted efficiency margin."],
            feature_snapshot: { adjem_diff: 12.5 },
          }),
        });
      }
      if (String(url).includes("/odds")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            team_a: "Duke",
            team_b: "Siena",
            event_found: false,
            bookmakers: [],
            consensus: {},
            model_vs_market: null,
            message: "No market lines currently available for this matchup.",
          }),
        });
      }
      throw new Error(`Unhandled fetch ${url}`);
    });
  });

  it("shows three distinct top-level tabs", () => {
    render(<App />);

    expect(screen.getByRole("tab", { name: "Predict a Game" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "My Bracket" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Live Bracket" })).toBeInTheDocument();
  });

  it("switches to My Bracket, advances a team, and shows details", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "My Bracket" }));
    const dukeButtons = await screen.findAllByRole("button", { name: /Duke/i });
    await user.click(dukeButtons[0]);

    const detailsButtons = await screen.findAllByLabelText(/View .* details/i);
    await user.click(detailsButtons[0]);

    expect(await screen.findByText("Projected margin: 6.2")).toBeInTheDocument();
  });

  it("renders the live ticker only in Live Bracket", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByText("Live Now")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Live Bracket" }));
    expect(await screen.findByText("Live Now")).toBeInTheDocument();
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByTestId("live-games-board")).toBeInTheDocument();
  });
});
