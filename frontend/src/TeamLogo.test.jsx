import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TeamLogo from "./TeamLogo";
import { getTeamLogoUrl } from "./teamMetadata";

describe("TeamLogo", () => {
  it("renders an image for known teams", () => {
    render(<TeamLogo team="Duke" />);

    const image = screen.getByRole("img", { name: "Duke logo" });
    expect(image).toHaveAttribute("src", expect.stringContaining("/150.png"));
  });

  it("falls back cleanly when a logo is missing", () => {
    render(<TeamLogo team="Hawaii" />);
    expect(screen.getByLabelText("Hawaii fallback mark")).toBeInTheDocument();
  });

  it("falls back cleanly if an image errors", () => {
    render(<TeamLogo team="Duke" />);
    const image = screen.getByRole("img", { name: "Duke logo" });
    fireEvent.error(image);
    expect(screen.getByLabelText("Duke fallback mark")).toBeInTheDocument();
  });

  it("resolves Texas A&M logo aliases consistently", () => {
    expect(getTeamLogoUrl("Texas A&M")).toContain("/245.png");
    expect(getTeamLogoUrl("Texas A and M Aggies")).toContain("/245.png");
    expect(getTeamLogoUrl("Texas A&M-Corpus Christi")).toContain("/2837.png");
  });
});
