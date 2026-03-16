import { SURVIVOR_ROUND_CONFIG } from "./survivorPoolUtils.js";

export default function AdminToolsSection({
  adminMode,
  currentRound,
  lockStatus,
  onClearCurrentPicks,
  onToggleAdminMode,
  onResetPool,
  onRollbackRound,
  pool,
  rollbackRoundKey,
  selectedPlayer,
  setRollbackRoundKey,
}) {
  const processedRounds = SURVIVOR_ROUND_CONFIG.filter((round) => pool.processedRoundKeys.includes(round.roundKey));

  return (
    <section className="survivor-section">
      <div className="survivor-section-header">
        <div>
          <div className="eyebrow">Admin Tools</div>
          <h3>Correct mistakes and reset safely</h3>
          <p className="subtle">Clear a player&apos;s current picks, roll the pool back to an earlier official round, or reset the full pool without touching My Bracket or Live Bracket.</p>
        </div>
        <div className="survivor-inline-actions">
          <span className={`survivor-status-chip ${adminMode ? "survivor-status-chip-danger" : ""}`}>
            {adminMode ? "Admin Override Enabled" : "Admin Override Off"}
          </span>
          <button className={`secondary-button ${adminMode ? "survivor-danger-button" : ""}`} onClick={onToggleAdminMode} type="button">
            {adminMode ? "Disable Admin Mode" : "Enable Admin Mode"}
          </button>
        </div>
      </div>

      <div className="survivor-columns">
        <article className="survivor-card">
          <div className="eyebrow">Current Round Controls</div>
          <div className="survivor-player-stack">
            <div className="subtle">
              Selected player: <strong>{selectedPlayer?.name || "None selected"}</strong>
            </div>
            <div className="subtle">
              Current round: <strong>{currentRound?.tournamentLabel || "Tournament complete"}</strong>
            </div>
            {lockStatus?.locked ? <div className="subtle">{lockStatus.reason}</div> : null}
            <div className="survivor-inline-actions">
              <button className="secondary-button" disabled={!selectedPlayer || !currentRound || (lockStatus?.locked && !adminMode)} onClick={onClearCurrentPicks} type="button">
                Clear Current Picks
              </button>
            </div>
          </div>
        </article>

        <article className="survivor-card">
          <div className="eyebrow">Rollback / Replay</div>
          <div className="survivor-player-stack">
            <label className="survivor-field">
              <span>Rollback to round</span>
              <select className="survivor-input" onChange={(event) => setRollbackRoundKey(event.target.value)} value={rollbackRoundKey}>
                <option value="">Select a processed round</option>
                {processedRounds.map((round) => (
                  <option key={round.roundKey} value={round.roundKey}>
                    {round.tournamentLabel}
                  </option>
                ))}
              </select>
            </label>
            <div className="subtle">Rolling back reopens that round as the current pool round so you can edit picks and reprocess from there.</div>
            <div className="survivor-inline-actions">
              <button className="secondary-button" disabled={!rollbackRoundKey} onClick={onRollbackRound} type="button">
                Roll Back
              </button>
              <button className="secondary-button survivor-danger-button" onClick={onResetPool} type="button">
                Reset Pool
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
