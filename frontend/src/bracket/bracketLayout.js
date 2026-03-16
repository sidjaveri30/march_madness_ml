const BRACKET_LAYOUT = {
  ROUND_COLUMN_WIDTH: 156,
  ROUND_COLUMN_GAP: 28,
  CARD_HEIGHT: 92,
  FINAL_FOUR_CARD_WIDTH: 188,
  FINAL_FOUR_CARD_HEIGHT: 96,
  CHAMPIONSHIP_CARD_WIDTH: 212,
  CHAMPIONSHIP_CARD_HEIGHT: 100,
  MATCHUP_META_HEIGHT: 18,
  MATCHUP_CARD_PADDING: 6,
  TEAM_ROW_HEIGHT: 24,
  SCORE_COLUMN_WIDTH: 24,
  STATUS_BADGE_HEIGHT: 16,
  FIRST_ROUND_VERTICAL_GAP: 14,
  REGION_VERTICAL_OFFSET: 78,
  REGION_SECTION_GAP: 108,
  CONNECTOR_LENGTH: 18,
  CENTER_COLUMN_WIDTH: 468,
  CENTER_GAP: 44,
  ROUND_HEADER_HEIGHT: 22,
  REGION_LABEL_HEIGHT: 20,
  BOARD_PADDING_X: 20,
  BOARD_PADDING_Y: 18,
  CENTER_VERTICAL_GAP: 28,
  CENTER_CONNECTOR_SPAN: 30,
  SEMIFINAL_CARD_GAP: 28,
};

const REGION_ROUNDS = ["firstRound", "secondRound", "sweet16", "elite8"];
const REGION_ORDER = ["East", "South", "West", "Midwest"];
const REGION_SIDE = {
  East: "left",
  South: "left",
  West: "right",
  Midwest: "right",
};

const REGION_BLOCK_WIDTH = BRACKET_LAYOUT.ROUND_COLUMN_WIDTH * 4 + BRACKET_LAYOUT.ROUND_COLUMN_GAP * 3;
const CENTER_COLUMN_X = BRACKET_LAYOUT.BOARD_PADDING_X + REGION_BLOCK_WIDTH + BRACKET_LAYOUT.CENTER_GAP;
const RIGHT_BLOCK_X = CENTER_COLUMN_X + BRACKET_LAYOUT.CENTER_COLUMN_WIDTH + BRACKET_LAYOUT.CENTER_GAP;
const BOARD_WIDTH = RIGHT_BLOCK_X + REGION_BLOCK_WIDTH + BRACKET_LAYOUT.BOARD_PADDING_X;
const CONNECTOR_ANCHOR = BRACKET_LAYOUT.CARD_HEIGHT / 2;
const BASE_VERTICAL_UNIT = BRACKET_LAYOUT.CARD_HEIGHT + BRACKET_LAYOUT.FIRST_ROUND_VERTICAL_GAP;
const REGION_HEIGHT = BRACKET_LAYOUT.CARD_HEIGHT + BASE_VERTICAL_UNIT * 7;
const TOP_REGION_Y = BRACKET_LAYOUT.BOARD_PADDING_Y + BRACKET_LAYOUT.REGION_VERTICAL_OFFSET;
const BOTTOM_REGION_Y = TOP_REGION_Y + REGION_HEIGHT + BRACKET_LAYOUT.REGION_SECTION_GAP;

const LEFT_COLUMN_POSITIONS = {
  firstRound: BRACKET_LAYOUT.BOARD_PADDING_X,
  secondRound: BRACKET_LAYOUT.BOARD_PADDING_X + BRACKET_LAYOUT.ROUND_COLUMN_WIDTH + BRACKET_LAYOUT.ROUND_COLUMN_GAP,
  sweet16: BRACKET_LAYOUT.BOARD_PADDING_X + (BRACKET_LAYOUT.ROUND_COLUMN_WIDTH + BRACKET_LAYOUT.ROUND_COLUMN_GAP) * 2,
  elite8: BRACKET_LAYOUT.BOARD_PADDING_X + (BRACKET_LAYOUT.ROUND_COLUMN_WIDTH + BRACKET_LAYOUT.ROUND_COLUMN_GAP) * 3,
};

