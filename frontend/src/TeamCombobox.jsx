import { useEffect, useMemo, useRef, useState } from "react";

import { getTeamSuggestions, resolveTeamInput } from "./teamSearch";

export default function TeamCombobox({
  label,
  teams,
  value,
  selectedTeam,
  onValueChange,
  onSelect,
  onFieldBlur,
  validationMessage,
  suggestionAction,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => getTeamSuggestions(value, teams), [teams, value]);
  const inputRef = useRef(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [value]);

  function commitSelection(team) {
    onSelect(team);
    setIsOpen(false);
  }

  function handleKeyDown(event) {
    if (!suggestions.length && event.key !== "Enter") return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % Math.max(suggestions.length, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current - 1 + suggestions.length) % Math.max(suggestions.length, 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const resolution = resolveTeamInput(value, teams);
      if (resolution.exactMatch) {
        commitSelection(resolution.exactMatch);
        return;
      }
      if (isOpen && suggestions[activeIndex]) {
        commitSelection(suggestions[activeIndex]);
        return;
      }
      if (resolution.strongSuggestion) {
        commitSelection(resolution.strongSuggestion);
      }
    }
    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="combobox-field">
      <label>
        {label}
        <div className={`combobox ${validationMessage ? "combobox-invalid" : ""}`}>
          <input
            ref={inputRef}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-label={label}
            className="combobox-input"
            onBlur={() => {
              window.setTimeout(() => setIsOpen(false), 120);
              onFieldBlur?.();
            }}
            onChange={(event) => {
              onValueChange(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Start typing a team"
            role="combobox"
            value={value}
          />
          {selectedTeam ? <span className="selected-pill">Selected</span> : null}
        </div>
      </label>

      {isOpen ? (
        <div className="suggestions" role="listbox">
          {suggestions.length ? (
            suggestions.map((team, index) => (
              <button
                className={`suggestion ${index === activeIndex ? "suggestion-active" : ""}`}
                key={team}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commitSelection(team);
                }}
                type="button"
              >
                {team}
              </button>
            ))
          ) : (
            <div className="suggestion-empty">No matching teams found.</div>
          )}
        </div>
      ) : null}

      {validationMessage ? <div className="field-error">{validationMessage}</div> : null}
      {suggestionAction ? (
        <button className="suggestion-action" onClick={suggestionAction.onClick} type="button">
          {suggestionAction.label}
        </button>
      ) : null}
    </div>
  );
}
