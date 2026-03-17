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

export default function EntryManager({
  activeEntry,
  activeEntryId,
  draftName,
  entries,
  onCreateEntry,
  onDeleteEntry,
  onRenameDraft,
  onRenameEntry,
  onSelectEntry,
}) {
  return (
    <div className="entry-manager">
      <div className="entry-manager-summary">
        <div>
          <div className="eyebrow">My Entries</div>
          <div className="entry-manager-title">{entries.length} saved bracket entries</div>
          <div className="entry-manager-subtle">
            Active entry: <strong>{activeEntry?.name || "Entry"}</strong>
            {activeEntry?.updatedAt ? <span>Updated {formatUpdatedAt(activeEntry.updatedAt)}</span> : null}
          </div>
        </div>
        <button className="secondary-button" onClick={onCreateEntry} type="button">
          New Entry
        </button>
      </div>

      <div className="entry-pill-list" role="tablist" aria-label="Saved bracket entries">
        {entries.map((entry) => (
          <button
            aria-selected={entry.id === activeEntryId}
            className={`entry-pill ${entry.id === activeEntryId ? "entry-pill-active" : ""}`}
            key={entry.id}
            onClick={() => onSelectEntry(entry.id)}
            role="tab"
            type="button"
          >
            <span className="entry-pill-name">{entry.name}</span>
            <span className="entry-pill-meta">{entry.id === activeEntryId ? "Active" : formatUpdatedAt(entry.updatedAt)}</span>
          </button>
        ))}
      </div>

      <div className="entry-manager-row">
        <label className="entry-manager-field">
          <span className="field-label">Entry Name</span>
          <input className="entry-name-input" onChange={(event) => onRenameDraft(event.target.value)} type="text" value={draftName} />
        </label>

        <div className="entry-manager-actions">
          <button className="secondary-button" onClick={onRenameEntry} type="button">
            Rename Entry
          </button>
          <button className="secondary-button" disabled={entries.length <= 1} onClick={onDeleteEntry} type="button">
            Delete Entry
          </button>
        </div>
      </div>
    </div>
  );
}