const RIGHT_COLUMN_POSITIONS = {
  elite8: RIGHT_BLOCK_X,
  sweet16: RIGHT_BLOCK_X + BRACKET_LAYOUT.ROUND_COLUMN_WIDTH + BRACKET_LAYOUT.ROUND_COLUMN_GAP,
  secondRound: RIGHT_BLOCK_X + (BRACKET_LAYOUT.ROUND_COLUMN_WIDTH + BRACKET_LAYOUT.ROUND_COLUMN_GAP) * 2,
  firstRound: RIGHT_BLOCK_X + (BRACKET_LAYOUT.ROUND_COLUMN_WIDTH + BRACKET_LAYOUT.ROUND_COLUMN_GAP) * 3,
};

const CENTER_MATCHUP_X = CENTER_COLUMN_X + (BRACKET_LAYOUT.CENTER_COLUMN_WIDTH - BRACKET_LAYOUT.CHAMPIONSHIP_CARD_WIDTH) / 2;
const FINAL_FOUR_LEFT_X = CENTER_COLUMN_X;
const FINAL_FOUR_RIGHT_X = FINAL_FOUR_LEFT_X + BRACKET_LAYOUT.FINAL_FOUR_CARD_WIDTH + BRACKET_LAYOUT.SEMIFINAL_CARD_GAP;

function getRoundColumnX(side, roundKey) {
  return side === "left" ? LEFT_COLUMN_POSITIONS[roundKey] : RIGHT_COLUMN_POSITIONS[roundKey];
}

function getConnectorAnchor() {
  return CONNECTOR_ANCHOR;
}

function getRoundBaseCenterY(roundKey, index) {
  if (roundKey === "firstRound") {
    return CONNECTOR_ANCHOR + index * BASE_VERTICAL_UNIT;
  }
  const parentRound =
    roundKey === "secondRound"
      ? "firstRound"
      : roundKey === "sweet16"
        ? "secondRound"
        : "sweet16";
  const first = getRoundBaseCenterY(parentRound, index * 2);
  const second = getRoundBaseCenterY(parentRound, index * 2 + 1);
  return (first + second) / 2;
}

function getMatchupCenterY(roundKey, index, regionY = 0) {
  return regionY + getRoundBaseCenterY(roundKey, index);
}

function getRegionTop(region) {
  return region === "East" || region === "West" ? TOP_REGION_Y : BOTTOM_REGION_Y;
}

function createConnectorPath(from, to, direction = "right") {
  const midX = direction === "right" ? from.x + BRACKET_LAYOUT.CONNECTOR_LENGTH : from.x - BRACKET_LAYOUT.CONNECTOR_LENGTH;
  return `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`;
}

function buildRegionLayout(definition, region, side) {
  const rounds = definition.regions[region];
  const regionY = getRegionTop(region);
  const cards = [];

  REGION_ROUNDS.forEach((roundKey) => {
    rounds[roundKey].forEach((matchup, index) => {
      const centerY = getMatchupCenterY(roundKey, index, regionY);
      cards.push({
        matchup,
        roundKey,
        side,
        region,
        x: getRoundColumnX(side, roundKey),
        width: BRACKET_LAYOUT.ROUND_COLUMN_WIDTH,
        height: BRACKET_LAYOUT.CARD_HEIGHT,
        y: centerY - BRACKET_LAYOUT.CARD_HEIGHT / 2,
        centerY,
      });
    });
  });

  return cards;
}

