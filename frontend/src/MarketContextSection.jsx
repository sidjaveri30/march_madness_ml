function formatPercent(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";
}

function formatPercentPoints(value) {
  return typeof value === "number" ? `${value >= 0 ? "+" : ""}${value.toFixed(1)} pts` : "—";
}

function formatAmerican(price) {
  if (price === null || price === undefined) return "—";
  const number = Number(price);
  return number > 0 ? `+${number}` : `${number}`;
}

function formatLine(value) {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  return number > 0 ? `+${number}` : `${number}`;
}

function formatNumber(value) {
  return typeof value === "number" ? value.toFixed(1) : "—";
}

function formatTimestamp(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export default function MarketContextSection({ loading = false, error = "", odds = null }) {
  if (loading) {
    return <div className="market-context-empty">Loading market context...</div>;
  }
  if (error) {
    return <div className="market-context-empty error">{error}</div>;
  }
  if (!odds) {
    return null;
  }
  if (!odds.event_found) {
    return <div className="market-context-empty">{odds.message || "No market lines currently available for this matchup."}</div>;
  }

  return (
    <div className="market-context-grid">
      <section className="modal-panel">
        <div className="eyebrow">Market Odds</div>
        {odds.last_updated ? <div className="market-updated">Last updated {formatTimestamp(odds.last_updated)}</div> : null}
        <div className="market-book-list">
          {odds.bookmakers.map((book) => (
            <div className="market-book-row" key={book.key}>
              <div className="market-book-head">
                <strong>{book.title}</strong>
                {book.last_update ? <span>{new Date(book.last_update).toLocaleString()}</span> : null}
              </div>
              {book.moneyline ? (
                <div className="market-line-grid">
                  <span>Moneyline</span>
                  <span>{odds.team_a} {formatAmerican(book.moneyline.team_a_price)}</span>
                  <span>{odds.team_b} {formatAmerican(book.moneyline.team_b_price)}</span>
                </div>
              ) : null}
              {book.spread ? (
                <div className="market-line-grid">
                  <span>Spread</span>
                  <span>{odds.team_a} {formatLine(book.spread.team_a_line)} ({formatAmerican(book.spread.team_a_price)})</span>
                  <span>{odds.team_b} {formatLine(book.spread.team_b_line)} ({formatAmerican(book.spread.team_b_price)})</span>
                </div>
              ) : null}
              {book.total ? (
                <div className="market-line-grid">
                  <span>Total</span>
                  <span>O {formatNumber(book.total.points)} ({formatAmerican(book.total.over_price)})</span>
                  <span>U {formatNumber(book.total.points)} ({formatAmerican(book.total.under_price)})</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="modal-panel">
        <div className="eyebrow">Model vs Market</div>
        {odds.model_vs_market ? (
          <div className="market-summary">
            <div className="market-summary-row market-summary-row-stat">
              <span>{odds.team_a} model win probability</span>
              <strong>{formatPercent(odds.model_vs_market.model_win_prob_team_a)}</strong>
            </div>
            <div className="market-summary-row market-summary-row-stat">
              <span>{odds.team_a} market implied probability</span>
              <strong>{formatPercent(odds.model_vs_market.market_implied_prob_team_a)}</strong>
            </div>
            <div className="market-summary-row market-summary-row-stat">
              <span>Probability edge</span>
              <strong>{formatPercentPoints(odds.model_vs_market.moneyline_edge_points)}</strong>
            </div>
            <div className="market-summary-row market-summary-row-stat">
              <span>Model projected margin</span>
              <strong>{formatNumber(odds.model_vs_market.model_margin_team_a)}</strong>
            </div>
            <div className="market-summary-row market-summary-row-stat">
              <span>Consensus spread</span>
              <strong>{formatLine(odds.model_vs_market.market_spread_team_a)}</strong>
            </div>
            <div className="market-summary-row market-summary-row-stat">
              <span>Spread difference</span>
              <strong>{formatNumber(odds.model_vs_market.spread_edge_points)}</strong>
            </div>
            <div className="market-badge">{odds.model_vs_market.edge_label}</div>
            {odds.model_vs_market.spread_summary ? <p className="subtle market-interpretation">{odds.model_vs_market.spread_summary}</p> : null}
            {odds.model_vs_market.spread_difference_summary ? <p className="subtle market-interpretation">{odds.model_vs_market.spread_difference_summary}</p> : null}
            <p className="subtle market-interpretation">{odds.model_vs_market.interpretation}</p>
          </div>
        ) : (
          <p className="subtle">Market comparison becomes available once both model output and sportsbook lines are present.</p>
        )}
      </section>

      <section className="modal-panel modal-panel-wide">
        <div className="eyebrow">Consensus Line</div>
        <div className="market-consensus-grid">
          <div className="market-consensus-card">
            <span>{odds.team_a} implied probability</span>
            <strong>{formatPercent(odds.consensus.team_a_implied_prob_avg)}</strong>
          </div>
          <div className="market-consensus-card">
            <span>{odds.team_b} implied probability</span>
            <strong>{formatPercent(odds.consensus.team_b_implied_prob_avg)}</strong>
          </div>
          <div className="market-consensus-card">
            <span>{odds.team_a} average moneyline</span>
            <strong>{formatAmerican(odds.consensus.team_a_moneyline_avg)}</strong>
          </div>
          <div className="market-consensus-card">
            <span>{odds.team_b} average moneyline</span>
            <strong>{formatAmerican(odds.consensus.team_b_moneyline_avg)}</strong>
          </div>
          <div className="market-consensus-card">
            <span>{odds.team_a} spread</span>
            <strong>{formatLine(odds.consensus.spread_avg)}</strong>
          </div>
          <div className="market-consensus-card">
            <span>Total</span>
            <strong>{formatNumber(odds.consensus.total_avg)}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
