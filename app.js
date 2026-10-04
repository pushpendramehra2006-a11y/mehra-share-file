const $ = s => document.querySelector(s);
const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
const setStatus = t => $('#status').textContent = t;
const fmt = n => n > 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : (n / 1e3).toFixed(0) + ' KB';

let ws, live = false;
const SID = Math.random().toString(36).slice(2) + Date.now().toString(36); // is device ki pehchaan (reconnect ke liye)
// Live Server (5500) par ho to server 3001 par dhoondho
const SRV = ['3000', '3001'].includes(location.port) ? location.host : location.hostname + ':3001';
const BASE = location.protocol + '//' + SRV;
const files = {}, cards = {};
const sig = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function connectWS() {
  return new Promise((res, rej) => {
    if (location.protocol === 'file:') return rej(new Error('file'));
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + SRV);
    ws.onopen = () => { live = true; sig({ type: 'hello', sid: SID }); res(); };
    ws.onerror = () => { if (!live) rej(new Error('ws')); };
    ws.onmessage = e => onSignal(JSON.parse(e.data));
    ws.onclose = () => {
      if (!live) return;
      setStatus('⚠ Connection toota - dobara jud raha hai...');
      setTimeout(() => connectWS().catch(() => {}), 2000);   // apne aap dobara judega
    };
  });
}
function connErr(e) {
  const m = e.message === 'file'
    ? '❌ Page file se khula hai. Terminal me "node server.js" chalao aur browser me http://localhost:3001 kholo'
    : '❌ Server se connect nahi hua. Check karo "node server.js" chal raha hai';
  setStatus(m); alert(m); show('home');
}
function onSignal(d) {
  if (d.type === 'joined') { show('transfer'); setStatus('✅ Connected - ab file bhejo ya lo'); }
  else if (d.type === 'file') incoming(d);
  else if (d.type === 'resumed') { show('transfer'); setStatus('✅ Connected - ab file bhejo ya lo'); }
  else if (d.type === 'go') upload(d.id, d.offset || 0);
  else if (d.type === 'prog' && cards[d.id]) progress(cards[d.id], d.loaded, d.total);
  else if (d.type === 'done' && cards[d.id]) finish(cards[d.id]);
  else if (d.type === 'no' && cards[d.id]) cards[d.id].querySelector('.sp').textContent = '❌ Dusre ne mana kar diya';
  else if (d.type === 'error') alert('Code galat hai ya expire ho gaya');
  else if (d.type === 'left') setStatus('⚠ Dusra device offline hai - wapas judte hi transfer aage badhega');
}

// ---------- UI actions ----------
$('#goSend').onclick = async () => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  $('#code').textContent = code; $('#link').textContent = location.origin + '/?c=' + code;
  show('send'); setStatus('Server se connect ho raha hai...');
  try { await connectWS(); } catch (e) { return connErr(e); }
  sig({ type: 'host', code }); setStatus('Dusre device ka intezaar...');
};
$('#goRecv').onclick = () => show('recv');
$('#joinBtn').onclick = async () => {
  const c = $('#codeIn').value.trim(); if (c.length !== 6) return;
  try { await connectWS(); } catch (e) { return connErr(e); }
  sig({ type: 'join', code: c }); setStatus('Connect ho raha hai...');
};
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => location.href = location.pathname);
document.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { const i = $('#file'); i.accept = b.dataset.acc; i.click(); });
$('#file').onchange = e => { for (const f of e.target.files) offer(f); e.target.value = ''; };
const q = new URLSearchParams(location.search).get('c');
if (q) { show('recv'); $('#codeIn').value = q; $('#joinBtn').click(); }

