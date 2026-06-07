import { useState, useEffect } from 'react';
import './ThemeToggle.css';

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

  return (
    <button
      className="theme-toggle-slider"
      onClick={toggle}
      data-theme={theme}
      role="switch"
      aria-checked={theme === 'dark'}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {/* The knob slides left (day) ↔ right (night) and shows the active
          mode's emoji — sun in day mode, moon in night mode. */}
      <span className="slider-knob">{theme === 'dark' ? '🌙' : '☀️'}</span>
    </button>
  );
}
