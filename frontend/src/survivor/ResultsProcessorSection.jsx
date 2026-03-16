import TeamLogo from "../TeamLogo";
import {
  getRoundConfig,
  getPickStatus,
  getPlayerCurrentRoundStatuses,
  getPlayerRoundHistory,
  getPlayerUsedTeams,
} from "./survivorPoolUtils.js";

function toneClass(tone) {
  if (tone === "success") return "survivor-status-chip-success";
  if (tone === "danger") return "survivor-status-chip-danger";
  return "";
}

function iconFor(code) {
  if (code === "won") return "✓";
  if (code === "lost") return "✕";
  if (code.startsWith("live")) return "LIVE";
  return "…";
}

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

function PlayerPickList({ statuses }) {
  if (!statuses.length) {
    return <p className="subtle">No picks saved for this round yet.</p>;
  }

  return (
    <div className="survivor-pick-chip-list">
      {statuses.map((status) => (
        <div className={`survivor-pick-chip survivor-pick-chip-${status.tone}`} key={status.teamId}>
          <div className="survivor-team-row">
            <span className={`survivor-pick-icon survivor-pick-icon-${status.tone}`}>{iconFor(status.code)}</span>
            <span>{status.teamName}</span>
          </div>
          <span className={`survivor-status-chip ${toneClass(status.tone)}`}>{status.label}</span>
        </div>
      ))}
    </div>
  );
}

function PlayerHistory({ history }) {
  if (!history.length) return null;
  return (
    <details className="survivor-history-details">
      <summary>Round history</summary>
      <div className="survivor-history-list">
        {history.map((entry) => (
          <div className="survivor-history-row" key={entry.roundKey}>
            <strong>{entry.tournamentLabel}</strong>
            <span>{entry.teamNames.join(", ") || "No picks"}</span>
            <span className={`survivor-status-chip ${entry.wasCorrect === true ? "survivor-status-chip-success" : entry.wasEliminatedRound ? "survivor-status-chip-danger" : ""}`}>
              {entry.wasCorrect === true ? "Survived" : entry.wasEliminatedRound ? "Eliminated" : "Pending"}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function ResultsProcessorSection({
  activePlayers,
  currentRound,
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
            Active picks update live as games change. When the round is official, process the results once to eliminate players, stamp used teams, and advance the pool.
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
          <span>{roundContext.roundComplete ? "Every game in this round has an official winner." : "Current pick status updates from the official live bracket as games move from upcoming to live to final."}</span>
          <strong>{roundContext.tournamentLabel}</strong>
        </div>
      ) : null}

      <div className="survivor-columns">
        <article className="survivor-card survivor-card-list">
          <div className="eyebrow">Active Survivors</div>
          {activePlayers.length ? (
            <div className="survivor-player-stack survivor-dense-stack">
              {activePlayers.map((player) => {
                const statuses = getPlayerCurrentRoundStatuses(player, currentRound, teamLookup);
                const history = getPlayerRoundHistory(player, teamLookup);
                return (
                  <div className="survivor-player-status-card survivor-player-status-card-compact" key={player.id}>
                    <div className="survivor-player-status-head">
                      <div>
                        <strong>{player.name}</strong>
                        <div className="subtle">Used teams: {getPlayerUsedTeams(player, teamLookup).join(", ") || "None yet"}</div>
                      </div>
                      <span className="survivor-status-chip">Active</span>
                    </div>
                    <PlayerPickList statuses={statuses} />
                    <PlayerHistory history={history} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="subtle">No active survivors remain.</p>
          )}
        </article>

        <article className="survivor-card survivor-card-list">
          <div className="eyebrow">Eliminated Players</div>
          {eliminatedPlayers.length ? (
            <div className="survivor-player-stack survivor-dense-stack">
              {eliminatedPlayers.map((player) => {
                const history = getPlayerRoundHistory(player, teamLookup);
                const eliminatedPickNames = (player.eliminationPickIds || []).map((teamId) => teamLookup.get(teamId) || teamId);
                const eliminatedRoundLabel = getRoundConfig(player.eliminatedRound)?.tournamentLabel || player.eliminatedRound;
                return (
                  <div className="survivor-player-status-card survivor-player-status-card-compact survivor-player-status-card-eliminated" key={player.id}>
                    <div className="survivor-player-status-head">
                      <div>
                        <strong>{player.name}</strong>
                        <div className="subtle">
                          {player.eliminatedRound ? `Eliminated in ${eliminatedRoundLabel}` : "Eliminated"}
                        </div>
                      </div>
                      <span className="survivor-status-chip survivor-status-chip-danger">Out</span>
                    </div>
                    <div className="survivor-elimination-reason">
                      <div>{player.eliminationReason || "Eliminated"}</div>
                      {eliminatedPickNames.length ? <div className="subtle">Incorrect pick: {eliminatedPickNames.join(", ")}</div> : null}
                    </div>
                    <PlayerHistory history={history} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="subtle">Nobody has been knocked out yet.</p>
          )}
        </article>
      </div>

      <article className="survivor-card survivor-card-list">
        <div className="eyebrow">Current Round Matchups</div>
        {roundContext?.matchups?.length ? (
          <div className="survivor-matchup-compact-grid">
            {roundContext.matchups.map((matchup) => (
              <div className="survivor-matchup-compact-row" key={matchup.id}>
                <div className="survivor-matchup-compact-teams">
                  {matchup.resolvedTeams.map((team) => {
                    const pickState = getPickStatus(roundContext, team.id);
                    return (
                      <div className="survivor-team-row" key={team.id}>
                        <TeamLogo size="sm" team={team.name} />
                        <span>{team.name}</span>
                        <span className={`survivor-status-chip ${toneClass(pickState.tone)}`}>{pickState.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="survivor-matchup-compact-meta">
                  <span className="subtle">{matchup.label}</span>
                  <WinnerSummary matchup={matchup} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="subtle">No official round data is available yet.</p>
        )}
      </article>
    </section>
  );
}
