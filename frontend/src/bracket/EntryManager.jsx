export default function EntryManager({
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
      <label className="entry-manager-field">
        <span className="eyebrow">My Entries</span>
        <select className="entry-select" onChange={(event) => onSelectEntry(event.target.value)} value={activeEntryId}>
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>

      <label className="entry-manager-field">
        <span className="eyebrow">Entry Name</span>
        <input className="entry-name-input" onChange={(event) => onRenameDraft(event.target.value)} type="text" value={draftName} />
      </label>

      <div className="entry-manager-actions">
        <button className="secondary-button" onClick={onCreateEntry} type="button">
          New Entry
        </button>
        <button className="secondary-button" onClick={onRenameEntry} type="button">
          Rename Entry
        </button>
        <button className="secondary-button" disabled={entries.length <= 1} onClick={onDeleteEntry} type="button">
          Delete Entry
        </button>
      </div>
    </div>
  );
}
