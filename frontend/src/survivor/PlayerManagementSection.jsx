export default function PlayerManagementSection({ onAddPlayer, onRemovePlayer, onRenamePlayer, pool }) {
  return (
    <section className="survivor-section">
      <div className="survivor-section-header">
        <div>
          <div className="eyebrow">Players</div>
          <h3>Manage the pool</h3>
          <p className="subtle">Add players, rename them, and keep the active survivor list tidy. Eliminated players stay visible for tracking.</p>
        </div>
        <button className="primary-button" onClick={onAddPlayer} type="button">
          Add Player
        </button>
      </div>

      <div className="survivor-columns">
        <article className="survivor-card survivor-card-list">
          <div className="eyebrow">Active Players</div>
          {pool.players.filter((player) => !player.eliminated).length ? (
            <div className="survivor-player-stack">
              {pool.players
                .filter((player) => !player.eliminated)
                .map((player) => (
                  <div className="survivor-player-editor" key={player.id}>
                    <input
                      aria-label={`${player.name} name`}
                      className="survivor-input"
                      onChange={(event) => onRenamePlayer(player.id, event.target.value)}
                      value={player.name}
                    />
                    <div className="survivor-inline-actions">
                      <button className="secondary-button" onClick={() => onRemovePlayer(player.id)} type="button">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="subtle">Add a few friends to start the pool.</p>
          )}
        </article>

        <article className="survivor-card survivor-card-list">
          <div className="eyebrow">Eliminated Players</div>
          {pool.players.filter((player) => player.eliminated).length ? (
            <div className="survivor-player-stack">
              {pool.players
                .filter((player) => player.eliminated)
                .map((player) => (
                  <div className="survivor-player-editor survivor-player-editor-eliminated" key={player.id}>
                    <input
                      aria-label={`${player.name} name`}
                      className="survivor-input"
                      onChange={(event) => onRenamePlayer(player.id, event.target.value)}
                      value={player.name}
                    />
                    <span className="survivor-status-chip survivor-status-chip-danger">{player.eliminationReason || "Eliminated"}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="subtle">No eliminations yet.</p>
          )}
        </article>
      </div>
    </section>
  );
}
