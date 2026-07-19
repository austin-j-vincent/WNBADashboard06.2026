import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchStatLeaders, formatLastUpdated } from '../services/wnbaApi';
import { useRefresh } from '../contexts/RefreshContext';
import './StatsLeaders.css';

// Place medals for 1st / 2nd / 3rd (index 0..2).
const MEDALS = ['🥇', '🥈', '🥉'];
// Minimum horizontal swipe (px) to advance the carousel.
const SWIPE_THRESHOLD = 40;

export default function StatsLeaders() {
  const [leaders, setLeaders] = useState([]);
  const [statLabel, setStatLabel] = useState('PPG');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [source, setSource] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const { registerModule } = useRefresh();

  const loadLeaders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Release 1 shows the PPG leaders. Future tabs will pass other stat keys.
      const data = await fetchStatLeaders('points');
      setLeaders(data.leaders);
      setStatLabel(data.statLabel);
      setLastUpdated(data.fetchedAt);
      setSource(data.source);
      setActiveIndex(0); // always (re)start on the #1 leader
    } catch (err) {
      setError(err.message);
      setLeaders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaders();
  }, [loadLeaders]);

  // Join the global refresh cycle so the Refresh button reloads leaders too.
  useEffect(() => {
    const unregister = registerModule(loadLeaders);
    return unregister;
  }, [registerModule, loadLeaders]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const goTo = (i) => setActiveIndex(Math.max(0, Math.min(leaders.length - 1, i)));
  const prev = () => goTo(activeIndex - 1);
  const next = () => goTo(activeIndex + 1);

  // Touch swipe: compare start/end X and advance one card past the threshold.
  const touchStartX = useRef(null);
  const onTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta <= -SWIPE_THRESHOLD) next();
    else if (delta >= SWIPE_THRESHOLD) prev();
    touchStartX.current = null;
  };

  const active = leaders[activeIndex];

  return (
    <div className="stats-leaders todays-games">
      <div className="module-header" onClick={toggleCollapse}>
        <h2>🏅 Stats Leaders</h2>
        <button
          className="collapse-btn"
          aria-label="Toggle stats leaders"
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Reserved tab bar. Only PPG is active this release; RPG/APG/SPG/BPG
              tabs get added here next — fetchStatLeaders/LEADER_STATS already
              support them, so this bar is where those siblings will live. */}
          <div className="leaders-tabs" role="group" aria-label="Stat categories">
            <span className="leaders-tab active">PPG</span>
          </div>

          {error && (
            <div className="error-state">
              <p>⚠️ {error}</p>
              <button onClick={loadLeaders} className="retry-btn">
                Try Again
              </button>
            </div>
          )}

          {loading && <div className="loading-state">Loading stat leaders...</div>}

          {!loading && leaders.length === 0 && !error && (
            <div className="no-leaders-state">
              <p>No stat leaders available</p>
            </div>
          )}

          {!loading && active && (
            <div
              className="leaders-carousel"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <button
                className="carousel-arrow prev"
                onClick={prev}
                disabled={activeIndex === 0}
                aria-label="Previous leader"
              >
                ‹
              </button>

              {/* Keyed by player so switching leaders remounts the card (and its
                  headshot), resetting any per-player image-load state. */}
              <LeaderCard key={active.player.athleteId} leader={active} statLabel={statLabel} />

              <button
                className="carousel-arrow next"
                onClick={next}
                disabled={activeIndex === leaders.length - 1}
                aria-label="Next leader"
              >
                ›
              </button>

              <div className="carousel-dots" role="group" aria-label="Choose leader">
                {leaders.map((row, i) => (
                  <button
                    key={row.player.athleteId}
                    className={`carousel-dot${i === activeIndex ? ' active' : ''}`}
                    onClick={() => goTo(i)}
                    aria-label={`Show #${i + 1}`}
                    aria-pressed={i === activeIndex}
                  />
                ))}
              </div>
            </div>
          )}

          {lastUpdated && (
            <div className="module-footer">
              {source && <small>Source: {source}</small>}
              <small className="footer-updated">
                Updated {formatLastUpdated(lastUpdated)}
              </small>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LeaderCard({ leader, statLabel }) {
  const { rank, player, statDisplay, team } = leader;
  return (
    <div className="leader-card" style={{ '--team': team.colors.primary }}>
      <PlayerHeadshot url={player.headshotUrl} name={player.name} fallbackEmoji={team.emoji} />

      <div className="leader-line name-line">
        <span className="medal" aria-hidden="true">
          {MEDALS[rank - 1] || `#${rank}`}
        </span>
        <span className="player-name">{player.name}</span>
        {player.position && <span className="player-pos">({player.position})</span>}
      </div>

      <div className="leader-line stat-line">
        {statDisplay ?? '—'} {statLabel}
      </div>

      <div className="leader-line team-line">
        <span className="team-emoji" aria-hidden="true">{team.emoji}</span>
        {[team.location, team.name].filter(Boolean).join(' ')}
      </div>
    </div>
  );
}

// Visual anchor: the player's headshot. When the image is missing or fails to
// load, the player's team emoji stands in as the anchor (e.g. ♦️ for a Las Vegas
// Aces player). The parent LeaderCard is keyed by player, so `failed` can't carry
// over between leaders.
function PlayerHeadshot({ url, name, fallbackEmoji }) {
  const [failed, setFailed] = useState(false);
  const showImage = url && !failed;

  return (
    <div className="headshot">
      {showImage ? (
        <img
          src={url}
          alt={name}
          className="headshot-img"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="headshot-emoji"
          role="img"
          aria-label={`${name} — photo unavailable`}
        >
          {fallbackEmoji}
        </span>
      )}
    </div>
  );
}
