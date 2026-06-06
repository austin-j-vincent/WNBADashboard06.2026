import { formatTimeEDT } from '../services/wnbaApi';
import './GameCell.css';

export default function GameCell({ game }) {
  const { homeTeam, awayTeam, tipOffTime, broadcastChannel } = game;

  return (
    <div className="game-cell">
      <div className="game-time-channel">
        <span className="time">{formatTimeEDT(tipOffTime)} EDT</span>
        <span className="channel">{broadcastChannel}</span>
      </div>

      <div className="game-matchup">
        <div className="team away-team">
          <span className="emoji">{awayTeam.emoji}</span>
          <div className="team-info">
            <span className="abbreviation">{awayTeam.abbreviation}</span>
            {awayTeam.record && <span className="record">{awayTeam.record}</span>}
          </div>
        </div>

        <div className="vs">vs</div>

        <div className="team home-team">
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
