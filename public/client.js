const socket = io();

// Wake Lock
let wakeLock = null;
const wakeLockStatus = document.getElementById('wakeLockStatus');
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      if (wakeLockStatus) wakeLockStatus.classList.remove('hidden');
      wakeLock.addEventListener('release', () => {
        if (wakeLockStatus) wakeLockStatus.classList.add('hidden');
      });
    }
  } catch (err) {}
}
function releaseWakeLock() {
  if (wakeLock) wakeLock.release().then(() => { wakeLock = null; });
}

// -------------------------------------------------------------
// REAL-TIME SPEED & OS FILE COPY GRAPH ENGINE (Canvas Wave)
// -------------------------------------------------------------
const canvas = document.getElementById('transferGraphCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const speedMetric = document.getElementById('speedMetric');
const transferredAmountText = document.getElementById('transferredAmountText');
const etaText = document.getElementById('etaText');

let speedHistory = new Array(50).fill(0);
let lastTransferredBytes = 0;
let lastTimestamp = Date.now();
let graphInterval = null;

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.parentElement.clientHeight * window.devicePixelRatio;
  if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));

function renderGraph() {
  if (!ctx || !canvas) return;
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;

  ctx.clearRect(0, 0, w, h);

  // Background Grid Lines (Like Windows Explorer Copy Graph)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw Smooth Gradient Speed Wave
  const maxSpeed = Math.max(...speedHistory, 5); // Minimum 5 MB/s scale ceiling
  const step = w / (speedHistory.length - 1);

  ctx.beginPath();
  ctx.moveTo(0, h);

  for (let i = 0; i < speedHistory.length; i++) {
    const val = speedHistory[i];
    const normalizedY = h - (val / maxSpeed) * (h - 12);
    ctx.lineTo(i * step, normalizedY);
  }
  ctx.lineTo(w, h);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(0, 194, 255, 0.45)');
  gradient.addColorStop(1, 'rgba(120, 98, 249, 0.02)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // Top Stroke Line
  ctx.beginPath();
  for (let i = 0; i < speedHistory.length; i++) {
    const val = speedHistory[i];
    const normalizedY = h - (val / maxSpeed) * (h - 12);
    if (i === 0) ctx.moveTo(0, normalizedY);
    else ctx.lineTo(i * step, normalizedY);
  }
  ctx.strokeStyle = '#00c2ff';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function startGraphEngine() {
  resizeCanvas();
  speedHistory.fill(0);
  lastTimestamp = Date.now();
  if (graphInterval) clearInterval(graphInterval);

  graphInterval = setInterval(() => {
    renderGraph();
  }, 100);
}

function stopGraphEngine() {
  if (graphInterval) clearInterval(graphInterval);
  speedMetric.textContent = '0.0 MB/s';
  etaText.textContent = 'Done';
}

function recordProgress(currentBytes, totalBytes) {
  const now = Date.now();
  const timeDiff = (now - lastTimestamp) / 1000;

  if (timeDiff >= 0.4) {
    const bytesDiff = currentBytes - lastTransferredBytes;
    const speedMBps = (bytesDiff / (1024 * 1024)) / timeDiff; // Speed in MB/s
    
    speedHistory.push(speedMBps);
    speedHistory.shift();

    speedMetric.textContent = `${speedMBps.toFixed(1)} MB/s`;

    // Calculate Estimated Time Remaining (ETA)
    const remainingBytes = totalBytes - currentBytes;
    if (speedMBps > 0.05 && remainingBytes > 0) {
      const remainingSeconds = Math.round(remainingBytes / (speedMBps * 1024 * 1024));
      if (remainingSeconds < 60) {
        etaText.textContent = `${remainingSeconds}s remaining`;
      } else {
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        etaText.textContent = `${mins}m ${secs}s remaining`;
      }
    } else {
      etaText.textContent = 'Calculating ETA...';
    }

    lastTransferredBytes = currentBytes;
    lastTimestamp = now;
  }

  transferredAmountText.textContent = `${formatBytes(currentBytes)} / ${formatBytes(totalBytes)}`;
}

// -------------------------------------------------------------
// UI Modes, 3D Tilt & Orientation Adaptations
// -------------------------------------------------------------
let isNearMode = true;
const selectNearModeBtn = document.getElementById('selectNearModeBtn');
const selectRemoteModeBtn = document.getElementById('selectRemoteModeBtn');
const modeDescription = document.getElementById('modeDescription');
const hotspotModal = document.getElementById('hotspotModal');
const hotspotReadyBtn = document.getElementById('hotspotReadyBtn');

selectNearModeBtn.addEventListener('click', () => {
  isNearMode = true;
  selectNearModeBtn.classList.add('active');
  selectRemoteModeBtn.classList.remove('active');
  modeDescription.textContent = '⚡ Near Mode: 0 MB mobile data via local Hotspot/Wi-Fi';
  hotspotModal.classList.remove('hidden');
});

selectRemoteModeBtn.addEventListener('click', () => {
  isNearMode = false;
  selectRemoteModeBtn.classList.add('active');
  selectNearModeBtn.classList.remove('active');
  modeDescription.textContent = '🌐 Remote Mode: Fast peer sharing anywhere across the internet';
  hotspotModal.classList.add('hidden');
});

hotspotReadyBtn.addEventListener('click', () => hotspotModal.classList.add('hidden'));

// 3D Card Tilt (Only on devices with pointer/mouse for responsiveness)
const tiltCard = document.getElementById('tiltCard');
const cardShine = document.getElementById('cardShine');
if (tiltCard && window.matchMedia("(hover: hover)").matches) {
  tiltCard.addEventListener('mousemove', (e) => {
    const rect = tiltCard.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    tiltCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
    if (cardShine) {
      cardShine.style.opacity = '1';
      cardShine.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255, 255, 255, 0.25) 0%, transparent 60%)`;
    }
  });
  tiltCard.addEventListener('mouseleave', () => {
    tiltCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    if (cardShine) cardShine.style.opacity = '0';
  });
}

// Themes & Batman Torch
const themeBtn = document.getElementById('themeToggleBtn');
const htmlEl = document.documentElement;
themeBtn.addEventListener('click', () => {
  const currentTheme = htmlEl.getAttribute('data-theme');
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  htmlEl.setAttribute('data-theme', nextTheme);
  themeBtn.textContent = nextTheme === 'dark' ? '☀️' : '🌙';
});

const helpBtn = document.getElementById('helpTorchBtn');
const batOverlay = document.getElementById('batSignalOverlay');
helpBtn.addEventListener('click', () => batOverlay.classList.toggle('hidden'));
batOverlay.addEventListener('click', (e) => { if (e.target === batOverlay) batOverlay.classList.add('hidden'); });

// View Switch
const sendViewBtn = document.getElementById('sendViewBtn');
const receiveViewBtn = document.getElementById('receiveViewBtn');
const senderSection = document.getElementById('senderSection');
const receiverSection = document.getElementById('receiverSection');

sendViewBtn.addEventListener('click', () => {
  sendViewBtn.className = 'core-btn primary-btn';
  receiveViewBtn.className = 'core-btn secondary-btn';
  senderSection.classList.remove('hidden');
  receiverSection.classList.add('hidden');
});

receiveViewBtn.addEventListener('click', () => {
  receiveViewBtn.className = 'core-btn primary-btn';
  sendViewBtn.className = 'core-btn secondary-btn';
  receiverSection.classList.remove('hidden');
  senderSection.classList.add('hidden');
});

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// -------------------------------------------------------------
// WEBRTC P2P & TRANSFER CORE
// -------------------------------------------------------------
let peerConn = null;
let dataChannel = null;
let isWebRTCActive = false;
const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
  iceCandidatePoolSize: 10
};

function setupPeerConnection(isSender, roomCode) {
  peerConn = new RTCPeerConnection(rtcConfig);
  peerConn.onicecandidate = (event) => {
    if (event.candidate) socket.emit('signal', { code: roomCode, candidate: event.candidate });
  };
  if (isSender) {
    dataChannel = peerConn.createDataChannel('directP2PChannel', { ordered: true });
    setupDataChannelEvents(dataChannel, true);
  } else {
    peerConn.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannelEvents(dataChannel, false);
    };
  }
}

socket.on('signal', async (data) => {
  if (!peerConn) return;
  try {
    if (data.desc) {
      await peerConn.setRemoteDescription(new RTCSessionDescription(data.desc));
      if (data.desc.type === 'offer') {
        const answer = await peerConn.createAnswer();
        await peerConn.setLocalDescription(answer);
        socket.emit('signal', { code: currentCode, desc: peerConn.localDescription });
      }
    } else if (data.candidate) {
      await peerConn.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  } catch (err) {}
});

// Sender Logic
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');
const generateCodeBtn = document.getElementById('generateCodeBtn');
const filePickerWrapper = document.getElementById('filePickerWrapper');
const codeDisplayContainer = document.getElementById('codeDisplayContainer');
const generatedCodeText = document.getElementById('generatedCodeText');
const copyCodeBtn = document.getElementById('copyCodeBtn');

const sendMoreContainer = document.getElementById('sendMoreContainer');
const moreFileInput = document.getElementById('moreFileInput');
const sendNextFileBtn = document.getElementById('sendNextFileBtn');

const statusContainer = document.getElementById('statusContainer');
const statusText = document.getElementById('statusText');
const progressFill = document.getElementById('progressFill');

let selectedFile = null;
let currentCode = null;

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    fileLabel.textContent = `📁 ${selectedFile.name} (${formatBytes(selectedFile.size)})`;
  }
});

generateCodeBtn.addEventListener('click', () => {
  if (!selectedFile) return alert('Please choose a file first');
  currentCode = Math.floor(100000 + Math.random() * 900000).toString();
  socket.emit('create-room', currentCode);

  generatedCodeText.textContent = currentCode;
  codeDisplayContainer.classList.remove('hidden');
  filePickerWrapper.classList.add('hidden');
  statusContainer.classList.remove('hidden');
  statusText.textContent = `Session Code: ${currentCode}. Share with receiver.`;
  requestWakeLock();
});

copyCodeBtn.addEventListener('click', () => {
  if (currentCode) {
    navigator.clipboard.writeText(currentCode);
    copyCodeBtn.textContent = 'Copied!';
    setTimeout(() => copyCodeBtn.textContent = '📋 Copy', 2000);
  }
});

socket.on('receiver-joined', async () => {
  statusContainer.classList.remove('hidden');
  startGraphEngine();

  if (isNearMode) {
    statusText.textContent = '⚡ Pairing Near Mode (0 MB Data)...';
    setupPeerConnection(true, currentCode);
    try {
      const offer = await peerConn.createOffer();
      await peerConn.setLocalDescription(offer);
      socket.emit('signal', { code: currentCode, desc: peerConn.localDescription });
    } catch (e) {}

    setTimeout(() => {
      if (!isWebRTCActive) {
        socket.emit('file-meta', { code: currentCode, name: selectedFile.name, size: selectedFile.size });
      }
    }, 2500);
  } else {
    statusText.textContent = '🌐 Streaming file to receiver...';
    socket.emit('file-meta', { code: currentCode, name: selectedFile.name, size: selectedFile.size });
  }
});

function sendFileNearMode(file) {
  statusText.textContent = `⚡ Copying: ${file.name}`;
  startGraphEngine();
  lastTransferredBytes = 0;
  dataChannel.send(JSON.stringify({ type: 'header', name: file.name, size: file.size }));

  const chunkSize = 64 * 1024;
  let offset = 0;

  function sendNextChunk() {
    if (offset >= file.size) {
      dataChannel.send(JSON.stringify({ type: 'eof' }));
      progressFill.style.width = '100%';
      statusText.textContent = `Transfer complete: ${file.name}`;
      stopGraphEngine();
      sendMoreContainer.classList.remove('hidden');
      return;
    }

    if (dataChannel.bufferedAmount > 8 * 1024 * 1024) {
      setTimeout(sendNextChunk, 15);
      return;
    }

    const slice = file.slice(offset, offset + chunkSize);
    const reader = new FileReader();
    reader.onload = (e) => {
      dataChannel.send(e.target.result);
      offset += e.target.result.byteLength;
      const pct = Math.round((offset / file.size) * 100);
      progressFill.style.width = pct + '%';
      recordProgress(offset, file.size);
      sendNextChunk();
    };
    reader.readAsArrayBuffer(slice);
  }

  sendNextChunk();
}

// Remote Mode Stream Upload
socket.on('start-upload', () => {
  if (isNearMode && isWebRTCActive) return;
  statusText.textContent = `🌐 Copying ${selectedFile.name}...`;
  startGraphEngine();
  lastTransferredBytes = 0;

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/up/${currentCode}`);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = pct + '%';
      recordProgress(e.loaded, e.total);
    }
  };

  xhr.onload = () => {
    progressFill.style.width = '100%';
    statusText.textContent = `Transfer complete: ${selectedFile.name}`;
    stopGraphEngine();
    sendMoreContainer.classList.remove('hidden');
  };

  xhr.send(selectedFile);
});

