// Prompt Glider — local event server (Node 22, zero deps).
// Activity events (from Claude Code hooks or manual/demo POST) → SSE → 3D page.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 6030;
const ROOT = __dirname;
const ALLOWED_GLIDERS = ['claudeX', 'plane', 'dandelion', 'leaf', 'paper'];
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const LEADERBOARD = path.join(DATA_DIR, 'leaderboard.json');
const ARM_FLAG = path.join(os.homedir(), '.glide-armed');

fs.mkdirSync(DATA_DIR, { recursive: true });

const clients = new Set(); // open SSE responses

function broadcast(event) {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) { try { res.write(line); } catch { clients.delete(res); } }
}

function loadLeaderboard() {
  try { return JSON.parse(fs.readFileSync(LEADERBOARD, 'utf8')); } catch { return []; }
}

function saveScore(entry) {
  const lb = loadLeaderboard();
  lb.push(entry);
  lb.sort((a, b) => b.distance - a.distance);
  const top = lb.slice(0, 50);
  fs.writeFileSync(LEADERBOARD, JSON.stringify(top, null, 2));
  return top;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary' };

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const fp = path.normalize(path.join(PUBLIC, rel));
  if (!fp.startsWith(PUBLIC)) { res.writeHead(403); return res.end('forbidden'); } // path-traversal guard
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',  // always revalidate so client JS edits show on normal reload
    });
    res.end(buf);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e5) req.destroy(); });
    req.on('end', () => resolve(b));
  });
}

function sendJson(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (url === '/event' && req.method === 'POST') {
    let ev;
    try { ev = JSON.parse((await readBody(req)) || '{}'); } catch { ev = {}; }
    // record whenever a numeric distance is present (game posts {type:'landed',distance}
    // on touchdown; turn-end {type:'end'} has no distance and only triggers descent).
    if (typeof ev.distance === 'number') {
      const glider = ALLOWED_GLIDERS.includes(ev.glider) ? ev.glider : 'plane';  // whitelist: no arbitrary stored field
      ev.leaderboard = saveScore({ glider, distance: Math.round(ev.distance), at: new Date().toISOString() });
    }
    broadcast(ev);
    return sendJson(res, { ok: true, clients: clients.size });
  }

  if ((url === '/arm' || url === '/disarm') && req.method === 'POST') {
    if (url === '/arm') fs.writeFileSync(ARM_FLAG, new Date().toISOString());
    else if (fs.existsSync(ARM_FLAG)) fs.unlinkSync(ARM_FLAG);
    return sendJson(res, { ok: true, armed: fs.existsSync(ARM_FLAG) });
  }

  if (url === '/leaderboard' && req.method === 'GET') return sendJson(res, loadLeaderboard());

  serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => console.log(`prompt-glider on http://127.0.0.1:${PORT} (armed=${fs.existsSync(ARM_FLAG)})`));
