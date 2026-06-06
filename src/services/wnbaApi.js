// WNBA API service — strict data validation & integrity checks
const API_HOST = import.meta.env.VITE_RAPIDAPI_HOST;
const API_KEY = import.meta.env.VITE_RAPIDAPI_KEY;

const TEAM_EMOJIS = {
  ATL: '🐦',
  CHI: '🌟',
  CON: '💚',
  DAL: '✨',
  IND: '⚡',
  LA: '👑',
  LV: '🏜️',
  MIN: '🐺',
  NY: '🗽',
  PHX: '🔥',
  SEA: '🌧️',
  WSH: '🎭',
};

const TEAM_COLORS = {
  ATL: { primary: '#E03C28', secondary: '#C4CED3' },
  CHI: { primary: '#CE1141', secondary: '#000000' },
  CON: { primary: '#144620', secondary: '#08244F' },
  DAL: { primary: '#00659C', secondary: '#B8860B' },
  IND: { primary: '#002D62', secondary: '#FFCD00' },
  LA: { primary: '#2D2F8E', secondary: '#FDB927' },
  LV: { primary: '#702F8A', secondary: '#E25C3D' },
  MIN: { primary: '#094C3B', secondary: '#FDB927' },
  NY: { primary: '#0C2E4D', secondary: '#E0861D' },
  PHX: { primary: '#9B2C42', secondary: '#E8855B' },
  SEA: { primary: '#00471B', secondary: '#A4A9AC' },
  WSH: { primary: '#C41E3A', secondary: '#002B5C' },
};

export async function fetchTodaysGames() {
  if (!API_KEY) {
    throw new Error('RapidAPI key not configured. Add VITE_RAPIDAPI_KEY to .env');
  }

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const response = await fetch(
      `https://${API_HOST}/games?date=${today}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': API_KEY,
          'x-rapidapi-host': API_HOST,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const games = validateAndNormalizeGames(data);

    return {
      games,
      fetchedAt: new Date().toISOString(),
      source: 'WNBA API (ESPN)',
    };
  } catch (error) {
    throw new Error(`Failed to fetch today's games: ${error.message}`);
  }
}

function validateAndNormalizeGames(data) {
  // Validate response structure
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid API response: expected object');
  }

  const rawGames = Array.isArray(data) ? data : data.games || [];

  if (!Array.isArray(rawGames)) {
    throw new Error('Invalid API response: games not an array');
  }

  return rawGames
    .filter(game => isValidGame(game))
    .map(game => normalizeGame(game))
    .sort((a, b) => new Date(a.tipOffTime) - new Date(b.tipOffTime));
}

function isValidGame(game) {
  // Strict validation: only include games with required fields
  return (
    game &&
    typeof game === 'object' &&
    game.homeTeam?.abbreviation &&
    game.awayTeam?.abbreviation &&
    game.startTimeUTC &&
    (game.broadcasts?.length > 0 || game.broadcastChannel)
  );
}

function normalizeGame(game) {
  const homeTeam = game.homeTeam;
  const awayTeam = game.awayTeam;
  const broadcast = Array.isArray(game.broadcasts) ? game.broadcasts[0] : { name: game.broadcastChannel };

  // Parse tip-off time to EDT
  const tipOffUTC = new Date(game.startTimeUTC);
  const tipOffEDT = new Date(tipOffUTC.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  return {
    id: game.gameId || `${game.startTimeUTC}-${homeTeam.abbreviation}-${awayTeam.abbreviation}`,
    homeTeam: {
      abbreviation: homeTeam.abbreviation,
      name: homeTeam.name,
      emoji: TEAM_EMOJIS[homeTeam.abbreviation] || '🏀',
      record: homeTeam.record || null,
      colors: TEAM_COLORS[homeTeam.abbreviation] || { primary: '#000', secondary: '#fff' },
    },
    awayTeam: {
      abbreviation: awayTeam.abbreviation,
      name: awayTeam.name,
      emoji: TEAM_EMOJIS[awayTeam.abbreviation] || '🏀',
      record: awayTeam.record || null,
      colors: TEAM_COLORS[awayTeam.abbreviation] || { primary: '#000', secondary: '#fff' },
    },
    tipOffTime: tipOffEDT.toISOString(),
    tipOffTimeLocal: tipOffEDT,
    broadcastChannel: broadcast.name || 'TBD',
    status: game.status || 'scheduled',
  };
}

export function getTeamEmoji(abbreviation) {
  return TEAM_EMOJIS[abbreviation] || '🏀';
}

export function getTeamColors(abbreviation) {
  return TEAM_COLORS[abbreviation] || { primary: '#000', secondary: '#fff' };
}

export function formatTimeEDT(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
    hour12: true,
  });
}

export function formatLastUpdated(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
