import { describe, expect, it } from "vitest";

import { bracketDefinition } from "./bracketDefinition";
import {
  buildPredictionNameLookup,
  findClosestPredictionTeam,
  getBracketTeamNames,
  resolvePredictionTeamName,
  resetPredictionTeamCache,
  validateBracketPredictionNames,
} from "./teamNameResolver";

describe("teamNameResolver", () => {
  const predictorTeams = [
    "Cal Baptist",
    "Ohio St.",
    "Michigan St.",
    "Iowa St.",
    "N.C. State",
    "Miami FL",
    "Miami OH",
    "Saint Mary's",
    "North Dakota St.",
    "LIU",
    "Texas A&M",
    "Prairie View A&M",
    "Queens",
    "Hawaii",
    "Kennesaw St.",
    "Wright St.",
    "Connecticut",
    "UCLA",
    "BYU",
    "SMU",
    "UCF",
    "VCU",
    "UMBC",
    "TCU",
  ];

  it("maps common bracket display aliases to predictor team names", async () => {
    resetPredictionTeamCache();
    global.fetch = async (url) => ({
      ok: true,
      json: async () => ({ teams: predictorTeams }),
    });

    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "Cal Baptist")).resolves.toBe("Cal Baptist");
    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "Ohio State")).resolves.toBe("Ohio St.");
    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "NC State")).resolves.toBe("N.C. State");
    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "UConn")).resolves.toBe("Connecticut");
    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "Miami (FL)")).resolves.toBe("Miami FL");
    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "Miami (Ohio)")).resolves.toBe("Miami OH");
    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "Long Island")).resolves.toBe("LIU");
    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "Saint Mary's")).resolves.toBe("Saint Mary's");
    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "Hawai'i")).resolves.toBe("Hawaii");
    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "Queens (N.C.)")).resolves.toBe("Queens");
  });

  it("builds a lookup that includes explicit aliases without inventing missing predictor names", () => {
    const lookup = buildPredictionNameLookup(predictorTeams);
    expect(lookup.get("cal baptist")).toBe("Cal Baptist");
    expect(lookup.get("ohio state")).toBe("Ohio St.");
    expect(lookup.get("miami fl")).toBe("Miami FL");

    const missingLookup = buildPredictionNameLookup(["Ohio St."]);
    expect(missingLookup.get("cal baptist")).toBeUndefined();
  });

  it("uses a stable fuzzy fallback when punctuation or naming variants differ", async () => {
    resetPredictionTeamCache();
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ teams: predictorTeams }),
    });

    expect(findClosestPredictionTeam("Queens (N.C.)", predictorTeams)).toBe("Queens");
    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "Queens (N.C.)")).resolves.toBe("Queens");
  });

  it("falls back to backend team search before throwing an unknown-team error", async () => {
    resetPredictionTeamCache();
    global.fetch = async (url) => {
      if (String(url).includes("/teams/search?")) {
        return {
          ok: true,
          json: async () => ({
            exact_match: null,
            strong_match: "Tennessee State",
            matches: ["Tennessee State"],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ teams: ["Duke", "Siena"] }),
      };
    };

    await expect(resolvePredictionTeamName("http://127.0.0.1:8000", "Tennessee St.")).resolves.toBe("Tennessee State");
  });

  it("validates every bracket team against predictor names", async () => {
    resetPredictionTeamCache();
    const bracketTeams = getBracketTeamNames(bracketDefinition);
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ teams: [...new Set([...predictorTeams, ...bracketTeams.map((team) => lookupFallback(team))])] }),
    });

    const result = await validateBracketPredictionNames("http://127.0.0.1:8000", bracketDefinition);
    expect(result.totalTeams).toBe(bracketTeams.length);
    expect(result.teams.every((entry) => entry.mode === "predictor" || entry.mode === "fallback")).toBe(true);
  });
});

function lookupFallback(team) {
  const fallback = {
    "Cal Baptist": "Cal Baptist",
    "Ohio St.": "Ohio St.",
    "St. John's": "St. John's",
    "Michigan St.": "Michigan St.",
    "North Dakota St.": "North Dakota St.",
    "Utah St.": "Utah St.",
    "Kennesaw St.": "Kennesaw St.",
    "Miami (FL)": "Miami FL",
    "Queens (N.C.)": "Queens",
    "Iowa St.": "Iowa St.",
    "Wright St.": "Wright St.",
    "Tennessee St.": "Tennessee State",
    "Prairie View A&M": "Prairie View A&M",
    "Miami (Ohio)": "Miami OH",
  };
  return fallback[team] || team;
}
