import { useRefresh } from '../contexts/RefreshContext';
import './RefreshButton.css';

export default function RefreshButton() {
  const { triggerRefresh, isRefreshing } = useRefresh();

  return (
    <button
      className="refresh-button"
      onClick={triggerRefresh}
      disabled={isRefreshing}
      aria-label="Refresh all data"
      title="Refresh all data"
    >
      <span className="refresh-icon">
        {isRefreshing ? '🏀' : '🔄'}
      </span>
      <span className="refresh-text">Refresh</span>
    </button>
  );
}
