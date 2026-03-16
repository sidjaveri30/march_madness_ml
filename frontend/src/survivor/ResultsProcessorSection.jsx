import TeamLogo from "../TeamLogo";
import { getPlayerUsedTeams } from "./survivorPoolUtils.js";

function WinnerSummary({ matchup }) {
  if (!matchup.winner) {
    return <span className="survivor-status-chip">Winner pending</span>;
  }

  return (
    <span className="survivor-status-chip survivor-status-chip-success">
      Winner: {matchup.winner}
    </span>
  );
}

export default function ResultsProcessorSection({
  activePlayers,
  eliminatedPlayers,
  onProcessResults,
  pool,
  resultsError,
  resultsMessage,
  roundContext,
  teamLookup,
}) {
  return (
    <section className="survivor-section" data-testid="survivor-results-processor">
      <div className="survivor-section-header">
        <div>
          <div className="eyebrow">Survivor Status</div>
          <h3>Official round results</h3>
          <p className="subtle">
            Winners are derived from the official bracket. Once the round is complete, process the results to eliminate players with any losing pick and lock in used teams.
          </p>
        </div>
        <button className="primary-button" disabled={!roundContext?.roundComplete} onClick={onProcessResults} type="button">
          Process Official Results
        </button>
      </div>

      {resultsError ? <div className="inline-error">{resultsError}</div> : null}
      {resultsMessage ? <div className="save-status">{resultsMessage}</div> : null}

      {roundContext ? (
        <div className="survivor-pick-summary">
          <span>{roundContext.roundComplete ? "Every game in this round has an official winner." : "Wait for every game in this round to finish before processing."}</span>
          <strong>{roundContext.tournamentLabel}</strong>
        </div>
      ) : null}

      <div className="survivor-columns">
        <article className="survivor-card survivor-card-list">
          <div className="eyebrow">Current Round Matchups</div>
          {roundContext?.matchups?.length ? (
            <div className="survivor-games-list">
              {roundContext.matchups.map((matchup) => (
                <div className="survivor-dashboard-game" key={matchup.id}>
                  {matchup.resolvedTeams.map((team) => (
                    <div className="survivor-team-row" key={team.id}>
                      <TeamLogo size="sm" team={team.name} />
                      <span>{team.name}</span>
                    </div>
                  ))}
                  <div className="survivor-game-meta">
                    <span>{matchup.label}</span>
                    <WinnerSummary matchup={matchup} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="subtle">No official round data is available yet.</p>
          )}
        </article>

        <article className="survivor-card survivor-card-list">
          <div className="eyebrow">Used Teams + Status</div>
          <div className="survivor-player-stack">
            {pool.players.map((player) => (
              <div className={`survivor-player-editor ${player.eliminated ? "survivor-player-editor-eliminated" : ""}`} key={player.id}>
                <div>
                  <strong>{player.name}</strong>
                  <div className="subtle">
                    Used teams: {getPlayerUsedTeams(player, teamLookup).join(", ") || "None yet"}
                  </div>
                </div>
                <span className={`survivor-status-chip ${player.eliminated ? "survivor-status-chip-danger" : ""}`}>
                  {player.eliminated ? player.eliminationReason || "Eliminated" : "Alive"}
                </span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="survivor-columns">
        <article className="survivor-card survivor-card-list">
          <div className="eyebrow">Active Survivors</div>
          {activePlayers.length ? (
            <ul className="survivor-player-list">
              {activePlayers.map((player) => (
                <li className="survivor-player-row" key={player.id}>
                  <span>{player.name}</span>
                  <span className="survivor-status-chip">Alive</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="subtle">No active survivors remain.</p>
          )}
        </article>

        <article className="survivor-card survivor-card-list">
          <div className="eyebrow">Eliminated Players</div>
          {eliminatedPlayers.length ? (
            <ul className="survivor-player-list">
              {eliminatedPlayers.map((player) => (
                <li className="survivor-player-row survivor-player-row-eliminated" key={player.id}>
                  <span>{player.name}</span>
                  <span className="survivor-status-chip survivor-status-chip-danger">{player.eliminationReason || "Eliminated"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="subtle">Nobody has been knocked out yet.</p>
          )}
        </article>
      </div>
    </section>
  );
}
