import { useState, useEffect, useCallback } from 'react';
import { fetchStandings, formatLastUpdated } from '../services/wnbaApi';
import { useRefresh } from '../contexts/RefreshContext';
import './Standings.css';

export default function Standings() {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { registerModule } = useRefresh();

  const loadStandings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStandings();
      setStandings(data.standings);
      setLastUpdated(data.fetchedAt);
    } catch (err) {
      setError(err.message);
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStandings();
  }, [loadStandings]);

  // Join the global refresh cycle so the Refresh button reloads standings too.
  useEffect(() => {
    const unregister = registerModule(loadStandings);
    return unregister;
  }, [registerModule, loadStandings]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="standings todays-games">
      <div className="module-header" onClick={toggleCollapse}>
        <h2>📊 Standings</h2>
        <button
          className="collapse-btn"
          aria-label="Toggle standings"
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {error && (
            <div className="error-state">
              <p>⚠️ {error}</p>
              <button onClick={loadStandings} className="retry-btn">
                Try Again
              </button>
            </div>
          )}

          {loading && <div className="loading-state">Loading standings...</div>}

          {!loading && standings.length === 0 && !error && (
            <div className="no-standings-state">
              <p>No standings available</p>
            </div>
          )}

          {!loading && standings.length > 0 && (
            <div className="standings-table" role="table" aria-label="WNBA standings">
              <div className="standings-head" role="row">
                <span className="rank" role="columnheader">#</span>
                <span className="team-col" role="columnheader">Team</span>
                <span className="stat" role="columnheader">W</span>
                <span className="stat" role="columnheader">L</span>
                <span className="stat" role="columnheader">PCT</span>
                <span className="stat" role="columnheader">GB</span>
                <span className="stat" role="columnheader">STRK</span>
              </div>

              {standings.map((row, i) => (
                <div key={row.team.abbreviation} role="presentation">
                  <div className="standings-row" role="row">
                    <span className="rank" role="cell">{row.rank}</span>
                    <span className="team-col" role="cell">
                      <span className="emoji">{row.team.emoji}</span>
                      <span className="abbreviation">{row.team.abbreviation}</span>
                    </span>
                    <span className="stat" role="cell">{row.wins ?? '—'}</span>
                    <span className="stat" role="cell">{row.losses ?? '—'}</span>
                    <span className="stat" role="cell">{row.pct ?? '—'}</span>
                    <span className="stat" role="cell">{row.gamesBehind ?? '—'}</span>
                    <span className={`stat streak ${streakClass(row.streak)}`} role="cell">
                      {row.streak ?? '—'}
                    </span>
                  </div>

                  {/* Playoff cutoff line after the 8th row (top 8 make the
                      playoffs). Gated on position so it can't double-render on
                      tied seeds or vanish when no team has seed exactly 8. */}
                  {i === 7 && i < standings.length - 1 && (
                    <div className="playoff-divider" aria-hidden="true">
                      <span>Playoffs</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {lastUpdated && (
            <div className="module-footer">
              <small>Updated {formatLastUpdated(lastUpdated)}</small>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Subtle green/red tint derived purely from the API streak's leading W/L.
function streakClass(streak) {
  if (typeof streak !== 'string') return '';
  if (streak.startsWith('W')) return 'win';
  if (streak.startsWith('L')) return 'loss';
  return '';
}