function computeBracketLayout(definition) {
  const regionCards = REGION_ORDER.flatMap((region) => buildRegionLayout(definition, region, REGION_SIDE[region]));
  const cardLookup = Object.fromEntries(regionCards.map((card) => [card.matchup.id, card]));

  const leftSemifinalCenterY = (cardLookup.east_e8.centerY + cardLookup.south_e8.centerY) / 2;
  const rightSemifinalCenterY = (cardLookup.west_e8.centerY + cardLookup.midwest_e8.centerY) / 2;
  const championshipCenterY =
    Math.max(leftSemifinalCenterY, rightSemifinalCenterY) +
    BRACKET_LAYOUT.FINAL_FOUR_CARD_HEIGHT / 2 +
    BRACKET_LAYOUT.CENTER_VERTICAL_GAP +
    BRACKET_LAYOUT.CHAMPIONSHIP_CARD_HEIGHT / 2;

  const centerCards = [
    {
      matchup: definition.finalRounds.finalFour[0],
      roundKey: "finalFour",
      side: "center-left",
      region: "Final Four",
      x: FINAL_FOUR_LEFT_X,
      width: BRACKET_LAYOUT.FINAL_FOUR_CARD_WIDTH,
      height: BRACKET_LAYOUT.FINAL_FOUR_CARD_HEIGHT,
      y: leftSemifinalCenterY - BRACKET_LAYOUT.FINAL_FOUR_CARD_HEIGHT / 2,
      centerY: leftSemifinalCenterY,
    },
    {
      matchup: definition.finalRounds.finalFour[1],
      roundKey: "finalFour",
      side: "center-right",
      region: "Final Four",
      x: FINAL_FOUR_RIGHT_X,
      width: BRACKET_LAYOUT.FINAL_FOUR_CARD_WIDTH,
      height: BRACKET_LAYOUT.FINAL_FOUR_CARD_HEIGHT,
      y: rightSemifinalCenterY - BRACKET_LAYOUT.FINAL_FOUR_CARD_HEIGHT / 2,
      centerY: rightSemifinalCenterY,
    },
    {
      matchup: definition.finalRounds.championship[0],
      roundKey: "championship",
      side: "center",
      region: "Championship",
      x: CENTER_MATCHUP_X,
      width: BRACKET_LAYOUT.CHAMPIONSHIP_CARD_WIDTH,
      height: BRACKET_LAYOUT.CHAMPIONSHIP_CARD_HEIGHT,
      y: championshipCenterY - BRACKET_LAYOUT.CHAMPIONSHIP_CARD_HEIGHT / 2,
      centerY: championshipCenterY,
    },
  ];

  centerCards.forEach((card) => {
    cardLookup[card.matchup.id] = card;
  });

  const allCards = [...regionCards, ...centerCards];

  const connectors = [];
  for (const card of allCards) {
    const feederSlots = card.matchup.slots.filter((slot) => slot.source.type === "winner");
    if (feederSlots.length === 0) continue;

    feederSlots.forEach((slot) => {
      const feeder = cardLookup[slot.source.matchupId];
      if (!feeder) return;

      const feederDirection = feeder.side === "right" || feeder.side === "center-right" ? "left" : "right";
      const targetDirection = card.side === "right" || card.side === "center-right" ? "right" : "left";

      const from =
        feederDirection === "right"
          ? { x: feeder.x + feeder.width, y: feeder.centerY }
          : { x: feeder.x, y: feeder.centerY };

      const to =
        targetDirection === "left"
          ? { x: card.x, y: card.centerY }
          : { x: card.x + card.width, y: card.centerY };

      connectors.push({
        id: `${slot.source.matchupId}__${card.matchup.id}`,
        path: createConnectorPath(from, to, from.x <= to.x ? "right" : "left"),
        from,
        to,
      });
    });
  }

  const roundHeaders = [
    { key: "left-firstRound", label: "First Round", x: LEFT_COLUMN_POSITIONS.firstRound, width: BRACKET_LAYOUT.ROUND_COLUMN_WIDTH, top: 0 },
    { key: "left-secondRound", label: "Second Round", x: LEFT_COLUMN_POSITIONS.secondRound, width: BRACKET_LAYOUT.ROUND_COLUMN_WIDTH, top: 0 },
    { key: "left-sweet16", label: "Sweet 16", x: LEFT_COLUMN_POSITIONS.sweet16, width: BRACKET_LAYOUT.ROUND_COLUMN_WIDTH, top: 0 },
    { key: "left-elite8", label: "Elite 8", x: LEFT_COLUMN_POSITIONS.elite8, width: BRACKET_LAYOUT.ROUND_COLUMN_WIDTH, top: 0 },
    { key: "center-final-four", label: "Final Four", x: CENTER_COLUMN_X, width: BRACKET_LAYOUT.CENTER_COLUMN_WIDTH, top: 0 },
    { key: "center-championship", label: "Championship", x: CENTER_MATCHUP_X, width: BRACKET_LAYOUT.CHAMPIONSHIP_CARD_WIDTH, top: 20 },
    { key: "right-elite8", label: "Elite 8", x: RIGHT_COLUMN_POSITIONS.elite8, width: BRACKET_LAYOUT.ROUND_COLUMN_WIDTH, top: 0 },
    { key: "right-sweet16", label: "Sweet 16", x: RIGHT_COLUMN_POSITIONS.sweet16, width: BRACKET_LAYOUT.ROUND_COLUMN_WIDTH, top: 0 },
    { key: "right-secondRound", label: "Second Round", x: RIGHT_COLUMN_POSITIONS.secondRound, width: BRACKET_LAYOUT.ROUND_COLUMN_WIDTH, top: 0 },
    { key: "right-firstRound", label: "First Round", x: RIGHT_COLUMN_POSITIONS.firstRound, width: BRACKET_LAYOUT.ROUND_COLUMN_WIDTH, top: 0 },
  ];

  const regionLabels = REGION_ORDER.map((region) => ({
    region,
    x: REGION_SIDE[region] === "left" ? LEFT_COLUMN_POSITIONS.firstRound : RIGHT_COLUMN_POSITIONS.elite8,
    y: getRegionTop(region) - 34,
    width: REGION_BLOCK_WIDTH,
    side: REGION_SIDE[region],
  }));

  const columnGuides = [
    ...Object.entries(LEFT_COLUMN_POSITIONS).map(([roundKey, x]) => ({ key: `guide-left-${roundKey}`, x })),
    { key: "guide-center-left", x: FINAL_FOUR_LEFT_X },
    { key: "guide-center-right", x: FINAL_FOUR_RIGHT_X },
    { key: "guide-center-championship", x: CENTER_MATCHUP_X },
    ...Object.entries(RIGHT_COLUMN_POSITIONS).map(([roundKey, x]) => ({ key: `guide-right-${roundKey}`, x })),
  ];

  const boardHeight = Math.max(
    BOTTOM_REGION_Y + REGION_HEIGHT + BRACKET_LAYOUT.BOARD_PADDING_Y,
    championshipCenterY + BRACKET_LAYOUT.CARD_HEIGHT / 2 + BRACKET_LAYOUT.BOARD_PADDING_Y,
  );

  return {
    board: {
      width: BOARD_WIDTH,
      height: boardHeight,
    },
    cards: allCards,
    connectors,
    roundHeaders,
    regionLabels,
    guides: {
      columns: columnGuides,
      points: allCards.map((card) => ({
        key: `point-${card.matchup.id}`,
        x: card.x + card.width / 2,
        y: card.centerY,
      })),
      anchors: connectors.flatMap((connector) => [
        { key: `anchor-from-${connector.id}`, x: connector.from.x, y: connector.from.y },
        { key: `anchor-to-${connector.id}`, x: connector.to.x, y: connector.to.y },
      ]),
    },
  };
}

