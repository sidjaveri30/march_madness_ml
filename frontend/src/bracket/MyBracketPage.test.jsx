import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MyBracketPage from "./MyBracketPage";

describe("MyBracketPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = vi.fn((url, options) => {
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

  it("creates multiple bracket entries and switches between them independently", async () => {
    const user = userEvent.setup();
    render(<MyBracketPage />);

    const dukeButton = within(screen.getByTestId("matchup-east_r1_1")).getByRole("button", { name: /Duke/i });
    await user.click(dukeButton);
    expect(dukeButton).toHaveClass("team-slot-selected");

    await user.click(screen.getByRole("button", { name: "New Entry" }));

    const currentSelect = screen.getByRole("combobox");
    expect(currentSelect.value).toMatch(/^entry-/);
    const freshDukeButton = within(screen.getByTestId("matchup-east_r1_1")).getByRole("button", { name: /Duke/i });
    expect(freshDukeButton).not.toHaveClass("team-slot-selected");

    await user.selectOptions(currentSelect, screen.getByRole("option", { name: "Entry 1" }));
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
});
