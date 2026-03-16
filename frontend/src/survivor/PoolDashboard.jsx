export default function PoolDashboard({
  activePlayers,
  currentRound,
  eliminatedPlayers,
  pool,
  processedRoundCount,
}) {
  return (
    <section className="survivor-section">
      <div className="survivor-section-header">
        <div>
          <div className="eyebrow">Pool Dashboard</div>
          <h3>{pool.name}</h3>
          <p className="subtle">The pool follows the official NCAA bracket automatically. Players only choose from teams still alive in the current tournament round.</p>
        </div>
      </div>

      <div className="survivor-dashboard-grid">
        <article className="survivor-card">
          <div className="eyebrow">Current Round</div>
          <strong>{currentRound?.tournamentLabel || "Tournament Complete"}</strong>
          <p className="subtle">
            {currentRound ? `${currentRound.requiredPicks} required pick${currentRound.requiredPicks === 1 ? "" : "s"}` : "No further picks required"}
          </p>
        </article>
        <article className="survivor-card">
          <div className="eyebrow">Active Survivors</div>
          <strong>{activePlayers.length}</strong>
          <p className="subtle">Players still eligible to advance through the bracket.</p>
        </article>
        <article className="survivor-card">
          <div className="eyebrow">Rounds Processed</div>
          <strong>{processedRoundCount}</strong>
          <p className="subtle">Official tournament rounds already scored in the pool.</p>
        </article>
      </div>

      <div className="survivor-columns">
        <article className="survivor-card survivor-card-list">
          <div className="eyebrow">Still Alive</div>
          {activePlayers.length ? (
            <ul className="survivor-player-list">
              {activePlayers.map((player) => (
                <li className="survivor-player-row" key={player.id}>
                  <span>{player.name}</span>
                  <span className="survivor-status-chip">Active</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="subtle">No active survivors remain.</p>
          )}
        </article>

        <article className="survivor-card survivor-card-list">
          <div className="eyebrow">Eliminated</div>
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
            <p className="subtle">No eliminations recorded yet.</p>
          )}
        </article>
      </div>
    </section>
  );
}
