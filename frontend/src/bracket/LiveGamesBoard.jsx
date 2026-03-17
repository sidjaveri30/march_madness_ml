import { useMemo, useState } from "react";

import TeamLogo from "../TeamLogo";
import { getDisplayGameInfo } from "./gameDisplay";

const DEFAULT_VISIBLE_COUNT = 2;

function ScheduleGame({ game }) {
  const displayGame = getDisplayGameInfo(game);
  const roundInfo = displayGame.roundLabel || displayGame.region || "";

  return (
    <article className={`ticker-card ticker-card-${displayGame.status}`}>
      <div className="ticker-status">
        <span className="matchup-status-pill matchup-status-pill-inline">{displayGame.displayStatusLabel}</span>
        {displayGame.displayStatusDetail ? <span className="schedule-game-detail">{displayGame.displayStatusDetail}</span> : null}
      </div>
      {roundInfo ? <div className="schedule-game-round">{roundInfo}</div> : null}
      <div className="ticker-team-row">
        <TeamLogo size="sm" team={displayGame.teamA} />
        <span className="ticker-team-name">{displayGame.teamA}</span>
        <strong>{displayGame.team_a_score ?? "-"}</strong>
      </div>
      <div className="ticker-team-row">
        <TeamLogo size="sm" team={displayGame.teamB} />
        <span className="ticker-team-name">{displayGame.teamB}</span>
        <strong>{displayGame.team_b_score ?? "-"}</strong>
      </div>
    </article>
  );
}

function ScheduleSection({ emptyMessage, games, title }) {
  const [expanded, setExpanded] = useState(false);
  const visibleGames = expanded ? games : games.slice(0, DEFAULT_VISIBLE_COUNT);
  const hiddenCount = Math.max(0, games.length - DEFAULT_VISIBLE_COUNT);

  return (
    <section className="ticker-section">
      <div className="schedule-section-header">
        <div className="ticker-section-title">{title}</div>
        <span className="ticker-count">{games.length}</span>
      </div>
      <div className={`ticker-items ${expanded ? "schedule-section-list-expanded" : ""}`}>
        {visibleGames.length ? visibleGames.map((game) => <ScheduleGame game={game} key={game.matchupId} />) : <div className="ticker-empty">{emptyMessage}</div>}
      </div>
      {hiddenCount > 0 ? (
        <button className="schedule-section-toggle" onClick={() => setExpanded((current) => !current)} type="button">
          {expanded ? "Show Less" : `See More (${hiddenCount})`}
        </button>
      ) : null}
    </section>
  );
}

export default function LiveGamesBoard({ sections }) {
  const orderedSections = useMemo(
    () => [
      { key: "live", title: "Live Now", emptyMessage: "No live games right now.", games: sections.live || [] },
      { key: "final", title: "Final", emptyMessage: "No finals posted yet.", games: sections.final || [] },
      { key: "upcoming", title: "Upcoming", emptyMessage: "No upcoming games scheduled.", games: sections.upcoming || [] },
    ],
    [sections],
  );

  return (
    <section className="live-ticker" data-testid="live-games-board">
      {orderedSections.map((section) => (
        <ScheduleSection emptyMessage={section.emptyMessage} games={section.games} key={section.key} title={section.title} />
      ))}
    </section>
  );
}
