import { useEffect, useMemo, useState } from "react";

import MarketContextSection from "./MarketContextSection";
import TeamLogo from "./TeamLogo";
import TeamCombobox from "./TeamCombobox";
import { fetchJson } from "./apiClient";
import { resolveTeamInput } from "./teamSearch";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function PredictGamePage() {
  const [teams, setTeams] = useState([]);
  const [teamAInput, setTeamAInput] = useState("");
  const [teamBInput, setTeamBInput] = useState("");
  const [teamASelected, setTeamASelected] = useState("");
  const [teamBSelected, setTeamBSelected] = useState("");
  const [neutralSite, setNeutralSite] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [oddsContext, setOddsContext] = useState(null);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [oddsError, setOddsError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ teamA: "", teamB: "" });
  const [fieldSuggestions, setFieldSuggestions] = useState({ teamA: null, teamB: null });

  useEffect(() => {
    async function loadTeams() {
      try {
        const data = await fetchJson(`${API_URL}/teams`, {
          errorMessage: "Could not load teams. Train the backend first.",
        });
        const loadedTeams = data.teams || [];
        setTeams(loadedTeams);
        setTeamAInput(loadedTeams[0] || "");
        setTeamBInput(loadedTeams[1] || "");
        setTeamASelected(loadedTeams[0] || "");
        setTeamBSelected(loadedTeams[1] || "");
      } catch (err) {
        setError(err.message || "Could not load teams. Train the backend first.");
      }
    }
    loadTeams();
  }, []);

  const teamAResolution = useMemo(() => resolveTeamInput(teamAInput, teams), [teamAInput, teams]);
  const teamBResolution = useMemo(() => resolveTeamInput(teamBInput, teams), [teamBInput, teams]);

  useEffect(() => {
    if (!result?.team_a || !result?.team_b) {
      setOddsContext(null);
      return;
    }
    let cancelled = false;
    async function loadOdds() {
      setOddsLoading(true);
      setOddsError("");
      try {
        const params = new URLSearchParams({ team_a: result.team_a, team_b: result.team_b });
        const payload = await fetchJson(`${API_URL}/odds?${params.toString()}`, {
          errorMessage: "Could not load market context.",
        });
        if (!cancelled) setOddsContext(payload);
      } catch (err) {
        if (!cancelled) setOddsError(err.message);
      } finally {
        if (!cancelled) setOddsLoading(false);
      }
    }
    loadOdds();
    return () => {
      cancelled = true;
    };
  }, [result]);

  function validateField(fieldName, options = {}) {
    const isSubmit = options.isSubmit || false;
    const resolution = fieldName === "teamA" ? teamAResolution : teamBResolution;
    const inputValue = fieldName === "teamA" ? teamAInput : teamBInput;
    const selectedValue = fieldName === "teamA" ? teamASelected : teamBSelected;
    const otherSelected = fieldName === "teamA" ? teamBSelected : teamASelected;

    let nextError = "";
    let nextSuggestion = null;
    let nextSelected = selectedValue;

    if (!inputValue.trim()) {
      nextError = "Enter a team name.";
      nextSelected = "";
    } else if (resolution.exactMatch) {
      nextSelected = resolution.exactMatch;
      if (otherSelected && otherSelected === resolution.exactMatch) {
        nextError = "Choose two different teams.";
      }
    } else {
      nextSelected = "";
      if (resolution.strongSuggestion) {
        nextError = `Team not found. Did you mean ${resolution.strongSuggestion}?`;
        nextSuggestion = resolution.strongSuggestion;
      } else if (resolution.suggestions.length) {
        nextError = `No exact match found. Closest matches: ${resolution.suggestions.slice(0, 3).join(", ")}`;
      } else if (isSubmit || inputValue.trim()) {
        nextError = "Team not recognized.";
      }
    }

    if (fieldName === "teamA") {
      setTeamASelected(nextSelected);
    } else {
      setTeamBSelected(nextSelected);
    }
    setFieldErrors((current) => ({ ...current, [fieldName]: nextError }));
    setFieldSuggestions((current) => ({ ...current, [fieldName]: nextSuggestion }));
    return { valid: nextError === "", selected: nextSelected };
  }

  async function handlePredict(event) {
    event.preventDefault();
    const teamAStatus = validateField("teamA", { isSubmit: true });
    const teamBStatus = validateField("teamB", { isSubmit: true });
    if (!teamAStatus.valid || !teamBStatus.valid) {
      setError("Pick two valid teams before requesting a prediction.");
      setResult(null);
      return;
    }
    if (teamAStatus.selected === teamBStatus.selected) {
      setError("Team A and Team B cannot be the same.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setOddsContext(null);
    setOddsError("");
    try {
      const payload = await fetchJson(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_a: teamAStatus.selected,
          team_b: teamBStatus.selected,
          neutral_site: neutralSite,
        }),
        errorMessage: "Prediction failed",
      });
      setResult(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mode-panel predictor-panel">
      <div className="panel-copy">
        <div className="eyebrow">Single matchup insight</div>
        <h2>Predict a game</h2>
        <p className="subtle">
          Type any two tournament teams, compare them on a neutral floor, and inspect the model lean before making your
          pick.
        </p>
      </div>

      <form className="predictor-form" onSubmit={handlePredict}>
        <TeamCombobox
          label="Team A"
          onFieldBlur={() => validateField("teamA")}
          onSelect={(team) => {
            setTeamAInput(team);
            setTeamASelected(team);
            setFieldErrors((current) => ({ ...current, teamA: "" }));
            setFieldSuggestions((current) => ({ ...current, teamA: null }));
          }}
          onValueChange={(value) => {
            setTeamAInput(value);
            setFieldErrors((current) => ({ ...current, teamA: "" }));
            setFieldSuggestions((current) => ({ ...current, teamA: null }));
          }}
          selectedTeam={teamASelected}
          suggestionAction={
            fieldSuggestions.teamA
              ? {
                  label: `Use ${fieldSuggestions.teamA}`,
                  onClick: () => {
                    setTeamAInput(fieldSuggestions.teamA);
                    setTeamASelected(fieldSuggestions.teamA);
                    setFieldErrors((current) => ({ ...current, teamA: "" }));
                    setFieldSuggestions((current) => ({ ...current, teamA: null }));
                  },
                }
              : null
          }
          teams={teams}
          validationMessage={fieldErrors.teamA}
          value={teamAInput}
        />

        <TeamCombobox
          label="Team B"
          onFieldBlur={() => validateField("teamB")}
          onSelect={(team) => {
            setTeamBInput(team);
            setTeamBSelected(team);
            setFieldErrors((current) => ({ ...current, teamB: "" }));
            setFieldSuggestions((current) => ({ ...current, teamB: null }));
          }}
          onValueChange={(value) => {
            setTeamBInput(value);
            setFieldErrors((current) => ({ ...current, teamB: "" }));
            setFieldSuggestions((current) => ({ ...current, teamB: null }));
          }}
          selectedTeam={teamBSelected}
          suggestionAction={
            fieldSuggestions.teamB
              ? {
                  label: `Use ${fieldSuggestions.teamB}`,
                  onClick: () => {
                    setTeamBInput(fieldSuggestions.teamB);
                    setTeamBSelected(fieldSuggestions.teamB);
                    setFieldErrors((current) => ({ ...current, teamB: "" }));
                    setFieldSuggestions((current) => ({ ...current, teamB: null }));
                  },
                }
              : null
          }
          teams={teams}
          validationMessage={fieldErrors.teamB}
          value={teamBInput}
        />

        <label className="toggle-row">
          <input checked={neutralSite} onChange={(event) => setNeutralSite(event.target.checked)} type="checkbox" />
          Neutral site
        </label>

        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "Predicting..." : "Run matchup"}
        </button>
      </form>

      {error ? <div className="inline-error">{error}</div> : null}

      {result ? (
        <>
          <section className="predictor-results">
            <div className="result-card highlight-card">
              <div className="eyebrow">Predicted winner</div>
              <div className="result-team-row">
                <TeamLogo size="lg" team={result.predicted_winner} />
                <h3>{result.predicted_winner}</h3>
              </div>
              <p>
                {result.team_a}: {formatPercent(result.win_probability_team_a)} | {result.team_b}:{" "}
                {formatPercent(result.win_probability_team_b)}
              </p>
              {typeof result.predicted_margin === "number" ? (
                <p>Projected margin from Team A perspective: {result.predicted_margin.toFixed(1)}</p>
              ) : null}
            </div>
            <div className="result-card">
              <div className="eyebrow">Reasoning</div>
              <ul className="reason-list">
                {result.top_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          </section>
          <section className="predictor-market-section">
            <div className="eyebrow">Market context</div>
            <h3>Market context</h3>
            <MarketContextSection error={oddsError} loading={oddsLoading} odds={oddsContext} />
          </section>
        </>
      ) : null}
    </section>
  );
}
