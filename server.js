// Mehra Share - server: pairing (WebSocket) + tez file pipe (HTTP) + resume (Range)
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUB = fs.existsSync(path.join(__dirname, 'public')) ? path.join(__dirname, 'public') : __dirname;
const BLOCK = /(^|[\\/])(server\.js|package(-lock)?\.json|node_modules)([\\/]|$)/;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' };

const sessions = {}, peerOf = {}, rooms = {}, transfers = {};
const send = (sid, o) => { const w = sessions[sid]; if (w && w.readyState === 1) { w.send(JSON.stringify(o)); return true; } return false; };
// sender ko "ab bhejo (is offset se)" batao; sender offline ho to wapas aane par bataya jaayega
const sendGo = (id, t) => { if (t.want != null && send(t.sid, { type: 'go', id, offset: t.want })) t.want = null; };

function transfer(req, res, kind, id, u) {
  const t = transfers[id];
  if (!t) return res.writeHead(404, CORS).end('Expired');
  t.last = Date.now();
  if (kind === 'dl') {                                   // receiver file maangta hai (ya resume karta hai)
    const rg = /^bytes=(\d+)-/.exec(req.headers.range || '');
    const start = rg ? +rg[1] : 0;
    if (t.size > 0 && start >= t.size) return res.writeHead(416, { ...CORS, 'Content-Range': `bytes */${t.size}` }).end();
    if (t.out) { if (t.inp) t.inp.destroy(); t.out.destroy(); }   // purana atka connection hata do
    t.out = res; t.inp = null;
    const inline = u.searchParams.has('inline');
    res.writeHead(start ? 206 : 200, { ...CORS,
      'Accept-Ranges': 'bytes', 'ETag': `"${id}"`,
      'Content-Type': inline ? (t.mime || 'application/octet-stream') : 'application/octet-stream',
      'Content-Length': t.size - start,
      ...(start ? { 'Content-Range': `bytes ${start}-${t.size - 1}/${t.size}` } : {}),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(t.name)}` });
    res.on('close', () => { if (t.out === res) { t.out = null; if (t.inp) t.inp.destroy(); } }); // entry rakho: resume ho sakta hai
    t.want = start; sendGo(id, t);
  } else {                                               // sender file (ya bacha hissa) bhejta hai
    const out = t.out;
    if (!out) return res.writeHead(400, CORS).end('No receiver');
    t.inp = req; req.pipe(out);
    req.on('end', () => { t.done = true; delete transfers[id]; res.writeHead(200, CORS).end('ok'); });
    req.on('close', () => { if (!t.done && t.inp === req) out.destroy(); });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, CORS).end();
  const u = new URL(req.url, 'http://x');
  const m = u.pathname.match(/^\/(up|dl)\/(\w+)$/);
  if (m) return transfer(req, res, m[1], m[2], u);
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(PUB, path.normalize(p));
  if (!f.startsWith(PUB) || BLOCK.test(path.relative(PUB, f))) return res.writeHead(403).end();
  fs.readFile(f, (e, d) => {
    if (e) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});

// Node ka default 5 minute me request kaat deta hai - badi file (10 GB) ke liye band karna zaroori
server.requestTimeout = 0;
server.headersTimeout = 60e3;

new WebSocketServer({ server }).on('connection', ws => {
  ws.on('message', m => {
    let d; try { d = JSON.parse(m); } catch { return; }
    if (d.type === 'hello') {                            // naya ya dobara juda device (same sid = same device)
      ws.sid = String(d.sid); sessions[ws.sid] = ws;
      const p = peerOf[ws.sid];
      if (p) { send(ws.sid, { type: 'resumed' }); send(p, { type: 'resumed' }); }
      for (const [id, t] of Object.entries(transfers)) if (t.sid === ws.sid) sendGo(id, t);
      return;
    }
    const sid = ws.sid; if (!sid) return;
    if (d.type === 'host') rooms[d.code] = sid;
    else if (d.type === 'join') {
      const h = rooms[d.code];
      if (!h || h === sid) return ws.send(JSON.stringify({ type: 'error' }));
      peerOf[sid] = h; peerOf[h] = sid; delete rooms[d.code];
      send(h, { type: 'joined' }); send(sid, { type: 'joined' });
    } else if (peerOf[sid]) {
      if (d.type === 'file') transfers[d.id] = { name: String(d.name), size: Number(d.size) || 0, mime: String(d.mime || ''), sid, last: Date.now() };
      send(peerOf[sid], d);
    }
  });
  ws.on('close', () => {
    if (ws.sid && sessions[ws.sid] === ws) { delete sessions[ws.sid]; const p = peerOf[ws.sid]; if (p) send(p, { type: 'left' }); }
  });
});

// 30 min se zyada atke adhoore transfer saaf karo
setInterval(() => { const n = Date.now(); for (const [id, t] of Object.entries(transfers)) if (!t.out && n - t.last > 30 * 60e3) delete transfers[id]; }, 60e3).unref();

server.on('error', e => {
  console.log(e.code === 'EADDRINUSE' ? `Port ${PORT} busy hai. Doosra port: $env:PORT=3002; node server.js` : e);
  process.exit(1);
});
server.listen(PORT, '0.0.0.0', () => {
  console.log('Mehra Share chalu hai!');
  console.log('  Laptop par  : http://localhost:' + PORT);
  for (const l of Object.values(os.networkInterfaces()))
    for (const i of l) if (i.family === 'IPv4' && !i.internal) console.log('  Phone par   : http://' + i.address + ':' + PORT);
});
