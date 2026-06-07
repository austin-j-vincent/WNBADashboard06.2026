import { formatTimeEDT } from '../services/wnbaApi';
import './GameCell.css';

export default function GameCell({ game }) {
  const { homeTeam, awayTeam, tipOffTime, broadcastChannel } = game;

  // Team colors drive the accent bar and per-column tint (set as CSS vars).
  const cellStyle = {
    '--away': awayTeam.colors.primary,
    '--home': homeTeam.colors.primary,
  };

  return (
    <div className="game-cell" style={cellStyle}>
      <div className="team-accent-bar" />

      <div className="game-time-channel">
        <span className="time">{formatTimeEDT(tipOffTime)} EDT</span>
        <span className="channel">{broadcastChannel}</span>
      </div>

      <div className="game-matchup">
        <div className="team away-team" style={{ '--team': awayTeam.colors.primary }}>
          <span className="emoji">{awayTeam.emoji}</span>
          <div className="team-info">
            <span className="abbreviation">{awayTeam.abbreviation}</span>
            {awayTeam.record && <span className="record">{awayTeam.record}</span>}
          </div>
        </div>

        <div className="vs">@</div>

        <div className="team home-team" style={{ '--team': homeTeam.colors.primary }}>
          <span className="emoji">{homeTeam.emoji}</span>
          <div className="team-info">
            <span className="abbreviation">{homeTeam.abbreviation}</span>
            {homeTeam.record && <span className="record">{homeTeam.record}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
