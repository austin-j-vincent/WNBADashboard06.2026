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

// Candidate standings endpoints — primary is the confirmed path, second is a
// defensive fallback. {Y} is replaced with the current season year (YYYY).
const STANDINGS_ENDPOINT_CANDIDATES = [
  '/wnbastandings?year={Y}',
  '/standings?year={Y}',
];

// Once we discover which endpoint template works, remember it so future loads
// hit the API exactly once instead of re-probing every candidate. This caches
// the *endpoint path only* — never game/standings data — so integrity is kept.
// Each feed (games, standings) uses its own localStorage key.
const GAMES_ENDPOINT_KEY = 'wnba_working_endpoint';
const STANDINGS_ENDPOINT_KEY = 'wnba_working_standings_endpoint';

function getWorkingEndpoint(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setWorkingEndpoint(key, template) {
  try {
    localStorage.setItem(key, template);
  } catch {
    // localStorage unavailable — fall back to re-probing next time
  }
}

function clearWorkingEndpoint(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage unavailable — nothing to clear
  }
}

// Shared endpoint prober used by both the games and standings fetches. Tries the
// previously-cached endpoint first (single request on the happy path), then the
// remaining candidates. A definitive HTTP error or wrong-shape response *from
// the cached endpoint* invalidates the cache and falls through to the other
// candidates instead of failing outright — so a stale/5xx cached path can always
// recover. Rate limits (429) are always terminal (retrying just burns quota).
// Returns the value produced by `extract(data)` for the first endpoint that
// yields a non-null result.
async function probeEndpoints({ cacheKey, allCandidates, fillTemplate, extract, failPrefix }) {
  const headers = {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': API_HOST,
  };

  const cached = getWorkingEndpoint(cacheKey);
  const candidates = cached
    ? [cached, ...allCandidates.filter(t => t !== cached)]
    : allCandidates;

  let lastError = null;
  for (const template of candidates) {
    const isCached = template === cached;
    const path = fillTemplate(template);
    const url = `https://${API_HOST}${path}`;

    try {
      const response = await fetch(url, { method: 'GET', headers });

      if (response.status === 404) {
        // Wrong path for this API version — try the next candidate.
        lastError = new Error(`404 at ${path}`);
        if (isCached) clearWorkingEndpoint(cacheKey); // stale cache
        continue;
      }
      if (response.status === 429) {
        // Rate limited by RapidAPI — surface a clear, actionable message.
        throw new Error(
          'Rate limit reached (429). The WNBA API is temporarily throttling ' +
            'requests. Please wait a minute and try again.'
        );
      }
      if (!response.ok) {
        // Definitive HTTP error. If it came from the cached endpoint the cache
        // may be stale (e.g. a transient 5xx on the known-good path) — drop it
        // and keep probing the other candidates before giving up.
        const httpError = new Error(
          `API error: ${response.status} ${response.statusText}`
        );
        if (isCached) {
          clearWorkingEndpoint(cacheKey);
          lastError = httpError;
          continue;
        }
        throw httpError;
      }

      const data = await response.json();
      const extracted = extract(data);
      if (extracted === null) {
        // Reached an endpoint but it isn't the payload we expect — try next.
        lastError = new Error(`Unexpected response shape at ${path}`);
        if (isCached) clearWorkingEndpoint(cacheKey);
        continue;
      }

      // Remember the working endpoint so future loads make a single request.
      setWorkingEndpoint(cacheKey, template);
      return extracted;
    } catch (err) {
      lastError = err;
      // Rate limits and (non-cached) HTTP errors are definitive — stop probing.
      // Network errors and wrong-shape responses fall through to the next one.
      if (
        err.message.startsWith('Rate limit') ||
        err.message.startsWith('API error:')
      ) {
        throw err;
      }
    }
  }

  throw new Error(
    `${failPrefix} ${lastError ? lastError.message : 'No endpoint responded.'}`
  );
}

