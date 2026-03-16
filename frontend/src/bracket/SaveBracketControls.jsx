export default function SaveBracketControls({
  autoFillBusy = false,
  onAutoFill,
  onAutoFillOverwrite,
  onExport,
  onImport,
  onReset,
  onSave,
  saveLabel = "Save bracket",
  saveStatus,
}) {
  return (
    <div className="save-controls">
      {onAutoFill ? (
        <button className="primary-button" disabled={autoFillBusy} onClick={onAutoFill} type="button">
          {autoFillBusy ? "Filling..." : "Auto-Fill Bracket"}
        </button>
      ) : null}
      {onAutoFillOverwrite ? (
        <button className="secondary-button" disabled={autoFillBusy} onClick={onAutoFillOverwrite} type="button">
          Overwrite With Model
        </button>
      ) : null}
      <button className="secondary-button" onClick={onSave} type="button">
        {saveLabel}
      </button>
      <button className="secondary-button" onClick={onReset} type="button">
        Reset Entry
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
