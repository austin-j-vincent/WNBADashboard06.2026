import { useState, useEffect } from 'react';

// The initial theme is set by an inline script in index.html (before paint),
// so read it back from the <html> data-theme attribute to stay in sync.
function getInitialTheme() {
  if (typeof document !== 'undefined') {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'dark' || current === 'light') return current;
  }
  return 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // localStorage unavailable (e.g. private mode) — theme still applies
    }
  }, [theme]);

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