// Canonical team registry — the single source of truth for how every team is
// displayed. `acronym` and `emoji` follow the official 2026 naming conventions.
// `aliases` lists the abbreviations the API may send (e.g. ESPN sends "NY",
// "LA", "CONN"); `match` lets us resolve a team by name if the abbreviation is
// unfamiliar, so a team can never display with the wrong code.
const TEAMS = [
  { acronym: 'ATL', emoji: '💭', aliases: ['ATL'], match: ['atlanta', 'dream'] },
  { acronym: 'CHI', emoji: '🌃', aliases: ['CHI'], match: ['chicago', 'sky'] },
  { acronym: 'CON', emoji: '🌞', aliases: ['CON', 'CONN'], match: ['connecticut', 'sun'] },
  { acronym: 'IND', emoji: '🌡️', aliases: ['IND'], match: ['indiana', 'fever'] },
  { acronym: 'NYL', emoji: '🗽', aliases: ['NYL', 'NY'], match: ['new york', 'liberty'] },
  { acronym: 'TOR', emoji: '🎵', aliases: ['TOR'], match: ['toronto', 'tempo'] },
  { acronym: 'DAL', emoji: '🪽', aliases: ['DAL'], match: ['dallas', 'wings'] },
  { acronym: 'LAS', emoji: '✨', aliases: ['LAS', 'LA'], match: ['los angeles', 'sparks'] },
  { acronym: 'GSV', emoji: '⚔️', aliases: ['GSV', 'GS', 'GV'], match: ['golden state', 'valkyries'] },
  { acronym: 'MIN', emoji: '😼', aliases: ['MIN'], match: ['minnesota', 'lynx'] },
  { acronym: 'SEA', emoji: '⛈️', aliases: ['SEA'], match: ['seattle', 'storm'] },
  { acronym: 'PHX', emoji: '🪐', aliases: ['PHX', 'PHO'], match: ['phoenix', 'mercury'] },
  { acronym: 'PDX', emoji: '🔥', aliases: ['PDX', 'POR'], match: ['portland', 'fire'] },
  { acronym: 'LVA', emoji: '♦️', aliases: ['LVA', 'LV'], match: ['las vegas', 'aces'] },
  { acronym: 'WAS', emoji: '🔮', aliases: ['WAS', 'WSH'], match: ['washington', 'mystics'] },
];

// Resolve an API team object to its canonical { acronym, emoji }.
// Order: exact abbreviation alias -> all name keywords -> any name keyword ->
// safe fallback (show the raw abbreviation rather than break).
function resolveTeam(apiTeam) {
  const rawAbbr = (apiTeam?.abbreviation || '').toUpperCase();
  const name = (apiTeam?.displayName || apiTeam?.shortDisplayName || apiTeam?.name || apiTeam?.location || '').toLowerCase();

  const byAlias = TEAMS.find(t => t.aliases.includes(rawAbbr));
  if (byAlias) return byAlias;

  const byFullName = TEAMS.find(t => t.match.every(kw => name.includes(kw)));
  if (byFullName) return byFullName;

  const byAnyName = TEAMS.find(t => t.match.some(kw => name.includes(kw)));
  if (byAnyName) return byAnyName;

  return { acronym: rawAbbr || '???', emoji: '🏀' };
}

// Per-team colors: acronym -> { primary, secondary }. Single source of truth
// for game-cell tints — change any team's colors with a one-line edit here.
const TEAM_COLORS = {
  ATL: { primary: '#E03A3E', secondary: '#001A57' }, // Atlanta Dream
  CHI: { primary: '#418FDE', secondary: '#FFD100' }, // Chicago Sky
  CON: { primary: '#0A2240', secondary: '#FF6900' }, // Connecticut Sun
  IND: { primary: '#002D62', secondary: '#E03A3E' }, // Indiana Fever
  NYL: { primary: '#6ECEB2', secondary: '#000000' }, // New York Liberty
  TOR: { primary: '#4D2357', secondary: '#B0CDE9' }, // Toronto Tempo
  DAL: { primary: '#002B5C', secondary: '#C4D600' }, // Dallas Wings
  LAS: { primary: '#552583', secondary: '#FDB927' }, // Los Angeles Sparks
  GSV: { primary: '#5A1E96', secondary: '#000000' }, // Golden State Valkyries
  MIN: { primary: '#236192', secondary: '#78BE21' }, // Minnesota Lynx
  SEA: { primary: '#2C5234', secondary: '#FEE11A' }, // Seattle Storm
  PHX: { primary: '#201747', secondary: '#E56020' }, // Phoenix Mercury
  PDX: { primary: '#E5ACB6', secondary: '#E5E5E5' }, // Portland Fire
  LVA: { primary: '#000000', secondary: '#C8102E' }, // Las Vegas Aces
  WAS: { primary: '#002B5C', secondary: '#E03A3E' }, // Washington Mystics
};

const DEFAULT_COLORS = { primary: '#6b6375', secondary: '#c4ced3' };

export async function fetchTodaysGames() {
  if (!API_KEY) {
    throw new Error('RapidAPI key not configured. Add VITE_RAPIDAPI_KEY.');
  }

  // Compute "today" in US Eastern time, since WNBA scheduling is ET-based.
  const { Y, M, D } = easternDateParts();

  const events = await probeEndpoints({
    cacheKey: GAMES_ENDPOINT_KEY,
    allCandidates: ENDPOINT_CANDIDATES,
    fillTemplate: t => t.replace('{Y}', Y).replace('{M}', M).replace('{D}', D),
    extract: extractEvents,
    failPrefix: 'Could not load games.',
  });

  const games = events
    .map(normalizeGame)
    .filter(Boolean)
    .sort((a, b) => new Date(a.tipOffTime) - new Date(b.tipOffTime));

  return {
    games,
    fetchedAt: new Date().toISOString(),
    source: 'wnba-api (ESPN)',
  };
}

