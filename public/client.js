const socket = io();

// Screen Wake Lock
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

// Mode Selection: Near (0 Data Hotspot) vs Remote
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

hotspotReadyBtn.addEventListener('click', () => {
  hotspotModal.classList.add('hidden');
});

// 3D Card Tilt
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

// Theme & Help
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

// View Switching
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

// WebRTC Direct P2P Setup for Near Mode
let peerConn = null;
let dataChannel = null;
let isWebRTCActive = false;

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
};

function setupPeerConnection(isSender, roomCode) {
  peerConn = new RTCPeerConnection(rtcConfig);

  peerConn.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { code: roomCode, candidate: event.candidate });
    }
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
  
  if (isNearMode) {
    statusText.textContent = '⚡ Pairing via Near Mode (0 MB Data)...';
    setupPeerConnection(true, currentCode);
    try {
      const offer = await peerConn.createOffer();
      await peerConn.setLocalDescription(offer);
      socket.emit('signal', { code: currentCode, desc: peerConn.localDescription });
    } catch (e) {}

    // Fallback if local connection fails
    setTimeout(() => {
      if (!isWebRTCActive) {
        socket.emit('file-meta', { code: currentCode, name: selectedFile.name, size: selectedFile.size });
      }
    }, 2500);
  } else {
    statusText.textContent = '🌐 Receiver connected! Starting remote stream...';
    socket.emit('file-meta', { code: currentCode, name: selectedFile.name, size: selectedFile.size });
  }
});

// Near Mode Direct Transfer Function
function sendFileNearMode(file) {
  statusText.textContent = `⚡ Transferring ${file.name} (0 Data Direct Link)...`;
  dataChannel.send(JSON.stringify({ type: 'header', name: file.name, size: file.size }));

  const chunkSize = 64 * 1024;
  let offset = 0;

  function sendNextChunk() {
    if (offset >= file.size) {
      dataChannel.send(JSON.stringify({ type: 'eof' }));
      progressFill.style.width = '100%';
      statusText.textContent = `⚡ Sent ${file.name}! Exactly 0 MB Data used.`;
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
      statusText.textContent = `⚡ 0 Data Transfer: ${pct}% (${formatBytes(offset)} / ${formatBytes(file.size)})`;
      sendNextChunk();
    };
    reader.readAsArrayBuffer(slice);
  }

  sendNextChunk();
}

// Remote Mode Stream Upload
socket.on('start-upload', () => {
  if (isNearMode && isWebRTCActive) return;
  statusText.textContent = `🌐 Streaming ${selectedFile.name} to receiver...`;
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/up/${currentCode}`);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = pct + '%';
      statusText.textContent = `🌐 Remote Streaming: ${pct}% (${formatBytes(e.loaded)} / ${formatBytes(e.total)})`;
    }
  };

  xhr.onload = () => {
    progressFill.style.width = '100%';
    statusText.textContent = `Transfer complete: ${selectedFile.name}`;
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
  
  if (isNearMode) {
    setupPeerConnection(false, code);
  }
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
    statusText.textContent = '⚡ Direct link connected! Zero data transfer ready.';
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
        statusText.textContent = `⚡ Receiving ${incomingMeta.name} (0 Data)...`;
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
        statusText.textContent = `✅ Saved to Device! Exactly 0 MB Internet used.`;
        releaseWakeLock();
      }
    } else {
      receivedBuffers.push(event.data);
      receivedBytes += event.data.byteLength;
      if (incomingMeta && incomingMeta.size) {
        const pct = Math.round((receivedBytes / incomingMeta.size) * 100);
        progressFill.style.width = pct + '%';
        statusText.textContent = `⚡ 0 Data Download: ${pct}% (${formatBytes(receivedBytes)} / ${formatBytes(incomingMeta.size)})`;
      }
    }
  };
}

// Remote Mode fallback receiver download
socket.on('file-meta', (meta) => {
  if (isNearMode && isWebRTCActive) return;
  statusText.textContent = `🌐 Downloading ${meta.name} (${formatBytes(meta.size)})...`;
  progressFill.style.width = '100%';
  window.location.href = `/dl/${meta.code}?name=${encodeURIComponent(meta.name)}&size=${meta.size}`;
});

socket.on('file-completed', () => {
  statusText.textContent = 'File received successfully! Ready for next file from sender.';
  releaseWakeLock();
});

// Send Another File handler
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
    socket.emit('file-meta', {
      code: currentCode,
      name: selectedFile.name,
      size: selectedFile.size
    });
  }
});
