import { describe, expect, it } from "vitest";

import { bracketDefinition } from "./bracketDefinition";
import {
  BRACKET_LAYOUT,
  LEFT_COLUMN_POSITIONS,
  RIGHT_COLUMN_POSITIONS,
  computeBracketLayout,
  getConnectorAnchor,
  getMatchupCenterY,
  getRoundColumnX,
} from "./bracketLayout";

describe("bracketLayout", () => {
  it("uses symmetric x positions for mirrored round columns", () => {
    expect(getRoundColumnX("left", "firstRound")).toBe(LEFT_COLUMN_POSITIONS.firstRound);
    expect(getRoundColumnX("right", "firstRound")).toBe(RIGHT_COLUMN_POSITIONS.firstRound);
    expect(LEFT_COLUMN_POSITIONS.secondRound - LEFT_COLUMN_POSITIONS.firstRound).toBe(
      RIGHT_COLUMN_POSITIONS.firstRound - RIGHT_COLUMN_POSITIONS.secondRound,
    );
    expect(LEFT_COLUMN_POSITIONS.sweet16 - LEFT_COLUMN_POSITIONS.secondRound).toBe(
      RIGHT_COLUMN_POSITIONS.secondRound - RIGHT_COLUMN_POSITIONS.sweet16,
    );
    expect(LEFT_COLUMN_POSITIONS.elite8 - LEFT_COLUMN_POSITIONS.sweet16).toBe(
      RIGHT_COLUMN_POSITIONS.sweet16 - RIGHT_COLUMN_POSITIONS.elite8,
    );
  });

  it("positions later-round regional matchups at feeder midpoints", () => {
    const regionTop = 100;
    expect(getMatchupCenterY("secondRound", 0, regionTop)).toBe(
      (getMatchupCenterY("firstRound", 0, regionTop) + getMatchupCenterY("firstRound", 1, regionTop)) / 2,
    );
    expect(getMatchupCenterY("sweet16", 0, regionTop)).toBe(
      (getMatchupCenterY("secondRound", 0, regionTop) + getMatchupCenterY("secondRound", 1, regionTop)) / 2,
    );
    expect(getMatchupCenterY("elite8", 0, regionTop)).toBe(
      (getMatchupCenterY("sweet16", 0, regionTop) + getMatchupCenterY("sweet16", 1, regionTop)) / 2,
    );
  });

  it("anchors connector lines to matchup card midpoints", () => {
    const layout = computeBracketLayout(bracketDefinition);
    expect(getConnectorAnchor()).toBe(BRACKET_LAYOUT.CARD_HEIGHT / 2);
    expect(layout.connectors.length).toBeGreaterThan(0);
    const sampleConnector = layout.connectors[0];
    const sourceCard = layout.cards.find((card) => sampleConnector.id.startsWith(`${card.matchup.id}__`));
    const targetCard = layout.cards.find((card) => sampleConnector.id.endsWith(`__${card.matchup.id}`));
    expect(sampleConnector.from.y).toBe(sourceCard.centerY);
    expect(sampleConnector.to.y).toBe(targetCard.centerY);
  });
});