// ===== Standings =====
// Fetches the league standings (single table; top 8 make the playoffs). Mirrors
// the games fetch: probes candidate endpoints, caches the working path, and
// reads every displayed value straight from the API — nothing is computed.
export async function fetchStandings() {
  if (!API_KEY) {
    throw new Error('RapidAPI key not configured. Add VITE_RAPIDAPI_KEY.');
  }

  // Standings are keyed by season year; use the current US Eastern year.
  const { Y } = easternDateParts();

  const entries = await probeEndpoints({
    cacheKey: STANDINGS_ENDPOINT_KEY,
    allCandidates: STANDINGS_ENDPOINT_CANDIDATES,
    fillTemplate: t => t.replace('{Y}', Y),
    extract: extractStandingsEntries,
    failPrefix: 'Could not load standings.',
  });

  // Order by the API's playoff seed (defensive — the API already returns this
  // order), keeping any seedless entries last in their original order. Then the
  // displayed rank is assigned by final position, so ranks are always a
  // contiguous 1..N with no duplicates or gaps even if seeds tie or are missing.
  const standings = entries.map(normalizeStanding).filter(Boolean);
  standings.sort(bySeed);
  standings.forEach((row, i) => {
    row.rank = i + 1;
    row.isPlayoff = i < 8; // top 8 qualify for the playoffs
    delete row.seed;
  });

  return {
    standings,
    fetchedAt: new Date().toISOString(),
    source: 'wnba-api (ESPN)',
  };
}

// Sort comparator by playoff seed ascending; entries without a seed sort last.
function bySeed(a, b) {
  if (a.seed == null && b.seed == null) return 0;
  if (a.seed == null) return 1;
  if (b.seed == null) return -1;
  return a.seed - b.seed;
}

// Returns the standings entries array, or null if the response isn't standings.
function extractStandingsEntries(data) {
  if (!data || typeof data !== 'object') return null;
  const entries = data.standings?.entries;
  return Array.isArray(entries) ? entries : null;
}

// Find a stat object in an entry's stats array by its ESPN `type`.
function getStat(stats, type) {
  if (!Array.isArray(stats)) return null;
  return stats.find(s => s?.type === type) || null;
}

// Normalize one standings entry. Every value is read from the API; a missing
// stat becomes null (rendered as "—" by the UI) — never computed locally. The
// raw playoff `seed` is returned for ordering; the displayed `rank`/`isPlayoff`
// are assigned by final sorted position in fetchStandings.
function normalizeStanding(entry) {
  if (!entry?.team?.abbreviation) return null;
  const stats = entry.stats;

  const seedStat = getStat(stats, 'playoffseed');
  const winsStat = getStat(stats, 'wins');
  const lossesStat = getStat(stats, 'losses');
  const pctStat = getStat(stats, 'winpercent');
  const gbStat = getStat(stats, 'gamesbehind');
  const streakStat = getStat(stats, 'streak');

  return {
    seed: Number.isFinite(seedStat?.value) ? seedStat.value : null,
    team: buildStandingTeam(entry.team),
    wins: statText(winsStat),
    losses: statText(lossesStat),
    // Format the API's win% to the requested 0.XXX (leading zero, 3 decimals);
    // fall back to the API's own displayValue if a numeric value isn't present.
    pct: Number.isFinite(pctStat?.value) ? pctStat.value.toFixed(3) : (pctStat?.displayValue ?? null),
    gamesBehind: statText(gbStat),
    streak: statText(streakStat),
  };
}

// A stat's text: prefer the API's displayValue, fall back to its numeric value,
// else null (rendered as "—"). Keeps every field's fallback logic consistent.
function statText(stat) {
  if (!stat) return null;
  if (stat.displayValue != null) return stat.displayValue;
  if (stat.value != null) return String(stat.value);
  return null;
}

// Build a standings team object (canonical acronym + emoji + colors), reusing
// the same resolution + color map as the games module.
function buildStandingTeam(apiTeam) {
  const { acronym, emoji } = resolveTeam(apiTeam);
  return {
    abbreviation: acronym,
    emoji,
    colors: TEAM_COLORS[acronym] || DEFAULT_COLORS,
  };
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
  const { acronym, emoji } = resolveTeam(competitor.team);
  return {
    abbreviation: acronym,
    name: competitor.team.displayName || competitor.team.name || acronym,
    emoji,
    record: extractRecord(competitor),
    colors: TEAM_COLORS[acronym] || DEFAULT_COLORS,
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
