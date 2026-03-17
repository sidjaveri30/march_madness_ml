import { useEffect, useState } from "react";

import MarketContextSection from "../MarketContextSection";
import TeamLogo from "../TeamLogo";
import { fetchJson } from "../apiClient";
import { getTeamName, isPickableTeam, isPlaceholderTeam, sameTeam } from "./bracketTeams";

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function MatchupDetailsModal({ matchup, teams, prediction, winner, onClose, onPick, allowSelection = true }) {
  const [teamA, teamB] = teams || [];
  const teamAName = getTeamName(teamA);
  const teamBName = getTeamName(teamB);
  const canPickA = isPickableTeam(teamA);
  const canPickB = isPickableTeam(teamB);
  const [oddsState, setOddsState] = useState({ data: null, loading: false, error: "" });

  useEffect(() => {
    if (!matchup) return undefined;
    if (!teamAName || !teamBName || teamAName.includes("/") || teamBName.includes("/")) {
      setOddsState({
        data: {
          team_a: teamAName || "TBD",
          team_b: teamBName || "TBD",
          event_found: false,
          bookmakers: [],
          consensus: {},
          model_vs_market: null,
          message: "Market lines are unavailable until both teams are fully resolved.",
        },
        loading: false,
        error: "",
      });
      return undefined;
    }
    let cancelled = false;
    async function loadOdds() {
      setOddsState({ data: null, loading: true, error: "" });
      try {
        const params = new URLSearchParams({ team_a: teamAName, team_b: teamBName });
        const payload = await fetchJson(`${API_URL}/odds?${params.toString()}`, {
          errorMessage: "Could not load market context.",
        });
        if (!cancelled) setOddsState({ data: payload, loading: false, error: "" });
      } catch (error) {
        if (!cancelled) setOddsState({ data: null, loading: false, error: error.message });
      }
    }
    loadOdds();
    return () => {
      cancelled = true;
    };
  }, [matchup, teamAName, teamBName]);

  if (!matchup) return null;

  return (
    <div className="modal-shell" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <div className="eyebrow">{matchup.region}</div>
            <h3>{matchup.label}</h3>
            {matchup.sublabel ? <p className="subtle">{matchup.sublabel}</p> : null}
          </div>
          <button className="secondary-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="modal-matchup">
          <button
            className={`modal-team-card ${sameTeam(winner, teamA) ? "modal-team-card-selected" : ""}`}
            disabled={!allowSelection || !canPickA}
            onClick={() => allowSelection && canPickA && onPick(teamA)}
            type="button"
          >
            <TeamLogo size="lg" team={teamAName} />
            <span className="modal-team-name">{teamAName || "TBD"}</span>
            <span className="modal-team-action">
              {allowSelection
                ? canPickA
                  ? `Advance ${teamAName}`
                  : isPlaceholderTeam(teamA)
                    ? "Play-In placeholder"
                    : "Awaiting team"
                : "Official tournament slot"}
            </span>
          </button>
          <div className="modal-vs">vs</div>
          <button
            className={`modal-team-card ${sameTeam(winner, teamB) ? "modal-team-card-selected" : ""}`}
            disabled={!allowSelection || !canPickB}
            onClick={() => allowSelection && canPickB && onPick(teamB)}
            type="button"
          >
            <TeamLogo size="lg" team={teamBName} />
            <span className="modal-team-name">{teamBName || "TBD"}</span>
            <span className="modal-team-action">
              {allowSelection
                ? canPickB
                  ? `Advance ${teamBName}`
                  : isPlaceholderTeam(teamB)
                    ? "Play-In placeholder"
                    : "Awaiting team"
                : "Official tournament slot"}
            </span>
          </button>
        </div>

        <div className="modal-pick-status">
          {winner ? (
            <span>{allowSelection ? "Current pick:" : "Official winner:"} <strong>{getTeamName(winner)}</strong></span>
          ) : (
            <span>{allowSelection ? "No winner selected yet." : "Official result pending."}</span>
          )}
        </div>

        {prediction?.loading ? <div className="modal-state">Loading model prediction...</div> : null}
        {prediction?.error ? <div className="modal-state error">{prediction.error}</div> : null}

        {prediction?.data ? (
          <div className="modal-grid">
            <div className="modal-panel">
              <div className="eyebrow">Model lean</div>
              <h4>{prediction.data.predicted_winner}</h4>
              <div className="probability-row probability-row-stat">
                <span>{prediction.data.team_a}</span>
                <strong>{formatPercent(prediction.data.win_probability_team_a)}</strong>
              </div>
              <div className="probability-row probability-row-stat">
                <span>{prediction.data.team_b}</span>
                <strong>{formatPercent(prediction.data.win_probability_team_b)}</strong>
              </div>
              {typeof prediction.data.predicted_margin === "number" ? (
                <p className="modal-supporting-copy">Projected margin: {prediction.data.predicted_margin.toFixed(1)}</p>
              ) : null}
            </div>
            <div className="modal-panel">
              <div className="eyebrow">Why</div>
              <ul className="reason-list">
                {prediction.data.top_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            <div className="modal-panel modal-panel-wide">
              <div className="eyebrow">Feature snapshot</div>
              <table>
                <tbody>
                  {Object.entries(prediction.data.feature_snapshot)
                    .slice(0, 12)
                    .map(([key, value]) => (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{value}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="modal-panel modal-panel-wide">
              <div className="eyebrow">Sportsbook lines</div>
              <MarketContextSection error={oddsState.error} loading={oddsState.loading} odds={oddsState.data} />
            </div>
          </div>
        ) : null}

        {!prediction?.data && !prediction?.loading && !prediction?.error ? (
          <div className="modal-grid">
            <div className="modal-state">Prediction details will appear when both teams are known.</div>
            <div className="modal-panel modal-panel-wide">
              <div className="eyebrow">Sportsbook lines</div>
              <MarketContextSection error={oddsState.error} loading={oddsState.loading} odds={oddsState.data} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
