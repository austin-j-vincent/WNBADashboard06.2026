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
        <button className="collapse-btn" aria-label="Toggle standings">
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
            <div className="standings-table">
              <div className="standings-head">
                <span className="rank">#</span>
                <span className="team-col">Team</span>
                <span className="stat">W</span>
                <span className="stat">L</span>
                <span className="stat">PCT</span>
                <span className="stat">GB</span>
                <span className="stat">STRK</span>
              </div>

              {standings.map((row, i) => (
                <div key={row.team.abbreviation + row.rank}>
                  <div
                    className={`standings-row${row.isPlayoff ? ' playoff' : ''}`}
                    style={{ '--team': row.team.colors.primary }}
                  >
                    <span className="rank">{row.rank}</span>
                    <span className="team-col">
                      <span className="emoji">{row.team.emoji}</span>
                      <span className="abbreviation">{row.team.abbreviation}</span>
                    </span>
                    <span className="stat">{row.wins ?? '—'}</span>
                    <span className="stat">{row.losses ?? '—'}</span>
                    <span className="stat">{row.pct ?? '—'}</span>
                    <span className="stat">{row.gamesBehind ?? '—'}</span>
                    <span className={`stat streak ${streakClass(row.streak)}`}>
                      {row.streak ?? '—'}
                    </span>
                  </div>

                  {/* Playoff cutoff line between the 8th and 9th teams */}
                  {row.rank === 8 && i < standings.length - 1 && (
                    <div className="playoff-divider">
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
