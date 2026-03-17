const AUTO_FILL_MODE_DETAILS = {
  chalk: {
    id: "chalk",
    label: "Chalk",
    description: "Mostly favorites.",
  },
  model: {
    id: "model",
    label: "Model",
    description: "Strict highest-probability picks.",
  },
  human: {
    id: "human",
    label: "Human",
    description: "Realistic smart-fan bracket.",
  },
  random: {
    id: "random",
    label: "Random",
    description: "Every game is a pure 50/50 coin flip.",
  },
  chaos: {
    id: "chaos",
    label: "Chaos",
    description: "Upset-heavy but still plausible.",
  },
};

const AUTO_FILL_MODE_OPTIONS = Object.values(AUTO_FILL_MODE_DETAILS);
const DEFAULT_AUTO_FILL_MODE = "model";

function clampProbability(value) {
  return Math.min(0.995, Math.max(0.005, value));
}

function clampRange(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getRoundIndex(round) {
  return {
    firstRound: 0,
    secondRound: 1,
    sweet16: 2,
    elite8: 3,
    finalFour: 4,
    championship: 5,
  }[round] ?? 0;
}

function getBaseProbability(prediction, teamA) {
  if (typeof prediction?.win_probability_team_a === "number") {
    return clampProbability(prediction.win_probability_team_a);
  }
  return prediction?.predicted_winner === teamA ? 0.999 : 0.001;
}

function getUnderdogContext(seedA, seedB, probabilityTeamA) {
  const numericSeedA = Number(seedA);
  const numericSeedB = Number(seedB);
  const favoriteIsA = probabilityTeamA >= 0.5;
  const favoriteSeed = favoriteIsA ? numericSeedA : numericSeedB;
  const underdogSeed = favoriteIsA ? numericSeedB : numericSeedA;
  return {
    favoriteIsA,
    favoriteSeed,
    underdogSeed,
    seedGap:
      Number.isFinite(favoriteSeed) && Number.isFinite(underdogSeed)
        ? underdogSeed - favoriteSeed
        : null,
  };
}

function isClassicUpsetSpot(favoriteSeed, underdogSeed) {
  return (
    (favoriteSeed === 5 && underdogSeed === 12) ||
    (favoriteSeed === 6 && underdogSeed === 11) ||
    (favoriteSeed === 7 && underdogSeed === 10) ||
    (favoriteSeed === 8 && underdogSeed === 9)
  );
}

function moveTowardFavorite(probabilityTeamA, extraLean) {
  const signed = probabilityTeamA - 0.5;
  return clampProbability(0.5 + signed * (1 + extraLean));
}

function nudgeTowardUnderdog(probabilityTeamA, underdogBonus) {
  if (probabilityTeamA === 0.5) return probabilityTeamA;
  const favoriteIsA = probabilityTeamA > 0.5;
  return clampProbability(probabilityTeamA + (favoriteIsA ? -underdogBonus : underdogBonus));
}

function buildHumanAdjustment({ baseProbability, matchup, seedA, seedB, prediction }) {
  const roundIndex = getRoundIndex(matchup?.round);
  const closeness = 1 - Math.min(1, Math.abs(baseProbability - 0.5) / 0.24);
  const { favoriteSeed, underdogSeed } = getUnderdogContext(seedA, seedB, baseProbability);
  const classicUpset = isClassicUpsetSpot(favoriteSeed, underdogSeed);
  const featureSnapshot = prediction?.feature_snapshot || {};
  const underdogIsA = baseProbability < 0.5;

  const underdogEdge = (key, weight) => {
    const value = featureSnapshot[key];
    if (typeof value !== "number") return 0;
    const oriented = underdogIsA ? value : -value;
    return oriented > 0 ? oriented * weight : 0;
  };

  let adjustment = 0;
  if (classicUpset) adjustment += 0.028 * (0.65 + closeness);
  if (matchup?.round === "firstRound") adjustment += 0.012 * closeness;
  if (matchup?.round === "secondRound") adjustment += 0.006 * closeness;

  adjustment += underdogEdge("recent_form_rating_diff", 0.012);
  adjustment += underdogEdge("recent_win_pct_5_diff", 0.024);
  adjustment += underdogEdge("avg_margin_pre_diff", 0.0015);
  adjustment += underdogEdge("three_point_matchup_diff", 0.01);
  adjustment += underdogEdge("turnover_matchup_diff", 0.008);
  adjustment += underdogEdge("style_conflict_diff", 0.01);
  adjustment += underdogEdge("quality_vs_schedule_diff", 0.0035);

  const tempoClash = typeof featureSnapshot.tempo_clash_abs === "number" ? featureSnapshot.tempo_clash_abs : 0;
  if (tempoClash >= 4 && closeness > 0.4) {
    adjustment += 0.01;
  }

  if (baseProbability > 0.9 || baseProbability < 0.1) {
    adjustment *= 0.25;
  } else if (baseProbability > 0.82 || baseProbability < 0.18) {
    adjustment *= 0.55;
  }

  const maxAdjustment = [0.07, 0.05, 0.032, 0.022, 0.016, 0.012][roundIndex] ?? 0.016;
  return Math.max(-maxAdjustment, Math.min(maxAdjustment, adjustment));
}

function buildChaosProbability({ baseProbability, matchup, seedA, seedB }) {
  const roundIndex = getRoundIndex(matchup?.round);
  const { favoriteSeed, underdogSeed, seedGap } = getUnderdogContext(seedA, seedB, baseProbability);
  const classicUpset = isClassicUpsetSpot(favoriteSeed, underdogSeed);
  const flattenFactor = [0.5, 0.58, 0.68, 0.76, 0.82, 0.88][roundIndex] ?? 0.88;
  const closeness = 1 - Math.min(1, Math.abs(baseProbability - 0.5) / 0.28);

  let probability = 0.5 + (baseProbability - 0.5) * flattenFactor;
  let underdogBonus = [0.06, 0.045, 0.03, 0.02, 0.012, 0.008][roundIndex] ?? 0.008;
  if (classicUpset) underdogBonus += 0.035;
  if (typeof seedGap === "number" && seedGap >= 5) underdogBonus += 0.015;
  if (typeof seedGap === "number" && seedGap >= 8) underdogBonus -= 0.015;
  if (closeness > 0.45) underdogBonus += 0.015;

  probability = nudgeTowardUnderdog(probability, underdogBonus);

  const favoriteProbability = Math.max(probability, 1 - probability);
  const favoriteCap =
    favoriteProbability >= 0.95 ? 0.9
    : favoriteProbability >= 0.9 ? 0.84
    : favoriteProbability >= 0.82 ? 0.76
    : 0.67;

  if (probability > 0.5) {
    return clampRange(probability, 1 - favoriteCap, favoriteCap);
  }
  return clampRange(probability, 1 - favoriteCap, favoriteCap);
}

function getDeterministicWinner({ prediction, seedA, seedB, teamA, teamB }) {
  const probabilityTeamA = getBaseProbability(prediction, teamA);
  if (probabilityTeamA > 0.5) return { winner: teamA, probabilityTeamA };
  if (probabilityTeamA < 0.5) return { winner: teamB, probabilityTeamA };

  if (prediction?.predicted_winner === teamA || prediction?.predicted_winner === teamB) {
    return { winner: prediction.predicted_winner, probabilityTeamA };
  }

  const numericSeedA = Number(seedA);
  const numericSeedB = Number(seedB);
  if (Number.isFinite(numericSeedA) && Number.isFinite(numericSeedB) && numericSeedA !== numericSeedB) {
    return { winner: numericSeedA < numericSeedB ? teamA : teamB, probabilityTeamA };
  }

  return { winner: String(teamA).localeCompare(String(teamB)) <= 0 ? teamA : teamB, probabilityTeamA };
}

function getModeProbability({ mode, prediction, matchup, seedA, seedB, teamA }) {
  const baseProbability = getBaseProbability(prediction, teamA);
  const roundIndex = getRoundIndex(matchup?.round);
  const { favoriteSeed, underdogSeed, seedGap } = getUnderdogContext(seedA, seedB, baseProbability);
  const classicUpset = isClassicUpsetSpot(favoriteSeed, underdogSeed);
  const closeness = 1 - Math.min(1, Math.abs(baseProbability - 0.5) / 0.3);

  switch (mode) {
    case "random":
      return 0.5;
    case "model":
      return baseProbability;
    case "chalk": {
      const roundLean = [0.8, 0.65, 0.5, 0.4, 0.3, 0.25][roundIndex] ?? 0.25;
      const upsetBrake = classicUpset ? 0.18 : 0;
      const closeBrake = closeness > 0.7 ? 0.16 : closeness > 0.45 ? 0.08 : 0;
      return moveTowardFavorite(baseProbability, Math.max(0.05, roundLean - upsetBrake - closeBrake));
    }
    case "chaos":
      return buildChaosProbability({ baseProbability, matchup, seedA, seedB });
    case "human": {
      const adjustment = buildHumanAdjustment({
        baseProbability,
        matchup,
        seedA,
        seedB,
        prediction,
      });
      return clampProbability(nudgeTowardUnderdog(baseProbability, adjustment));
    }
    default:
      return baseProbability;
  }
}

function chooseWinnerByMode({
  matchup,
  mode = DEFAULT_AUTO_FILL_MODE,
  prediction,
  rng = Math.random,
  seedA,
  seedB,
  teamA,
  teamB,
}) {
  if (mode === "model") {
    return getDeterministicWinner({ prediction, seedA, seedB, teamA, teamB });
  }
  const probabilityTeamA = getModeProbability({
    mode,
    prediction,
    matchup,
    seedA,
    seedB,
    teamA,
  });
  return {
    probabilityTeamA,
    winner: rng() <= probabilityTeamA ? teamA : teamB,
  };
}

export { AUTO_FILL_MODE_DETAILS, AUTO_FILL_MODE_OPTIONS, DEFAULT_AUTO_FILL_MODE, chooseWinnerByMode, getModeProbability };
