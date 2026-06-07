import { useRefresh } from '../contexts/RefreshContext';
import './RefreshOverlay.css';

// Full-screen frosted overlay shown while any module is refreshing. The
// spinning basketball signals that the entire page is being refreshed.
export default function RefreshOverlay() {
  const { isRefreshing } = useRefresh();

  if (!isRefreshing) return null;

  return (
    <div
      className="refresh-overlay"
      role="status"
      aria-live="polite"
      aria-label="Refreshing data"
    >
      <span className="refresh-overlay-icon">🏀</span>
    </div>
  );
}