// ---------- 3D tilt ----------
document.addEventListener('pointermove', e => {
  const c = e.target.closest('.tilt'); if (!c) return;
  const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  c.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 18}deg) scale(1.03)`;
});
document.addEventListener('pointerout', e => { const c = e.target.closest('.tilt'); if (c) c.style.transform = ''; });

// ---------- transfer ----------
function addCard(name, size, icon) {
  const d = document.createElement('div'); d.className = 'card item';
  d.innerHTML = `<div class="name">${icon} </div><small>${fmt(size)}</small><div class="pct">0%</div><canvas width="600" height="100"></canvas><div class="bar"><b></b></div><small class="sp"></small><div class="out"></div>`;
  d.querySelector('.name').append(name);
  $('#list').prepend(d); d.sp = []; return d;
}
const eta = s => !isFinite(s) || s <= 0 ? '' : s < 60 ? Math.ceil(s) + ' sec' : Math.floor(s / 60) + ' min ' + Math.ceil(s % 60) + ' sec';
function progress(c, done, total) {
  const now = performance.now();
  if (!c.t0) { c.t0 = c.lastT = now; c.lastB = c.base = done; }
  if (now - c.lastT < 300 && done < total) return;
  const v = (done - c.lastB) / 1e6 / ((now - c.lastT) / 1000 || 1);
  c.lastT = now; c.lastB = done; c.sp.push(v);
  const avg = (done - c.base) / 1e6 / ((now - c.t0) / 1000 || 1), pct = Math.round(done / total * 100);
  c.querySelector('b').style.width = pct + '%';
  c.querySelector('.pct').textContent = pct + '%';
  c.querySelector('.sp').textContent = `${fmt(done)} / ${fmt(total)} • ${v.toFixed(1)} MB/s • ${eta((total - done) / 1e6 / avg)}`;
  draw(c);
}
function draw(c) {
  const cv = c.querySelector('canvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height, a = c.sp, m = Math.max(...a, 1);
  const pt = (v, i) => [i / Math.max(a.length - 1, 1) * W, H - v / m * (H - 10)];
  g.clearRect(0, 0, W, H);
  g.beginPath(); g.moveTo(0, H); a.forEach((v, i) => g.lineTo(...pt(v, i))); g.lineTo(W, H); g.closePath();
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,212,255,.55)'); gr.addColorStop(1, 'rgba(124,92,255,.05)');
  g.fillStyle = gr; g.fill();
  g.beginPath(); a.forEach((v, i) => i ? g.lineTo(...pt(v, i)) : g.moveTo(...pt(v, i)));
  g.strokeStyle = '#00d4ff'; g.lineWidth = 2.5; g.stroke();
}
function finish(c) {
  c.querySelector('b').style.width = '100%'; c.querySelector('.pct').textContent = '100%';
  c.querySelector('.sp').textContent = '✅ Poora hua';
}

// Bhejne wala: pehle sirf naam batata hai; receiver "Save" dabaye tab file seedhi stream hoti hai (RAM me nahi)
function offer(f) {
  const id = Math.random().toString(36).slice(2, 10);
  files[id] = f; cards[id] = addCard(f.name, f.size, '📤');
  cards[id].querySelector('.sp').textContent = 'Dusre device ke jawab ka intezaar...';
  sig({ type: 'file', id, name: f.name, size: f.size, mime: f.type });
}
function upload(id, offset = 0) {      // offset > 0 = resume: file ka bacha hua hissa hi bhejo
  const f = files[id], c = cards[id]; if (!f) return;
  if (c.xhr) c.xhr.abort();
  const x = c.xhr = new XMLHttpRequest();
  c.t0 = 0;
  x.open('POST', BASE + '/up/' + id + '?offset=' + offset);
  x.upload.onprogress = e => {
    progress(c, offset + e.loaded, f.size);
    const n = performance.now();
    if (n - (c.sent || 0) > 250) { c.sent = n; sig({ type: 'prog', id, loaded: offset + e.loaded, total: f.size }); }
  };
  x.onload = () => { if (x.status === 200) { finish(c); sig({ type: 'done', id }); } else c.querySelector('.sp').textContent = '❌ Receiver ne band kiya'; };
  x.onerror = () => c.querySelector('.sp').textContent = '⏸ Ruk gaya - net aate hi receiver ke download me "Resume" dabao, wahin se aage badhega';
  x.send(offset ? f.slice(offset) : f);
}
// Lene wala: sirf Haan / Nahi puchho
function incoming(m) {
  const c = addCard(m.name, m.size, '📥'), out = c.querySelector('.out'); cards[m.id] = c;
  c.querySelector('.sp').textContent = 'Ye file lena hai?';
  const row = document.createElement('div'); row.className = 'picks'; row.style.marginTop = '12px';
  const yes = document.createElement('button'); yes.className = 'btn'; yes.textContent = '✅ Haan';
  const no = document.createElement('button'); no.className = 'btn ghost'; no.textContent = '❌ Nahi';
  yes.onclick = () => {
    row.remove();
    const a = document.createElement('a'); a.href = BASE + '/dl/' + m.id; a.download = m.name; a.click();
    c.querySelector('.sp').textContent = 'Download shuru ho gaya';
  };
  no.onclick = () => { row.remove(); sig({ type: 'no', id: m.id }); c.querySelector('.sp').textContent = '❌ Mana kar diya'; };
  row.append(yes, no); out.append(row);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
