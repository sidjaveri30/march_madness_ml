const ROUND_LABELS = {
  firstFour: "First Four",
  firstRound: "First Round",
  secondRound: "Second Round",
  sweet16: "Sweet 16",
  elite8: "Elite Eight",
  finalFour: "Final Four",
  championship: "National Championship",
};

function inputSlot(slotId, seed) {
  return { source: { type: "input", slotId }, seed };
}

function winnerSlot(matchupId, seed = "") {
  return { source: { type: "winner", matchupId }, seed };
}

const INITIAL_ASSIGNMENTS = {
  east_1: "Duke",
  east_16: "Siena",
  east_8: "Ohio St.",
  east_9: "TCU",
  east_5: "St. John's",
  east_12: "Northern Iowa",
  east_4: "Kansas",
  east_13: "Cal Baptist",
  east_6: "Louisville",
  east_11: "South Florida",
  east_3: "Michigan St.",
  east_14: "North Dakota St.",
  east_7: "UCLA",
  east_10: "UCF",
  east_2: "UConn",
  east_15: "Furman",

  south_1: "Florida",
  south_16: null,
  south_8: "Clemson",
  south_9: "Iowa",
  south_5: "Vanderbilt",
  south_12: "McNeese",
  south_4: "Nebraska",
  south_13: "Troy",
  south_6: "North Carolina",
  south_11: "VCU",
  south_3: "Illinois",
  south_14: "Penn",
  south_7: "Saint Mary's",
  south_10: "Texas A&M",
  south_2: "Houston",
  south_15: "Idaho",

  west_1: "Arizona",
  west_16: "Long Island",
  west_8: "Villanova",
  west_9: "Utah St.",
  west_5: "Wisconsin",
  west_12: "High Point",
  west_4: "Arkansas",
  west_13: "Hawaii",
  west_6: "BYU",
  west_11: null,
  west_3: "Gonzaga",
  west_14: "Kennesaw St.",
  west_7: "Miami (FL)",
  west_10: "Missouri",
  west_2: "Purdue",
  west_15: "Queens (N.C.)",

  midwest_1: "Michigan",
  midwest_16: null,
  midwest_8: "Georgia",
  midwest_9: "Saint Louis",
  midwest_5: "Texas Tech",
  midwest_12: "Akron",
  midwest_4: "Alabama",
  midwest_13: "Hofstra",
  midwest_6: "Tennessee",
  midwest_11: null,
  midwest_3: "Virginia",
  midwest_14: "Wright St.",
  midwest_7: "Kentucky",
  midwest_10: "Santa Clara",
  midwest_2: "Iowa St.",
  midwest_15: "Tennessee St.",

  ff_midwest_16_a: "Howard",
  ff_midwest_16_b: "UMBC",
  ff_west_11_a: "Texas",
  ff_west_11_b: "NC State",
  ff_south_16_a: "Prairie View A&M",
  ff_south_16_b: "Lehigh",
  ff_midwest_11_a: "Miami (Ohio)",
  ff_midwest_11_b: "SMU",
};

const FIRST_FOUR = [
  {
    id: "ff_midwest_16",
    round: "firstFour",
    label: "Howard vs UMBC",
    sublabel: "Winner advances to Michigan matchup",
    region: "First Four",
    slots: [inputSlot("ff_midwest_16_a", "16"), inputSlot("ff_midwest_16_b", "16")],
  },
  {
    id: "ff_west_11",
    round: "firstFour",
    label: "Texas vs NC State",
    sublabel: "Winner advances to BYU matchup",
    region: "First Four",
    slots: [inputSlot("ff_west_11_a", "11"), inputSlot("ff_west_11_b", "11")],
  },
  {
    id: "ff_south_16",
    round: "firstFour",
    label: "Prairie View A&M vs Lehigh",
    sublabel: "Winner advances to Florida matchup",
    region: "First Four",
    slots: [inputSlot("ff_south_16_a", "16"), inputSlot("ff_south_16_b", "16")],
  },
  {
    id: "ff_midwest_11",
    round: "firstFour",
    label: "Miami (Ohio) vs SMU",
    sublabel: "Winner advances to Tennessee matchup",
    region: "First Four",
    slots: [inputSlot("ff_midwest_11_a", "11"), inputSlot("ff_midwest_11_b", "11")],
  },
];

const FIRST_FOUR_LOOKUP = Object.fromEntries(FIRST_FOUR.map((matchup) => [matchup.id, matchup]));

function regionMatchups(region, pairs) {
  const lower = region.toLowerCase();
  const firstRound = pairs.map((pair, index) => ({
    id: `${lower}_r1_${index + 1}`,
    region,
    round: "firstRound",
    label: `${region} ${ROUND_LABELS.firstRound}`,
    slots: pair,
  }));
  const secondRound = Array.from({ length: 4 }, (_, index) => ({
    id: `${lower}_r2_${index + 1}`,
    region,
    round: "secondRound",
    label: `${region} ${ROUND_LABELS.secondRound}`,
    slots: [winnerSlot(firstRound[index * 2].id), winnerSlot(firstRound[index * 2 + 1].id)],
  }));
  const sweet16 = Array.from({ length: 2 }, (_, index) => ({
    id: `${lower}_s16_${index + 1}`,
    region,
    round: "sweet16",
    label: `${region} ${ROUND_LABELS.sweet16}`,
    slots: [winnerSlot(secondRound[index * 2].id), winnerSlot(secondRound[index * 2 + 1].id)],
  }));
  const elite8 = [
    {
      id: `${lower}_e8`,
      region,
      round: "elite8",
      label: `${region} ${ROUND_LABELS.elite8}`,
      slots: [winnerSlot(sweet16[0].id), winnerSlot(sweet16[1].id)],
    },
  ];
  return { firstRound, secondRound, sweet16, elite8 };
}

