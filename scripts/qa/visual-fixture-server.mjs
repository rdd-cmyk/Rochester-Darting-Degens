import { createServer } from 'node:http';

// Loopback-only fixture. --mutable enables in-memory UI-flow checks, not RLS or durable persistence.
const mutable = process.argv.includes('--mutable');
const missingScores = process.argv.includes('--missing-scores');
let failNextWrite = false;
let profileReadFailure = false;
let statsReadFailure = false;
let nextWriteDelayMs = 0;
const users = [
  { id: '11111111-1111-4111-8111-111111111111', display_name: 'Demo captain', first_name: 'Demo', last_name: 'Captain', include_first_name_in_display: false },
  { id: '22222222-2222-4222-8222-222222222222', display_name: 'Demo rival', first_name: 'Demo', last_name: 'Rival', include_first_name_in_display: false },
  { id: '33333333-3333-4333-8333-333333333333', display_name: 'Demo rookie with a very long nickname', first_name: 'Demo', last_name: 'Rookie', include_first_name_in_display: false },
  ...(mutable ? ['4', '5', '6', '7', '8', '9', 'a'].map((digit) => ({
    id: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`,
    display_name: `Demo extra ${digit.toUpperCase()}`,
    first_name: 'Demo',
    last_name: `Extra ${digit.toUpperCase()}`,
    include_first_name_in_display: false,
  })) : []),
];
const user = {
  id: users[0].id,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo-captain@example.test',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
};
const matches = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  played_at: new Date(Date.UTC(2026, 7, 1 + index, 19)).toISOString(),
  game_type: index % 2 ? 'Cricket' : '501',
  board_type: index % 3 ? 'Steel Tip' : 'Soft Tip',
  venue: 'Synthetic League',
  notes: index === 0 ? 'Synthetic visual fixture' : '',
  created_by: user.id,
}));
const rows = matches.flatMap((match) => [0, 1].map((side) => {
  const profile = users[(match.id + side) % 3];
  const score = match.game_type === 'Cricket' ? Number((2.1 + ((match.id + side) % 8) / 10).toFixed(2)) : 52 + ((match.id * 5 + side * 9) % 35);
  return {
    id: match.id * 10 + side,
    match_id: match.id,
    player_id: profile.id,
    is_winner: side === (match.id % 3 === 0 ? 1 : 0),
    score: missingScores && match.id === 1 ? (side === 0 ? null : 0) : score,
    points_scored: match.game_type === 'Cricket' ? 30 + match.id : null,
    profiles: profile,
    matches: match,
  };
}));

const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,prefer,range,range-unit',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-expose-headers': 'content-range,range-unit',
  'content-type': 'application/json',
};
const send = (response, code, body, extra = {}) => {
  response.writeHead(code, { ...headers, ...extra });
  response.end(JSON.stringify(body));
};

async function readJson(request) {
  let data = '';
  for await (const chunk of request) data += chunk;
  return JSON.parse(data || '{}');
}

function eq(url, key) {
  const value = url.searchParams.get(key);
  return value?.startsWith('eq.') ? value.slice(3) : null;
}

function playerRow(row) {
  return {
    ...row,
    profiles: users.find((profile) => profile.id === row.player_id) ?? null,
    matches: matches.find((match) => match.id === row.match_id) ?? null,
  };
}

function matchRow(match, selectedPlayerId) {
  const all = rows.filter((row) => row.match_id === match.id).map((row) => ({
    ...playerRow(row),
    profiles: [users.find((profile) => profile.id === row.player_id) ?? null],
  }));
  return {
    ...match,
    match_players: selectedPlayerId ? all.filter((row) => row.player_id === selectedPlayerId) : all,
    all_match_players: all,
  };
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:54321');
  if (request.method === 'OPTIONS') return send(response, 204, null);
  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') return send(response, 200, { access_token: 'local-visual-fixture', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'local-visual-refresh', user });
  if (url.pathname === '/auth/v1/token' && request.method === 'POST') {
    const body = await readJson(request);
    if (body.email !== user.email) return send(response, 400, { code: 'invalid_credentials', message: 'Invalid login credentials' });
    return send(response, 200, { access_token: 'local-visual-fixture', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'local-visual-refresh', user });
  }
  if (url.pathname === '/auth/v1/user') return send(response, 200, user);
  if (url.pathname === '/auth/v1/logout') return send(response, 204, null);
  if (mutable && url.pathname === '/__qa__/fail-next-write' && request.method === 'POST') {
    failNextWrite = true;
    return send(response, 200, { message: 'The next fixture write will fail once.' });
  }
  if (mutable && url.pathname === '/__qa__/delay-next-write' && request.method === 'POST') {
    const delay = Number(url.searchParams.get('ms'));
    if (!Number.isInteger(delay) || delay < 1 || delay > 5000) return send(response, 400, { message: 'ms must be an integer from 1 to 5000.' });
    nextWriteDelayMs = delay;
    return send(response, 200, { message: `The next fixture write will wait ${delay}ms.` });
  }
  if (mutable && url.pathname === '/__qa__/profile-read-failure' && request.method === 'POST') {
    const enabled = url.searchParams.get('enabled');
    if (enabled !== '0' && enabled !== '1') return send(response, 400, { message: 'enabled must be 0 or 1.' });
    profileReadFailure = enabled === '1';
    return send(response, 200, { message: `Fixture profile read failure ${profileReadFailure ? 'enabled' : 'disabled'}.` });
  }
  if (mutable && url.pathname === '/__qa__/stats-read-failure' && request.method === 'POST') {
    const enabled = url.searchParams.get('enabled');
    if (enabled !== '0' && enabled !== '1') return send(response, 400, { message: 'enabled must be 0 or 1.' });
    statsReadFailure = enabled === '1';
    return send(response, 200, { message: `Fixture statistics read failure ${statsReadFailure ? 'enabled' : 'disabled'}.` });
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    const table = url.pathname.split('/').at(-1);
    if (table === 'profiles' && request.method === 'GET' && profileReadFailure) {
      return send(response, 400, { code: 'PGRST000', message: 'Synthetic profile read failure.' });
    }
    if (table === 'match_players' && request.method === 'GET' && statsReadFailure) {
      return send(response, 400, { code: 'PGRST000', message: 'Synthetic statistics read failure.' });
    }
    if (request.method !== 'GET') {
      if (!mutable) return send(response, 405, { message: 'Synthetic visual fixture is read-only.' });
      if (failNextWrite) {
        failNextWrite = false;
        return send(response, 503, { message: 'Synthetic one-time write failure.' });
      }
      if (nextWriteDelayMs) {
        const delay = nextWriteDelayMs;
        nextWriteDelayMs = 0;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      const body = request.method === 'DELETE' ? null : await readJson(request);
      if (table === 'profiles' && request.method === 'POST') {
        for (const incoming of Array.isArray(body) ? body : [body]) {
          const existing = users.find((profile) => profile.id === incoming.id);
          if (existing) Object.assign(existing, incoming);
          else users.push(incoming);
        }
        return send(response, 201, null);
      }
      if (table === 'matches' && request.method === 'POST') {
        const incoming = (Array.isArray(body) ? body : [body])[0];
        const match = { id: Math.max(0, ...matches.map((item) => item.id)) + 1, ...incoming };
        matches.push(match);
        return send(response, 201, request.headers.accept?.includes('application/vnd.pgrst.object+json') ? match : [match]);
      }
      if (table === 'matches' && request.method === 'PATCH') {
        const match = matches.find((item) => String(item.id) === eq(url, 'id') && item.created_by === eq(url, 'created_by'));
        if (match) Object.assign(match, body);
        return send(response, 204, null);
      }
      if (table === 'match_players' && request.method === 'POST') {
        for (const incoming of Array.isArray(body) ? body : [body]) {
          rows.push({ id: Math.max(0, ...rows.map((item) => item.id)) + 1, ...incoming });
        }
        return send(response, 201, null);
      }
      if (table === 'match_players' && request.method === 'DELETE') {
        for (let index = rows.length - 1; index >= 0; index--) {
          if (String(rows[index].match_id) === eq(url, 'match_id')) rows.splice(index, 1);
        }
        return send(response, 204, null);
      }
      return send(response, 405, { message: 'Unsupported synthetic write.' });
    }

    const selectedPlayerId = eq(url, 'match_players.player_id');
    let data = table === 'profiles'
      ? [...users]
      : table === 'match_players'
        ? rows.map(playerRow)
        : table === 'matches'
          ? matches.filter((match) => !selectedPlayerId || rows.some((row) => row.match_id === match.id && row.player_id === selectedPlayerId)).map((match) => matchRow(match, selectedPlayerId))
          : [];
    if (eq(url, 'id')) data = data.filter((row) => String(row.id) === eq(url, 'id'));
    if (eq(url, 'player_id')) data = data.filter((row) => row.player_id === eq(url, 'player_id'));
    if (eq(url, 'game_type')) data = data.filter((row) => row.game_type === eq(url, 'game_type'));
    if (eq(url, 'match_players.is_winner')) data = data.filter((row) => row.match_players.some((player) => String(player.is_winner) === eq(url, 'match_players.is_winner')));
    const order = url.searchParams.get('order');
    if (order?.startsWith('played_at.')) data.sort((a, b) => order.endsWith('.desc') ? String(b.played_at).localeCompare(String(a.played_at)) : String(a.played_at).localeCompare(String(b.played_at)));
    if (order?.startsWith('display_name.')) data.sort((a, b) => order.endsWith('.desc') ? String(b.display_name).localeCompare(String(a.display_name)) : String(a.display_name).localeCompare(String(b.display_name)));
    const total = data.length;
    const range = request.headers.range?.split('-').map(Number);
    const offset = Number(url.searchParams.get('offset') ?? range?.[0] ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? (range?.length === 2 ? range[1] - range[0] + 1 : total));
    data = data.slice(offset, offset + limit);
    const single = request.headers.accept?.includes('application/vnd.pgrst.object+json');
    return send(response, single ? (data[0] ? 200 : 406) : 200, single ? data[0] ?? { code: 'PGRST116' } : data, { 'content-range': `${offset}-${Math.max(offset, offset + data.length - 1)}/${total}`, 'range-unit': 'items' });
  }
  send(response, 404, { message: 'Unknown local fixture endpoint' });
}).listen(54321, '127.0.0.1', () => {
  process.stdout.write(`Synthetic ${mutable ? 'mutable' : 'read-only'} API listening on 127.0.0.1:54321\n`);
});
