import { useState, useEffect } from 'react';
import { fetchTodaysGames, formatLastUpdated } from '../services/wnbaApi';
import GameCell from './GameCell';
import './TodaysGames.css';

export default function TodaysGames() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const loadGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTodaysGames();
      setGames(data.games);
      setLastUpdated(data.fetchedAt);
    } catch (err) {
      setError(err.message);
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="todays-games">
      <div className="module-header" onClick={toggleCollapse}>
        <h2>📅 Today's Games</h2>
        <button className="collapse-btn" aria-label="Toggle games list">
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {error && (
            <div className="error-state">
              <p>⚠️ {error}</p>
              <button onClick={loadGames} className="retry-btn">
                Try Again
              </button>
            </div>
          )}

          {loading && <div className="loading-state">Loading games...</div>}

          {!loading && games.length === 0 && !error && (
            <div className="no-games-state">
              <p>No games today</p>
            </div>
          )}

          {!loading && games.length > 0 && (
            <div className="games-list">
              {games.map(game => (
                <GameCell key={game.id} game={game} />
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
