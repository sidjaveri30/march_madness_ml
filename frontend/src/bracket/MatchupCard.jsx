import TeamSlot from "./TeamSlot";
import { isPickableTeam } from "./bracketTeams";

export default function MatchupCard({ matchup, teams, winner, onPick, onDetails, side }) {
  const [teamA, teamB] = teams;
  const canPickA = isPickableTeam(teamA);
  const canPickB = isPickableTeam(teamB);

  return (
    <article className={`matchup-card matchup-card-${side}`} data-testid={`matchup-${matchup.id}`}>
      <div className="matchup-card-header">
        <div className="matchup-meta">
          <div className="matchup-label">{matchup.label}</div>
          {matchup.sublabel ? <div className="matchup-sublabel">{matchup.sublabel}</div> : null}
        </div>
        <button
          aria-label={`View ${matchup.label} details`}
          className="matchup-info-button"
          data-testid={`details-${matchup.id}`}
          onClick={onDetails}
          type="button"
        >
          i
        </button>
      </div>

      <div className="matchup-teams">
        <TeamSlot
          isDisabled={!canPickA}
          isSelected={winner === teamA}
          onClick={() => canPickA && onPick(teamA)}
          seed={matchup.slots[0]?.seed}
          team={teamA}
        />
        <TeamSlot
          isDisabled={!canPickB}
          isSelected={winner === teamB}
          onClick={() => canPickB && onPick(teamB)}
          seed={matchup.slots[1]?.seed}
          team={teamB}
        />
      </div>
    </article>
  );
}