const bracketDefinition = {
  rounds: ROUND_LABELS,
  firstFour: FIRST_FOUR,
  regions: {
    East: regionMatchups("East", [
      [inputSlot("east_1", "1"), inputSlot("east_16", "16")],
      [inputSlot("east_8", "8"), inputSlot("east_9", "9")],
      [inputSlot("east_5", "5"), inputSlot("east_12", "12")],
      [inputSlot("east_4", "4"), inputSlot("east_13", "13")],
      [inputSlot("east_6", "6"), inputSlot("east_11", "11")],
      [inputSlot("east_3", "3"), inputSlot("east_14", "14")],
      [inputSlot("east_7", "7"), inputSlot("east_10", "10")],
      [inputSlot("east_2", "2"), inputSlot("east_15", "15")],
    ]),
    South: regionMatchups("South", [
      [inputSlot("south_1", "1"), winnerSlot("ff_south_16", "16")],
      [inputSlot("south_8", "8"), inputSlot("south_9", "9")],
      [inputSlot("south_5", "5"), inputSlot("south_12", "12")],
      [inputSlot("south_4", "4"), inputSlot("south_13", "13")],
      [inputSlot("south_6", "6"), inputSlot("south_11", "11")],
      [inputSlot("south_3", "3"), inputSlot("south_14", "14")],
      [inputSlot("south_7", "7"), inputSlot("south_10", "10")],
      [inputSlot("south_2", "2"), inputSlot("south_15", "15")],
    ]),
    West: regionMatchups("West", [
      [inputSlot("west_1", "1"), inputSlot("west_16", "16")],
      [inputSlot("west_8", "8"), inputSlot("west_9", "9")],
      [inputSlot("west_5", "5"), inputSlot("west_12", "12")],
      [inputSlot("west_4", "4"), inputSlot("west_13", "13")],
      [inputSlot("west_6", "6"), winnerSlot("ff_west_11", "11")],
      [inputSlot("west_3", "3"), inputSlot("west_14", "14")],
      [inputSlot("west_7", "7"), inputSlot("west_10", "10")],
      [inputSlot("west_2", "2"), inputSlot("west_15", "15")],
    ]),
    Midwest: regionMatchups("Midwest", [
      [inputSlot("midwest_1", "1"), winnerSlot("ff_midwest_16", "16")],
      [inputSlot("midwest_8", "8"), inputSlot("midwest_9", "9")],
      [inputSlot("midwest_5", "5"), inputSlot("midwest_12", "12")],
      [inputSlot("midwest_4", "4"), inputSlot("midwest_13", "13")],
      [inputSlot("midwest_6", "6"), winnerSlot("ff_midwest_11", "11")],
      [inputSlot("midwest_3", "3"), inputSlot("midwest_14", "14")],
      [inputSlot("midwest_7", "7"), inputSlot("midwest_10", "10")],
      [inputSlot("midwest_2", "2"), inputSlot("midwest_15", "15")],
    ]),
  },
  finalRounds: {
    finalFour: [
      {
        id: "final_four_1",
        region: "Final Four",
        round: "finalFour",
        label: "National Semifinal",
        sublabel: "East champion vs South champion",
        slots: [winnerSlot("east_e8"), winnerSlot("south_e8")],
      },
      {
        id: "final_four_2",
        region: "Final Four",
        round: "finalFour",
        label: "National Semifinal",
        sublabel: "West champion vs Midwest champion",
        slots: [winnerSlot("west_e8"), winnerSlot("midwest_e8")],
      },
    ],
    championship: [
      {
        id: "championship",
        region: "Championship",
        round: "championship",
        label: "National Championship",
        slots: [winnerSlot("final_four_1"), winnerSlot("final_four_2")],
      },
    ],
  },
  layout: {
    leftRegions: ["East", "South"],
    rightRegions: ["West", "Midwest"],
  },
};

function getAllMatchups(definition = bracketDefinition) {
  return [
    ...definition.firstFour,
    ...Object.values(definition.regions).flatMap((region) => [
      ...region.firstRound,
      ...region.secondRound,
      ...region.sweet16,
      ...region.elite8,
    ]),
    ...definition.finalRounds.finalFour,
    ...definition.finalRounds.championship,
  ];
}

function getFirstFourMatchup(definition = bracketDefinition, matchupId) {
  return definition.firstFour.find((matchup) => matchup.id === matchupId) || null;
}

export { FIRST_FOUR_LOOKUP, bracketDefinition, getAllMatchups, getFirstFourMatchup, INITIAL_ASSIGNMENTS };
