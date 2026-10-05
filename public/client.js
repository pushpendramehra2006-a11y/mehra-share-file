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
  if (wakeLock) {
    wakeLock.release().then(() => { wakeLock = null; });
  }
}

// 3D Card Tilt & Flash Shine
const tiltCard = document.getElementById('tiltCard');
const cardShine = document.getElementById('cardShine');
if (tiltCard) {
  tiltCard.addEventListener('mousemove', (e) => {
    const rect = tiltCard.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;
    tiltCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    if (cardShine) {
      cardShine.style.opacity = '1';
      cardShine.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255, 255, 255, 0.28) 0%, transparent 60%)`;
    }
  });
  tiltCard.addEventListener('mouseleave', () => {
    tiltCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    if (cardShine) cardShine.style.opacity = '0';
  });
}

// Theme & Overlay
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
batOverlay.addEventListener('click', (e) => {
  if (e.target === batOverlay) batOverlay.classList.add('hidden');
});

// Navigation
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
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// WebRTC Direct P2P (Zero Data over Local Wi-Fi / Hotspot)
let peerConn = null;
let dataChannel = null;
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

function setupPeerConnection(isSender, roomCode) {
  peerConn = new RTCPeerConnection(rtcConfig);

  peerConn.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { code: roomCode, candidate: event.candidate });
    }
  };

  if (isSender) {
    dataChannel = peerConn.createDataChannel('fileTransfer', { ordered: true });
    setupDataChannel(dataChannel);
  } else {
    peerConn.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannel(dataChannel);
    };
  }
}

// WebRTC Signaling listeners
socket.on('signal', async (data) => {
  if (data.desc) {
    await peerConn.setRemoteDescription(new RTCSessionDescription(data.desc));
    if (data.desc.type === 'offer') {
      const answer = await peerConn.createAnswer();
      await peerConn.setLocalDescription(answer);
      socket.emit('signal', { code: currentCode, desc: peerConn.localDescription });
    }
  } else if (data.candidate) {
    try {
      await peerConn.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {}
  }
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
  statusText.textContent = `Session ready! Share code ${currentCode} with receiver.`;
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
  statusText.textContent = 'Receiver connected! Establishing Zero-Data P2P Direct Link...';

  setupPeerConnection(true, currentCode);
  const offer = await peerConn.createOffer();
  await peerConn.setLocalDescription(offer);
  socket.emit('signal', { code: currentCode, desc: peerConn.localDescription });
});

// Send file chunks directly over device-to-device DataChannel
function sendFileDirectly(file) {
  statusText.textContent = `⚡ Direct P2P Streaming: 0 MB mobile data used`;
  dataChannel.send(JSON.stringify({ type: 'header', name: file.name, size: file.size }));

  const chunkSize = 64 * 1024; // 64 KB chunks
  let offset = 0;

  function readSlice() {
    if (offset >= file.size) {
      dataChannel.send(JSON.stringify({ type: 'eof' }));
      progressFill.style.width = '100%';
      statusText.textContent = `Transfer complete: ${file.name} (Direct Device-to-Device)`;
      sendMoreContainer.classList.remove('hidden');
      return;
    }

    if (dataChannel.bufferedAmount > 8 * 1024 * 1024) {
      setTimeout(readSlice, 20);
      return;
    }

    const slice = file.slice(offset, offset + chunkSize);
    const reader = new FileReader();
    reader.onload = (e) => {
      dataChannel.send(e.target.result);
      offset += e.target.result.byteLength;
      const pct = Math.round((offset / file.size) * 100);
      progressFill.style.width = pct + '%';
      statusText.textContent = `⚡ P2P Direct Sending: ${pct}% (${formatBytes(offset)} / ${formatBytes(file.size)})`;
      readSlice();
    };
    reader.readAsArrayBuffer(slice);
  }

  readSlice();
}

// Receiver Logic
const roomCodeInput = document.getElementById('roomCodeInput');
const connectRoomBtn = document.getElementById('connectRoomBtn');

connectRoomBtn.addEventListener('click', () => {
  const code = roomCodeInput.value.trim();
  if (!code || code.length !== 6) return alert('Please enter a 6-digit code');
  currentCode = code;
  socket.emit('join-room', code);
  statusContainer.classList.remove('hidden');
  statusText.textContent = 'Connecting to sender via Direct P2P...';
  setupPeerConnection(false, code);
  requestWakeLock();
});

// Setup DataChannel Receive Buffering
let receivedBuffers = [];
let incomingMeta = null;
let receivedBytes = 0;

function setupDataChannel(channel) {
  channel.binaryType = 'arraybuffer';

  channel.onopen = () => {
    statusContainer.classList.remove('hidden');
    statusText.textContent = '⚡ Connected! Direct Zero-Data Channel is ready.';
    if (selectedFile && channel.readyState === 'open') {
      sendFileDirectly(selectedFile);
    }
  };

  channel.onmessage = (event) => {
    if (typeof event.data === 'string') {
      const msg = JSON.parse(event.data);
      if (msg.type === 'header') {
        incomingMeta = msg;
        receivedBuffers = [];
        receivedBytes = 0;
        statusText.textContent = `⚡ Receiving ${incomingMeta.name} (0 Data Direct P2P)...`;
      } else if (msg.type === 'eof') {
        // Build file locally in browser and auto trigger download without internet
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
        statusText.textContent = `⚡ File saved to device! 0 MB mobile data used.`;
        releaseWakeLock();
      }
    } else {
      receivedBuffers.push(event.data);
      receivedBytes += event.data.byteLength;
      if (incomingMeta && incomingMeta.size) {
        const pct = Math.round((receivedBytes / incomingMeta.size) * 100);
        progressFill.style.width = pct + '%';
        statusText.textContent = `⚡ Receiving (0 MB Data): ${pct}% (${formatBytes(receivedBytes)} / ${formatBytes(incomingMeta.size)})`;
      }
    }
  };
}

// Send Another File handler
moreFileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    sendNextFileBtn.textContent = `Send ${selectedFile.name} (${formatBytes(selectedFile.size)})`;
    sendNextFileBtn.classList.remove('hidden');
  }
});

sendNextFileBtn.addEventListener('click', () => {
  if (!selectedFile || !dataChannel || dataChannel.readyState !== 'open') return;
  sendNextFileBtn.classList.add('hidden');
  progressFill.style.width = '0%';
  sendFileDirectly(selectedFile);
});