function bracketLayoutStyle() {
  return {
    "--round-column-width": `${BRACKET_LAYOUT.ROUND_COLUMN_WIDTH}px`,
    "--round-column-gap": `${BRACKET_LAYOUT.ROUND_COLUMN_GAP}px`,
    "--card-height": `${BRACKET_LAYOUT.CARD_HEIGHT}px`,
    "--matchup-meta-height": `${BRACKET_LAYOUT.MATCHUP_META_HEIGHT}px`,
    "--matchup-card-padding": `${BRACKET_LAYOUT.MATCHUP_CARD_PADDING}px`,
    "--team-row-height": `${BRACKET_LAYOUT.TEAM_ROW_HEIGHT}px`,
    "--score-column-width": `${BRACKET_LAYOUT.SCORE_COLUMN_WIDTH}px`,
    "--connector-length": `${BRACKET_LAYOUT.CONNECTOR_LENGTH}px`,
  };
}

export {
  BASE_VERTICAL_UNIT,
  BOARD_WIDTH,
  BRACKET_LAYOUT,
  CENTER_COLUMN_X,
  CENTER_MATCHUP_X,
  CONNECTOR_ANCHOR,
  LEFT_COLUMN_POSITIONS,
  REGION_BLOCK_WIDTH,
  REGION_HEIGHT,
  RIGHT_COLUMN_POSITIONS,
  TOP_REGION_Y,
  BOTTOM_REGION_Y,
  bracketLayoutStyle,
  computeBracketLayout,
  getConnectorAnchor,
  getMatchupCenterY,
  getRoundColumnX,
};
