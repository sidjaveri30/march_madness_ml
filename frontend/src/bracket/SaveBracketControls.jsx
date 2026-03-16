export default function SaveBracketControls({
  onExport,
  onImport,
  onReset,
  onSave,
  saveStatus,
}) {
  return (
    <div className="save-controls">
      <button className="secondary-button" onClick={onSave} type="button">
        Save bracket
      </button>
      <button className="secondary-button" onClick={onReset} type="button">
        Reset picks
      </button>
      <button className="secondary-button" onClick={onExport} type="button">
        Export JSON
      </button>
      <label className="secondary-button import-button">
        Import JSON
        <input
          accept="application/json"
          className="visually-hidden"
          onChange={onImport}
          type="file"
        />
      </label>
      {saveStatus ? <div className="save-status">{saveStatus}</div> : null}
    </div>
  );
}
