import { describe, expect, it } from "vitest";

import {
  BRACKET_LAYOUT,
  LEFT_COLUMN_POSITIONS,
  REGION_BLOCK_WIDTH,
  RIGHT_COLUMN_POSITIONS,
  ROUND_OFFSETS,
  getColumnWidth,
  getConnectorAnchor,
  getRoundColumnX,
} from "./bracketLayout";

describe("bracketLayout", () => {
  it("uses symmetric x positions for mirrored round columns", () => {
    expect(getRoundColumnX("left", "secondRound")).toBe(LEFT_COLUMN_POSITIONS.secondRound);
    expect(getRoundColumnX("right", "secondRound")).toBe(RIGHT_COLUMN_POSITIONS.secondRound);
    expect(REGION_BLOCK_WIDTH).toBeGreaterThan(LEFT_COLUMN_POSITIONS.elite8);
    expect(getColumnWidth("firstRound")).toBe(BRACKET_LAYOUT.FIRST_ROUND_COL_WIDTH);
    expect(getColumnWidth("secondRound")).toBe(BRACKET_LAYOUT.LATER_ROUND_COL_WIDTH);
    expect(LEFT_COLUMN_POSITIONS.sweet16 - LEFT_COLUMN_POSITIONS.secondRound).toBe(
      RIGHT_COLUMN_POSITIONS.secondRound - RIGHT_COLUMN_POSITIONS.sweet16,
    );
    expect(LEFT_COLUMN_POSITIONS.elite8 - LEFT_COLUMN_POSITIONS.sweet16).toBe(
      RIGHT_COLUMN_POSITIONS.sweet16 - RIGHT_COLUMN_POSITIONS.elite8,
    );
  });

  it("uses deterministic vertical centering offsets by round", () => {
    expect(ROUND_OFFSETS.secondRound).toBe(Math.round((BRACKET_LAYOUT.MATCHUP_CARD_HEIGHT + BRACKET_LAYOUT.FIRST_ROUND_VERTICAL_GAP) / 2));
    expect(ROUND_OFFSETS.sweet16).toBeGreaterThan(ROUND_OFFSETS.secondRound);
    expect(ROUND_OFFSETS.elite8).toBeGreaterThan(ROUND_OFFSETS.sweet16);
    expect(ROUND_OFFSETS.finalFour).toBe(ROUND_OFFSETS.elite8);
    expect(ROUND_OFFSETS.championship).toBeGreaterThan(ROUND_OFFSETS.finalFour);
  });

  it("anchors connector lines to matchup card midpoints", () => {
    expect(getConnectorAnchor()).toBe(BRACKET_LAYOUT.MATCHUP_CARD_HEIGHT / 2);
  });
});
