import TeamLogo from "../TeamLogo";
import { getTeamName, isPlaceholderTeam } from "./bracketTeams";

export default function TeamSlot({ team, seed, isSelected, isDisabled, onClick }) {
  const teamName = getTeamName(team);
  const isPlaceholder = isPlaceholderTeam(team);
  return (
    <button
      className={`team-slot ${isSelected ? "team-slot-selected" : ""} ${isPlaceholder ? "team-slot-placeholder" : ""}`}
      disabled={isDisabled || !team}
      onClick={onClick}
      type="button"
    >
      <span className="team-seed">{seed || ""}</span>
      <TeamLogo className="team-slot-logo" size="sm" team={teamName} />
      <span className="team-name">{teamName || "TBD"}</span>
    </button>
  );
}
