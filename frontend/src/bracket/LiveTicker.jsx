import TeamLogo from "../TeamLogo";

function TickerSection({ games, title }) {
  return (
    <section className="ticker-section">
      <div className="ticker-section-title">{title}</div>
      <div className="ticker-items">
        {games.length ? (
          games.map((game) => (
            <article className={`ticker-card ticker-card-${game.status}`} key={game.matchupId}>
              <div className="ticker-status">{game.statusLabel}</div>
              <div className="ticker-team-row">
                <TeamLogo size="sm" team={game.teamA} />
                <span>{game.teamA}</span>
                <strong>{game.teamAScore ?? "-"}</strong>
              </div>
              <div className="ticker-team-row">
                <TeamLogo size="sm" team={game.teamB} />
                <span>{game.teamB}</span>
                <strong>{game.teamBScore ?? "-"}</strong>
              </div>
            </article>
          ))
        ) : (
          <div className="ticker-empty">No {title.toLowerCase()} games right now.</div>
        )}
      </div>
    </section>
  );
}

export default function LiveTicker({ sections }) {
  return (
    <section className="live-ticker">
      <TickerSection games={sections.live} title="Live Now" />
      <TickerSection games={sections.final} title="Final" />
      <TickerSection games={sections.upcoming} title="Upcoming" />
    </section>
  );
}