// Receiver Logic
const roomCodeInput = document.getElementById('roomCodeInput');
const connectRoomBtn = document.getElementById('connectRoomBtn');

connectRoomBtn.addEventListener('click', () => {
  const code = roomCodeInput.value.trim();
  if (!code || code.length !== 6) return alert('Please enter a valid 6-digit code');
  currentCode = code;
  socket.emit('join-room', code);
  statusContainer.classList.remove('hidden');
  statusText.textContent = 'Connecting to sender...';
  if (isNearMode) setupPeerConnection(false, code);
  requestWakeLock();
});

let receivedBuffers = [];
let incomingMeta = null;
let receivedBytes = 0;

function setupDataChannelEvents(channel, isSender) {
  channel.binaryType = 'arraybuffer';

  channel.onopen = () => {
    isWebRTCActive = true;
    statusContainer.classList.remove('hidden');
    statusText.textContent = '⚡ Connected via 0 Data Direct Link';
    if (isSender && selectedFile) {
      sendFileNearMode(selectedFile);
    }
  };

  channel.onmessage = (event) => {
    if (typeof event.data === 'string') {
      const msg = JSON.parse(event.data);
      if (msg.type === 'header') {
        incomingMeta = msg;
        receivedBuffers = [];
        receivedBytes = 0;
        lastTransferredBytes = 0;
        statusText.textContent = `Receiving: ${incomingMeta.name}`;
        startGraphEngine();
      } else if (msg.type === 'eof') {
        const blob = new Blob(receivedBuffers);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = incomingMeta.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        progressFill.style.width = '100%';
        statusText.textContent = `File saved! Exactly 0 MB Internet used.`;
        stopGraphEngine();
        releaseWakeLock();
      }
    } else {
      receivedBuffers.push(event.data);
      receivedBytes += event.data.byteLength;
      if (incomingMeta && incomingMeta.size) {
        const pct = Math.round((receivedBytes / incomingMeta.size) * 100);
        progressFill.style.width = pct + '%';
        recordProgress(receivedBytes, incomingMeta.size);
      }
    }
  };
}

// Remote Fallback
socket.on('file-meta', (meta) => {
  if (isNearMode && isWebRTCActive) return;
  statusText.textContent = `Downloading ${meta.name}...`;
  progressFill.style.width = '100%';
  window.location.href = `/dl/${meta.code}?name=${encodeURIComponent(meta.name)}&size=${meta.size}`;
});

socket.on('file-completed', () => {
  statusText.textContent = 'File received successfully!';
  stopGraphEngine();
  releaseWakeLock();
});

// Multi-File
moreFileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    sendNextFileBtn.textContent = `Send ${selectedFile.name} (${formatBytes(selectedFile.size)})`;
    sendNextFileBtn.classList.remove('hidden');
  }
});

sendNextFileBtn.addEventListener('click', () => {
  if (!selectedFile) return;
  sendNextFileBtn.classList.add('hidden');
  progressFill.style.width = '0%';
  if (isNearMode && isWebRTCActive && dataChannel && dataChannel.readyState === 'open') {
    sendFileNearMode(selectedFile);
  } else {
    socket.emit('file-meta', { code: currentCode, name: selectedFile.name, size: selectedFile.size });
  }
});
