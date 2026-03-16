import TeamLogo from "../TeamLogo";
import { getTeamName, isPlaceholderTeam } from "./bracketTeams";

export default function TeamSlot({ team, seed, isSelected, isDisabled, onClick, interactive = true, score = null }) {
  const teamName = getTeamName(team);
  const isPlaceholder = isPlaceholderTeam(team);
  return (
    <button
      className={`team-slot ${isSelected ? "team-slot-selected" : ""} ${isPlaceholder ? "team-slot-placeholder" : ""} ${interactive ? "" : "team-slot-static"} ${score !== null && score !== undefined ? "team-slot-with-score" : ""}`}
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
