import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LiveBracketPage from "./LiveBracketPage";
import MyBracketPage from "./MyBracketPage";
import { resetSharedLiveFeedStores } from "./liveBracketProvider";
import { MOCK_LIVE_SNAPSHOTS } from "./liveBracketData";

describe("LiveBracketPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSharedLiveFeedStores();
    let liveScoreboardCallCount = 0;
    global.fetch = vi.fn((url, options) => {
      if (String(url).includes("/live-scoreboard")) {
        const snapshot = MOCK_LIVE_SNAPSHOTS[Math.min(liveScoreboardCallCount, MOCK_LIVE_SNAPSHOTS.length - 1)];
        liveScoreboardCallCount += 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            provider: "espn",
            fetchedAt: "2026-03-17T10:00:00Z",
            fallbackProvider: null,
            error: null,
            games: Object.values(snapshot.games),
          }),
        });
      }
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

    expect(await screen.findByText("Live Now")).toBeInTheDocument();
    expect(await screen.findByText(/2H 12:14/i)).toBeInTheDocument();
    expect(within(screen.getByTestId("matchup-midwest_r1_1")).getByRole("button", { name: /Howard \/ UMBC/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh Now" }));

    expect(await screen.findAllByText("FINAL")).not.toHaveLength(0);
    expect(within(screen.getByTestId("matchup-midwest_r1_1")).getByRole("button", { name: /Howard/i })).toBeInTheDocument();
    expect(within(screen.getByTestId("matchup-east_r2_1")).getByRole("button", { name: /Ohio St\./i })).toBeInTheDocument();
  });

  it("does not let official live advancement modify My Bracket entries", async () => {
    const user = userEvent.setup();
    render(<MyBracketPage />);

    await user.click(within(screen.getByTestId("matchup-east_r1_2")).getByRole("button", { name: /TCU/i }));
    expect(within(screen.getByTestId("matchup-east_r1_2")).getByRole("button", { name: /TCU/i })).toHaveClass("team-slot-selected");

    render(<LiveBracketPage />);
    await user.click(await screen.findByRole("button", { name: "Refresh Now" }));

    expect(JSON.parse(window.localStorage.getItem("march-madness-bracket-workspace-v1")).entries[0].state.picks.east_r1_2).toBe("TCU");
  });

  it("handles live matchup details without crashing when teams are unresolved placeholders", async () => {
    const user = userEvent.setup();
    render(<LiveBracketPage />);

    await user.click(screen.getByTestId("details-midwest_r1_1"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Market lines are unavailable until both teams are fully resolved/i)).toBeInTheDocument();
  });

  it("renders the grouped live games board", () => {
    render(<LiveBracketPage />);

    expect(screen.getByTestId("live-games-board")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
  });

  it("opens ESPN in a new tab when a live matchup card is clicked", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<LiveBracketPage />);

    const matchupCard = await screen.findByTestId("matchup-east_r1_2");
    expect(matchupCard).toHaveAttribute("role", "link");

    await user.click(matchupCard);

    expect(openSpy).toHaveBeenCalledWith(
      "https://www.espn.com/mens-college-basketball/game/_/gameId/401580928",
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockRestore();
  });
});
