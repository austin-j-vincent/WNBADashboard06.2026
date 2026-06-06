// WNBA API service — strict data validation & integrity checks
//
// Data source: RapidAPI "wnba-api" (wnba-api.p.rapidapi.com), which mirrors
// ESPN's public scoreboard JSON. The scoreboard response shape is:
//   { events: [ { date, competitions: [ { date, competitors: [...],
//                 broadcasts: [...], geoBroadcasts: [...] } ] } ] }
// Each competitor has: homeAway, team.abbreviation, team.displayName,
// and records[].summary (e.g. "12-4").
const API_HOST = import.meta.env.VITE_RAPIDAPI_HOST || 'wnba-api.p.rapidapi.com';
const API_KEY = import.meta.env.VITE_RAPIDAPI_KEY;

// Candidate scoreboard endpoints. The exact path varies by API version, so we
// try each in order and use the first that returns a valid scoreboard payload.
// {Y}/{M}/{D} are replaced with zero-padded date parts.
const ENDPOINT_CANDIDATES = [
  '/wnbascoreboard?year={Y}&month={M}&day={D}',
  '/wnbaschedule?year={Y}&month={M}&day={D}',
  '/scoreboard?year={Y}&month={M}&day={D}',
  '/schedule?year={Y}&month={M}&day={D}',
];

const TEAM_EMOJIS = {
  // Official WNBA team emojis and acronyms per 2026 naming conventions
  ATL: '💭',   // Atlanta Dream
  CHI: '🌃',   // Chicago Sky
  CON: '🌞',   // Connecticut Sun
  IND: '🌡️',   // Indiana Fever
  NYL: '🗽',   // New York Liberty
  TOR: '🎵',   // Toronto Tempo
  DAL: '🪽',   // Dallas Wings
  LAS: '✨',   // Los Angeles Sparks
  GSV: '⚔️',   // Golden State Valkyries
  MIN: '😼',   // Minnesota Lynx
  SEA: '⛈️',   // Seattle Storm
  PHX: '🪐',   // Phoenix Mercury
  PDX: '🔥',   // Portland Fire
  LVA: '♦️',   // Las Vegas Aces
  WAS: '🔮',   // Washington Mystics
  // Fallbacks for alternate acronym forms that might come from API
  CONN: '🌞',  // Connecticut (alternate)
  LA: '✨',    // Los Angeles (alternate)
  LV: '♦️',    // Las Vegas (alternate)
  NY: '🗽',    // New York (alternate)
  POR: '🔥',   // Portland (alternate)
  WSH: '🔮',   // Washington (alternate)
};

const TEAM_COLORS = {
  PHX: { primary: '#9B2C42', secondary: '#E8855B' },
  // Others fall back to the Mercury-neutral default below.
};

const DEFAULT_COLORS = { primary: '#6b6375', secondary: '#c4ced3' };

export async function fetchTodaysGames() {
  if (!API_KEY) {
    throw new Error('RapidAPI key not configured. Add VITE_RAPIDAPI_KEY.');
  }

  // Compute "today" in US Eastern time, since WNBA scheduling is ET-based.
  const { Y, M, D } = easternDateParts();

  const headers = {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': API_HOST,
  };

  let lastError = null;
  for (const template of ENDPOINT_CANDIDATES) {
    const path = template
      .replace('{Y}', Y)
      .replace('{M}', M)
      .replace('{D}', D);
    const url = `https://${API_HOST}${path}`;

    try {
      const response = await fetch(url, { method: 'GET', headers });

      if (response.status === 404) {
        // Wrong path for this API version — try the next candidate.
        lastError = new Error(`404 at ${path}`);
        continue;
      }
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const events = extractEvents(data);
      if (events === null) {
        // Reached an endpoint but it isn't a scoreboard — try next candidate.
        lastError = new Error(`Unexpected response shape at ${path}`);
        continue;
      }

      const games = events
        .map(normalizeGame)
        .filter(Boolean)
        .sort((a, b) => new Date(a.tipOffTime) - new Date(b.tipOffTime));

      return {
        games,
        fetchedAt: new Date().toISOString(),
        source: 'wnba-api (ESPN)',
      };
    } catch (err) {
      lastError = err;
      // Network/parse error — stop trying alternates only for non-404 HTTP errors
      if (err.message.startsWith('API error:')) {
        throw err;
      }
    }
  }

  throw new Error(
    `Could not load games. ${lastError ? lastError.message : 'No endpoint responded.'}`
  );
}

// Returns the events array from a scoreboard payload, or null if the response
// doesn't look like a scoreboard.
function extractEvents(data) {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data.events)) return data.events;
  // Some variants nest the payload one level deeper.
  if (data.scoreboard && Array.isArray(data.scoreboard.events)) {
    return data.scoreboard.events;
  }
  return null;
}

function normalizeGame(event) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors;
  if (!Array.isArray(competitors) || competitors.length < 2) return null;

  const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
  if (!home?.team?.abbreviation || !away?.team?.abbreviation) return null;

  const tipOffTime = competition.date || event.date;
  if (!tipOffTime) return null;

  return {
    id: event.id || `${tipOffTime}-${away.team.abbreviation}-${home.team.abbreviation}`,
    homeTeam: buildTeam(home),
    awayTeam: buildTeam(away),
    tipOffTime,
    broadcastChannel: extractBroadcast(competition),
    status: competition.status?.type?.shortDetail || event.status?.type?.shortDetail || 'Scheduled',
  };
}

function buildTeam(competitor) {
  const abbr = competitor.team.abbreviation;
  return {
    abbreviation: abbr,
    name: competitor.team.displayName || competitor.team.name || abbr,
    emoji: TEAM_EMOJIS[abbr] || '🏀',
    record: extractRecord(competitor),
    colors: TEAM_COLORS[abbr] || DEFAULT_COLORS,
  };
}

// Season record — prefer the overall ("total") record, e.g. "12-4".
function extractRecord(competitor) {
  const records = competitor.records;
  if (!Array.isArray(records) || records.length === 0) return null;
  const total =
    records.find(r => r.type === 'total' || r.name === 'overall') || records[0];
  return total?.summary || null;
}

// TV network — national broadcast preferred, then geo broadcast.
function extractBroadcast(competition) {
  const broadcasts = competition.broadcasts;
  if (Array.isArray(broadcasts) && broadcasts.length > 0) {
    const names = broadcasts[0].names || broadcasts[0].media?.shortName;
    if (Array.isArray(names) && names.length > 0) return names.join('/');
    if (typeof names === 'string') return names;
  }
  const geo = competition.geoBroadcasts;
  if (Array.isArray(geo) && geo.length > 0) {
    const name = geo[0].media?.shortName || geo[0].media?.callLetters;
    if (name) return name;
  }
  return 'TBD';
}

// Date parts (zero-padded) for "today" in US Eastern time.
function easternDateParts() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map(p => [p.type, p.value])
  );
  return { Y: parts.year, M: parts.month, D: parts.day };
}

export function formatTimeEDT(isoString) {
  const date = new Date(isoString);
  if (isNaN(date)) return 'TBD';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    hour12: true,
  });
}

export function formatLastUpdated(isoString) {
  const date = new Date(isoString);
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
