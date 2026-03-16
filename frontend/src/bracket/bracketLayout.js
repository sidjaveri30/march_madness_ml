const BRACKET_LAYOUT = {
  FIRST_ROUND_COL_WIDTH: 156,
  LATER_ROUND_COL_WIDTH: 146,
  ROUND_COL_GAP: 16,
  CENTER_GAP: 22,
  REGION_VERTICAL_GAP: 18,
  MATCHUP_CARD_HEIGHT: 58,
  MATCHUP_INTERNAL_ROW_HEIGHT: 20,
  CARD_INNER_PADDING: 6,
  MATCHUP_ROW_GAP: 4,
  FIRST_ROUND_VERTICAL_GAP: 10,
  SECOND_ROUND_VERTICAL_GAP: 10,
  SWEET16_VERTICAL_GAP: 10,
  ELITE8_VERTICAL_GAP: 10,
  CONNECTOR_STUB_LENGTH: 14,
  CONNECTOR_MID_LENGTH: 8,
  CENTER_COLUMN_WIDTH: 286,
  ROUND_TITLE_HEIGHT: 24,
  FIRST_FOUR_COL_WIDTH: 156,
};

const BASE_VERTICAL_UNIT = BRACKET_LAYOUT.MATCHUP_CARD_HEIGHT + BRACKET_LAYOUT.FIRST_ROUND_VERTICAL_GAP;
const REGION_BLOCK_WIDTH =
  BRACKET_LAYOUT.FIRST_ROUND_COL_WIDTH +
  BRACKET_LAYOUT.LATER_ROUND_COL_WIDTH * 3 +
  BRACKET_LAYOUT.ROUND_COL_GAP * 3;

const ROUND_OFFSETS = {
  secondRound: Math.round(BASE_VERTICAL_UNIT / 2),
  sweet16: Math.round(BASE_VERTICAL_UNIT * 1.5),
  elite8: Math.round(BASE_VERTICAL_UNIT * 3.5),
  finalFour: Math.round(BASE_VERTICAL_UNIT * 3.5),
  championship: Math.round(BASE_VERTICAL_UNIT * 5.5),
};

const LEFT_COLUMN_POSITIONS = {
  firstRound: 0,
  secondRound: BRACKET_LAYOUT.FIRST_ROUND_COL_WIDTH + BRACKET_LAYOUT.ROUND_COL_GAP,
  sweet16: BRACKET_LAYOUT.FIRST_ROUND_COL_WIDTH + BRACKET_LAYOUT.ROUND_COL_GAP + BRACKET_LAYOUT.LATER_ROUND_COL_WIDTH + BRACKET_LAYOUT.ROUND_COL_GAP,
  elite8:
    BRACKET_LAYOUT.FIRST_ROUND_COL_WIDTH +
    BRACKET_LAYOUT.ROUND_COL_GAP +
    BRACKET_LAYOUT.LATER_ROUND_COL_WIDTH +
    BRACKET_LAYOUT.ROUND_COL_GAP +
    BRACKET_LAYOUT.LATER_ROUND_COL_WIDTH +
    BRACKET_LAYOUT.ROUND_COL_GAP,
};

const RIGHT_COLUMN_POSITIONS = {
  elite8: 0,
  sweet16: BRACKET_LAYOUT.LATER_ROUND_COL_WIDTH + BRACKET_LAYOUT.ROUND_COL_GAP,
  secondRound: BRACKET_LAYOUT.LATER_ROUND_COL_WIDTH * 2 + BRACKET_LAYOUT.ROUND_COL_GAP * 2,
  firstRound: BRACKET_LAYOUT.LATER_ROUND_COL_WIDTH * 3 + BRACKET_LAYOUT.ROUND_COL_GAP * 3,
};

function getColumnWidth(roundKey) {
  return roundKey === "firstRound" ? BRACKET_LAYOUT.FIRST_ROUND_COL_WIDTH : BRACKET_LAYOUT.LATER_ROUND_COL_WIDTH;
}

function getRoundColumnX(side, roundKey) {
  return side === "left" ? LEFT_COLUMN_POSITIONS[roundKey] : RIGHT_COLUMN_POSITIONS[roundKey];
}

function getConnectorAnchor() {
  return BRACKET_LAYOUT.MATCHUP_CARD_HEIGHT / 2;
}

function bracketLayoutStyle() {
  return {
    "--first-round-col-width": `${BRACKET_LAYOUT.FIRST_ROUND_COL_WIDTH}px`,
    "--later-round-col-width": `${BRACKET_LAYOUT.LATER_ROUND_COL_WIDTH}px`,
    "--round-gap-x": `${BRACKET_LAYOUT.ROUND_COL_GAP}px`,
    "--center-gap": `${BRACKET_LAYOUT.CENTER_GAP}px`,
    "--region-block-width": `${REGION_BLOCK_WIDTH}px`,
    "--region-gap-y": `${BRACKET_LAYOUT.REGION_VERTICAL_GAP}px`,
    "--matchup-card-height": `${BRACKET_LAYOUT.MATCHUP_CARD_HEIGHT}px`,
    "--matchup-row-height": `${BRACKET_LAYOUT.MATCHUP_INTERNAL_ROW_HEIGHT}px`,
    "--card-padding": `${BRACKET_LAYOUT.CARD_INNER_PADDING}px`,
    "--matchup-row-gap": `${BRACKET_LAYOUT.MATCHUP_ROW_GAP}px`,
    "--first-round-gap-y": `${BRACKET_LAYOUT.FIRST_ROUND_VERTICAL_GAP}px`,
    "--second-round-gap-y": `${BRACKET_LAYOUT.SECOND_ROUND_VERTICAL_GAP}px`,
    "--sweet16-gap-y": `${BRACKET_LAYOUT.SWEET16_VERTICAL_GAP}px`,
    "--elite8-gap-y": `${BRACKET_LAYOUT.ELITE8_VERTICAL_GAP}px`,
    "--connector-stub-length": `${BRACKET_LAYOUT.CONNECTOR_STUB_LENGTH}px`,
    "--connector-mid-length": `${BRACKET_LAYOUT.CONNECTOR_MID_LENGTH}px`,
    "--center-column-width": `${BRACKET_LAYOUT.CENTER_COLUMN_WIDTH}px`,
    "--round-title-height": `${BRACKET_LAYOUT.ROUND_TITLE_HEIGHT}px`,
    "--connector-anchor": `${getConnectorAnchor()}px`,
    "--round-offset-second": `${ROUND_OFFSETS.secondRound}px`,
    "--round-offset-sweet16": `${ROUND_OFFSETS.sweet16}px`,
    "--round-offset-elite8": `${ROUND_OFFSETS.elite8}px`,
    "--round-offset-finalFour": `${ROUND_OFFSETS.finalFour}px`,
    "--round-offset-championship": `${ROUND_OFFSETS.championship}px`,
    "--first-four-col-width": `${BRACKET_LAYOUT.FIRST_FOUR_COL_WIDTH}px`,
  };
}

export {
  BASE_VERTICAL_UNIT,
  BRACKET_LAYOUT,
  LEFT_COLUMN_POSITIONS,
  REGION_BLOCK_WIDTH,
  RIGHT_COLUMN_POSITIONS,
  ROUND_OFFSETS,
  bracketLayoutStyle,
  getColumnWidth,
  getConnectorAnchor,
  getRoundColumnX,
};
