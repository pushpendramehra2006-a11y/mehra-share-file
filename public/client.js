const socket = io();

// Screen Wake Lock API for background transfer protection
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
  } catch (err) {
    console.log('Wake Lock error:', err);
  }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
    });
  }
}

// Transfer Mode Toggle: Global Cloud vs Offline Hotspot (Zero Data)
let isOfflineMode = false;
const modeToggleBtn = document.getElementById('modeToggleBtn');
const modeSubtitle = document.getElementById('modeSubtitle');

modeToggleBtn.addEventListener('click', () => {
  isOfflineMode = !isOfflineMode;
  if (isOfflineMode) {
    modeToggleBtn.textContent = '⚡ Offline Hotspot (0 Data)';
    modeToggleBtn.style.borderColor = '#2ecc71';
    modeSubtitle.textContent = 'Zero mobile data mode via local Wi-Fi / Hotspot';
  } else {
    modeToggleBtn.textContent = '🌐 Global Cloud';
    modeToggleBtn.style.borderColor = '';
    modeSubtitle.textContent = 'Fast peer-to-peer file sharing between devices';
  }
});

// Rain generator
const rainContainer = document.getElementById('rainLayer');
function initRain() {
  if (!rainContainer) return;
  rainContainer.innerHTML = '';
  for (let i = 0; i < 45; i++) {
    const drop = document.createElement('div');
    drop.className = 'drop';
    drop.style.left = Math.random() * 100 + '%';
    drop.style.animationDuration = (0.5 + Math.random() * 0.5) + 's';
    drop.style.animationDelay = (Math.random() * 1.5) + 's';
    rainContainer.appendChild(drop);
  }
}
initRain();

// Sunlight motes
const sunMotesContainer = document.getElementById('sunParticlesLayer');
function initSunMotes() {
  if (!sunMotesContainer) return;
  sunMotesContainer.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const mote = document.createElement('div');
    mote.className = 'sun-mote';
    const size = Math.random() * 5 + 3;
    mote.style.width = size + 'px';
    mote.style.height = size + 'px';
    mote.style.left = Math.random() * 100 + '%';
    mote.style.animationDuration = (4 + Math.random() * 4) + 's';
    mote.style.animationDelay = (Math.random() * 4) + 's';
    sunMotesContainer.appendChild(mote);
  }
}
initSunMotes();

// 3D Tilt & Glass Shine
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

// Theme Toggle
const themeBtn = document.getElementById('themeToggleBtn');
const htmlEl = document.documentElement;

themeBtn.addEventListener('click', () => {
  const currentTheme = htmlEl.getAttribute('data-theme');
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  htmlEl.setAttribute('data-theme', nextTheme);
  themeBtn.textContent = nextTheme === 'dark' ? '☀️' : '🌙';
});

// Help Overlay Toggle
const helpBtn = document.getElementById('helpTorchBtn');
const batOverlay = document.getElementById('batSignalOverlay');

helpBtn.addEventListener('click', () => {
  batOverlay.classList.toggle('hidden');
});

batOverlay.addEventListener('click', (e) => {
  if (e.target === batOverlay) {
    batOverlay.classList.add('hidden');
  }
});

// Tab Switchers
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
let heartbeatInterval = null;

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (currentCode) socket.emit('transfer-heartbeat', currentCode);
  }, 25000);
}

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
  statusText.textContent = `Session ready! Share code ${currentCode} with the receiver.`;
  startHeartbeat();
  requestWakeLock();
});

copyCodeBtn.addEventListener('click', () => {
  if (currentCode) {
    navigator.clipboard.writeText(currentCode);
    copyCodeBtn.textContent = 'Copied!';
    setTimeout(() => copyCodeBtn.textContent = '📋 Copy', 2000);
  }
});

socket.on('receiver-joined', () => {
  statusContainer.classList.remove('hidden');
  statusText.textContent = 'Receiver connected! Transfer starting...';
  
  socket.emit('file-meta', {
    code: currentCode,
    name: selectedFile.name,
    size: selectedFile.size
  });
});

socket.on('start-upload', () => {
  statusText.textContent = `Streaming ${selectedFile.name} directly to receiver...`;
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/up/${currentCode}`);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = pct + '%';
      statusText.textContent = `Transferring: ${pct}% (${formatBytes(e.loaded)} / ${formatBytes(e.total)})`;
    }
  };

  xhr.onload = () => {
    progressFill.style.width = '100%';
    statusText.textContent = `Transfer complete: ${selectedFile.name}`;
    sendMoreContainer.classList.remove('hidden');
  };

  xhr.send(selectedFile);
});

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
  statusText.textContent = `Preparing to send ${selectedFile.name}...`;

  socket.emit('file-meta', {
    code: currentCode,
    name: selectedFile.name,
    size: selectedFile.size
  });
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
  startHeartbeat();
  requestWakeLock();
});

socket.on('file-meta', (meta) => {
  statusText.textContent = `Downloading ${meta.name} (${formatBytes(meta.size)})...`;
  progressFill.style.width = '100%';
  window.location.href = `/dl/${meta.code}?name=${encodeURIComponent(meta.name)}&size=${meta.size}`;
});

socket.on('file-completed', () => {
  statusText.textContent = 'File received successfully! Ready for next file from sender.';
  releaseWakeLock();
});
