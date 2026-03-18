import { memo } from "react";

import TeamLogo from "../TeamLogo";
import { getTeamId, getTeamName, isPlaceholderTeam } from "./bracketTeams";

function TeamSlot({ team, seed, isSelected, isDisabled, onClick, interactive = true, score = null, outcome = "pending" }) {
  const teamName = getTeamName(team);
  const isPlaceholder = isPlaceholderTeam(team);
  return (
    <button
      className={`team-slot ${isSelected ? "team-slot-selected" : ""} ${isPlaceholder ? "team-slot-placeholder" : ""} ${interactive ? "" : "team-slot-static"} ${score !== null && score !== undefined ? "team-slot-with-score" : ""} ${outcome !== "pending" ? `team-slot-${outcome}` : ""}`}
      disabled={!team || (interactive && isDisabled)}
      onClick={interactive ? onClick : undefined}
      type="button"
    >
      <span className="team-seed">{seed || ""}</span>
      <TeamLogo className="team-slot-logo" size="sm" team={teamName} />
      <span className="team-name">{teamName || "TBD"}</span>
      {score !== null && score !== undefined ? <span className="team-score">{score}</span> : null}
    </button>
  );
}

function areEqualTeamSlots(previousProps, nextProps) {
  return (
    getTeamId(previousProps.team) === getTeamId(nextProps.team) &&
    previousProps.seed === nextProps.seed &&
    previousProps.isSelected === nextProps.isSelected &&
    previousProps.isDisabled === nextProps.isDisabled &&
    previousProps.interactive === nextProps.interactive &&
    previousProps.score === nextProps.score &&
    previousProps.outcome === nextProps.outcome
  );
}

export default memo(TeamSlot, areEqualTeamSlots);
