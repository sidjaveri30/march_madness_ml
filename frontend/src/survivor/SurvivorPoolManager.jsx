function formatUpdatedAt(value) {
  if (!value) return "Just now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Just now";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export default function SurvivorPoolManager({
  activePool,
  activePoolId,
  draftName,
  onCreatePool,
  onDeletePool,
  onRenameDraft,
  onRenamePool,
  onSelectPool,
  pools,
}) {
  return (
    <section className="survivor-section">
      <div className="entry-manager">
        <div className="entry-manager-summary">
          <div>
            <div className="eyebrow">Survivor Pools</div>
            <div className="entry-manager-title">{pools.length} saved survivor {pools.length === 1 ? "pool" : "pools"}</div>
            <div className="entry-manager-subtle">
              Active pool: <strong>{activePool?.name || "Pool"}</strong>
              {activePool?.updatedAt ? <span>Updated {formatUpdatedAt(activePool.updatedAt)}</span> : null}
            </div>
          </div>
          <button className="secondary-button" onClick={onCreatePool} type="button">
            + New Pool
          </button>
        </div>

        <div className="entry-pill-list" role="tablist" aria-label="Saved survivor pools">
          {pools.map((pool) => (
            <button
              aria-selected={pool.id === activePoolId}
              className={`entry-pill ${pool.id === activePoolId ? "entry-pill-active" : ""}`}
              key={pool.id}
              onClick={() => onSelectPool(pool.id)}
              role="tab"
              type="button"
            >
              <span className="entry-pill-name">{pool.name}</span>
              <span className="entry-pill-meta">{pool.id === activePoolId ? "Active" : formatUpdatedAt(pool.updatedAt)}</span>
            </button>
          ))}
        </div>

        <div className="entry-manager-row">
          <label className="entry-manager-field">
            <span className="field-label">Pool Name</span>
            <input className="entry-name-input" onChange={(event) => onRenameDraft(event.target.value)} type="text" value={draftName} />
          </label>

          <div className="entry-manager-actions">
            <button className="secondary-button" onClick={onRenamePool} type="button">
              Rename Pool
            </button>
            <button className="secondary-button" disabled={pools.length <= 1} onClick={onDeletePool} type="button">
              Delete Pool
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
