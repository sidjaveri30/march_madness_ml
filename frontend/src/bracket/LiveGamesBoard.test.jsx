import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import LiveGamesBoard from "./LiveGamesBoard";

const sections = {
  live: [
    { matchupId: "live-1", gameId: "401580926", status: "live", statusLabel: "LIVE 2H 12:14", teamA: "Howard", teamB: "UMBC", teamAScore: 34, teamBScore: 29 },
  ],
  final: [],
  upcoming: [
    { matchupId: "upcoming-1", status: "upcoming", statusLabel: "Thu 3:15 PM", teamA: "Nebraska", teamB: "Troy" },
    { matchupId: "upcoming-2", status: "upcoming", statusLabel: "Thu 4:10 PM", teamA: "Arizona", teamB: "Long Island" },
    { matchupId: "upcoming-3", status: "upcoming", statusLabel: "Thu 8:45 PM", teamA: "Saint Mary's", teamB: "Drake" },
  ],
};

describe("LiveGamesBoard", () => {
  it("shows grouped sections and compact metadata", () => {
    render(<LiveGamesBoard sections={sections} />);

    expect(screen.getByText("Live Now")).toBeInTheDocument();
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText("12:14 2H")).toBeInTheDocument();
    expect(screen.queryByText("LIVE 2H 12:14")).not.toBeInTheDocument();
  });

  it("collapses long upcoming lists until expanded", async () => {
    const user = userEvent.setup();
    render(<LiveGamesBoard sections={sections} />);

    const upcomingSection = screen.getByText("Upcoming").closest(".ticker-section");
    expect(within(upcomingSection).queryByText("Saint Mary's")).not.toBeInTheDocument();

    await user.click(within(upcomingSection).getByRole("button", { name: /See More/i }));
    expect(within(upcomingSection).getByText("Saint Mary's")).toBeInTheDocument();

    await user.click(within(upcomingSection).getByRole("button", { name: /Show Less/i }));
    expect(within(upcomingSection).queryByText("Saint Mary's")).not.toBeInTheDocument();
  });

  it("links ticker cards to ESPN when a game id exists", () => {
    render(<LiveGamesBoard sections={sections} />);

    const link = screen.getByRole("link", { name: /Open ESPN game page for Howard vs UMBC/i });
    expect(link).toHaveAttribute("href", "https://www.espn.com/mens-college-basketball/game/_/gameId/401580926");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
