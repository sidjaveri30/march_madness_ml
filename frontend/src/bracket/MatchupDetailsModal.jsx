import TeamLogo from "../TeamLogo";
import { getTeamName, isPickableTeam, isPlaceholderTeam } from "./bracketTeams";

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function MatchupDetailsModal({ matchup, teams, prediction, winner, onClose, onPick }) {
  if (!matchup) return null;
  const [teamA, teamB] = teams;
  const teamAName = getTeamName(teamA);
  const teamBName = getTeamName(teamB);
  const canPickA = isPickableTeam(teamA);
  const canPickB = isPickableTeam(teamB);

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
            className={`modal-team-card ${winner === teamA ? "modal-team-card-selected" : ""}`}
            disabled={!canPickA}
            onClick={() => canPickA && onPick(teamA)}
            type="button"
          >
            <TeamLogo size="lg" team={teamAName} />
            <span className="modal-team-name">{teamAName || "TBD"}</span>
            <span className="modal-team-action">
              {canPickA ? `Advance ${teamAName}` : isPlaceholderTeam(teamA) ? "Play-In placeholder" : "Awaiting team"}
            </span>
          </button>
          <div className="modal-vs">vs</div>
          <button
            className={`modal-team-card ${winner === teamB ? "modal-team-card-selected" : ""}`}
            disabled={!canPickB}
            onClick={() => canPickB && onPick(teamB)}
            type="button"
          >
            <TeamLogo size="lg" team={teamBName} />
            <span className="modal-team-name">{teamBName || "TBD"}</span>
            <span className="modal-team-action">
              {canPickB ? `Advance ${teamBName}` : isPlaceholderTeam(teamB) ? "Play-In placeholder" : "Awaiting team"}
            </span>
          </button>
        </div>

        <div className="modal-pick-status">
          {winner ? <span>Current pick: <strong>{winner}</strong></span> : <span>No winner selected yet.</span>}
        </div>

        {prediction?.loading ? <div className="modal-state">Loading model prediction...</div> : null}
        {prediction?.error ? <div className="modal-state error">{prediction.error}</div> : null}

        {prediction?.data ? (
          <div className="modal-grid">
            <div className="modal-panel">
              <div className="eyebrow">Model lean</div>
              <h4>{prediction.data.predicted_winner}</h4>
              <div className="probability-row">
                <span>{prediction.data.team_a}</span>
                <strong>{formatPercent(prediction.data.win_probability_team_a)}</strong>
              </div>
              <div className="probability-row">
                <span>{prediction.data.team_b}</span>
                <strong>{formatPercent(prediction.data.win_probability_team_b)}</strong>
              </div>
              {typeof prediction.data.predicted_margin === "number" ? (
                <p>Projected margin: {prediction.data.predicted_margin.toFixed(1)}</p>
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
          </div>
        ) : null}

        {!prediction?.data && !prediction?.loading && !prediction?.error ? (
          <div className="modal-state">Prediction details will appear when both teams are known.</div>
        ) : null}
      </div>
    </div>
  );
}
