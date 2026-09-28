'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
let dir, home, port, child;

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port: p } = srv.address();
      srv.close(() => resolve(p));
    }).on('error', reject);
  });
}

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

const postJson = (p, obj) => request('POST', p, obj);

async function assertAlive() {
  assert.equal(child.exitCode, null, 'server process exited');
  const r = await request('GET', '/leaderboard');
  assert.equal(r.status, 200);
}

before(async () => {
  // Run a copy of server.js in a sandbox so tests never touch data/leaderboard.json or ~/.glide-armed.
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-rocket-test-'));
  home = path.join(dir, 'home');
  fs.mkdirSync(home);
  fs.copyFileSync(path.join(REPO, 'server.js'), path.join(dir, 'server.js'));
  fs.symlinkSync(path.join(REPO, 'public'), path.join(dir, 'public'), 'dir');
  fs.mkdirSync(path.join(dir, 'public-private'));
  fs.writeFileSync(path.join(dir, 'public-private', 'secret.txt'), 'TOP SECRET');
  fs.writeFileSync(path.join(dir, 'outside.txt'), 'OUTSIDE');
  port = await freePort();
  child = spawn(process.execPath, ['server.js'], {
    cwd: dir,
    env: { ...process.env, PORT: String(port), HOME: home, USERPROFILE: home },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    child.once('exit', (code) => reject(new Error(`server exited early (${code})`)));
    child.stdout.on('data', (c) => { if (String(c).includes('prompt-rocket on')) resolve(); });
  });
});

after(() => {
  if (child && child.exitCode === null) child.kill();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('GET / serves index.html with html type and no-cache', async () => {
  const r = await request('GET', '/');
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'text/html');
  assert.equal(r.headers['cache-control'], 'no-cache');
  assert.equal(r.body, fs.readFileSync(path.join(REPO, 'public', 'index.html'), 'utf8'));
});

test('static files get MIME types by extension and ignore the query string', async () => {
  const js = await request('GET', '/app.js?v=123');
  assert.equal(js.status, 200);
  assert.equal(js.headers['content-type'], 'text/javascript');
  const css = await request('GET', '/style.css');
  assert.equal(css.headers['content-type'], 'text/css');
});

test('missing static file returns 404', async () => {
  const r = await request('GET', '/nope.js');
  assert.equal(r.status, 404);
});

test('path traversal outside public/ is refused', async () => {
  for (const p of ['/../server.js', '/../outside.txt', '/%2e%2e/outside.txt', '/..%2Foutside.txt', '/../../../../etc/passwd']) {
    const r = await request('GET', p);
    assert.equal(r.status, 403, p);
    assert.doesNotMatch(r.body, /OUTSIDE|use strict|root:/, p);
  }
});

test('path traversal into a sibling directory sharing the public prefix is refused', async () => {
  const r = await request('GET', '/../public-private/secret.txt');
  assert.equal(r.status, 403);
  assert.doesNotMatch(r.body, /TOP SECRET/);
});

test('malformed percent-encoding returns 400 and does not crash the server', async () => {
  const r = await request('GET', '/%E0%A4%A');
  assert.equal(r.status, 400);
  await assertAlive();
});

test('NUL byte in the path is rejected without crashing the server', async () => {
  const r = await request('GET', '/index.html%00.js');
  assert.ok(r.status === 400 || r.status === 404, `status ${r.status}`);
  await assertAlive();
});

test('POST /event broadcasts the event to SSE subscribers', async () => {
  const received = new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/events' }, (res) => {
      assert.equal(res.headers['content-type'], 'text/event-stream');
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        buf += c;
        if (buf.startsWith('retry: 2000\n\n') && buf.length === 'retry: 2000\n\n'.length) {
          postJson('/event', { type: 'tool', name: 'Edit' }).then((r) => {
            assert.equal(JSON.parse(r.body).clients, 1);
          }, reject);
        }
        const m = buf.match(/data: (.*)\n\n/);
        if (m) { req.destroy(); resolve(JSON.parse(m[1])); }
      });
    });
    req.on('error', (e) => { if (e.code !== 'ECONNRESET') reject(e); });
  });
  assert.deepEqual(await received, { type: 'tool', name: 'Edit' });
});

test('POST /event without distance does not touch the leaderboard', async () => {
  const beforeLb = JSON.parse((await request('GET', '/leaderboard')).body);
  const r = await postJson('/event', { type: 'end' });
  assert.deepEqual(JSON.parse(r.body), { ok: true, clients: 0 });
  assert.deepEqual(JSON.parse((await request('GET', '/leaderboard')).body), beforeLb);
});

test('POST /event with invalid JSON is treated as an empty event', async () => {
  const r = await request('POST', '/event', '{not json');
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.body).ok, true);
});

test('leaderboard records rounded distances, sorted desc, with whitelisted glider', async () => {
  await postJson('/event', { type: 'landed', distance: 10.4, glider: 'rocket' });
  const r = await postJson('/event', { type: 'landed', distance: 99.6, glider: '<script>evil</script>', extra: 'x' });
  assert.equal(r.status, 200);
  const lb = JSON.parse((await request('GET', '/leaderboard')).body);
  const distances = lb.map((e) => e.distance);
  assert.deepEqual(distances, [...distances].sort((a, b) => b - a));
  const top = lb.find((e) => e.distance === 100);
  assert.ok(top, 'rounded 99.6 -> 100');
  assert.deepEqual(Object.keys(top).sort(), ['at', 'distance', 'glider']);
  assert.equal(top.glider, 'rocket');
  assert.ok(lb.some((e) => e.distance === 10));
  assert.ok(!Number.isNaN(Date.parse(top.at)));
});

test('non-finite distance is not recorded on the leaderboard', async () => {
  await request('POST', '/event', '{"type":"landed","distance":1e999}');
  const lb = JSON.parse((await request('GET', '/leaderboard')).body);
  assert.ok(lb.every((e) => Number.isFinite(e.distance)), JSON.stringify(lb));
});

test('leaderboard keeps only the top 50 scores', async () => {
  for (let i = 1; i <= 55; i++) await postJson('/event', { type: 'landed', distance: 1000 + i });
  const lb = JSON.parse((await request('GET', '/leaderboard')).body);
  assert.equal(lb.length, 50);
  assert.equal(lb[0].distance, 1055);
  assert.equal(lb[49].distance, 1006);
});

test('/arm and /disarm toggle the flag file in the home directory', async () => {
  const flag = path.join(home, '.glide-armed');
  const armed = await postJson('/arm');
  assert.deepEqual(JSON.parse(armed.body), { ok: true, armed: true });
  assert.ok(fs.existsSync(flag));
  const disarmed = await postJson('/disarm');
  assert.deepEqual(JSON.parse(disarmed.body), { ok: true, armed: false });
  assert.ok(!fs.existsSync(flag));
  const again = await postJson('/disarm');
  assert.deepEqual(JSON.parse(again.body), { ok: true, armed: false });
});

test('GET on POST-only routes falls through to static 404', async () => {
  assert.equal((await request('GET', '/arm')).status, 404);
  assert.equal((await request('GET', '/event')).status, 404);
});
