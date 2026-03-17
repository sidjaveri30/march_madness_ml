export default function SaveBracketControls({
  autoFillBusy = false,
  autoFillMode,
  autoFillModeDescription,
  autoFillModeOptions = [],
  onAutoFillModeChange,
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
      {autoFillModeOptions.length ? (
        <div className="autofill-mode-picker">
          <label className="autofill-mode-label" htmlFor="autofill-mode-select">
            Autofill mode
          </label>
          <select
            className="autofill-mode-select"
            id="autofill-mode-select"
            onChange={(event) => onAutoFillModeChange?.(event.target.value)}
            value={autoFillMode}
          >
            {autoFillModeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {autoFillModeDescription ? <div className="autofill-mode-description">{autoFillModeDescription}</div> : null}
        </div>
      ) : null}
      {onAutoFill ? (
        <button className="primary-button" disabled={autoFillBusy} onClick={onAutoFill} type="button">
          {autoFillBusy ? "Filling..." : "Auto-Fill Bracket"}
        </button>
      ) : null}
      {onAutoFillOverwrite ? (
        <button className="secondary-button" disabled={autoFillBusy} onClick={onAutoFillOverwrite} type="button">
          Overwrite Entry
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
