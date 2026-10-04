const socket = io();

// Rain generator for Batman dark mode
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

// Sunlight floating motes for light mode
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

// 3D Card Tilt & Flash Shine Effect on Mouse Move
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

// Help Torch Overlay Toggle
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
  senderSection.classList.remove('hidden');
  receiverSection.classList.add('hidden');
});

receiveViewBtn.addEventListener('click', () => {
  receiverSection.classList.remove('hidden');
  senderSection.classList.add('hidden');
});

// File Handling
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');
const generateLinkBtn = document.getElementById('generateLinkBtn');
const shareLinkContainer = document.getElementById('shareLinkContainer');
const shareUrlInput = document.getElementById('shareUrlInput');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const statusContainer = document.getElementById('statusContainer');
const statusText = document.getElementById('statusText');
const progressFill = document.getElementById('progressFill');

let selectedFile = null;
let currentCode = null;

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    fileLabel.textContent = `📁 ${selectedFile.name} (${(selectedFile.size / (1024*1024)).toFixed(2)} MB)`;
  }
});

generateLinkBtn.addEventListener('click', () => {
  if (!selectedFile) return alert('Pehle file select karein');
  currentCode = Math.floor(100000 + Math.random() * 900000).toString();
  socket.emit('create-room', currentCode);
  
  const shareLink = `${window.location.origin}/?c=${currentCode}`;
  shareUrlInput.value = shareLink;
  shareLinkContainer.classList.remove('hidden');
});

copyLinkBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(shareUrlInput.value);
  copyLinkBtn.textContent = 'Copied!';
  setTimeout(() => copyLinkBtn.textContent = 'Copy', 2000);
});

socket.on('receiver-joined', () => {
  statusContainer.classList.remove('hidden');
  statusText.textContent = 'Receiver jud chuka hai. Direct stream start ho rahi hai...';
  socket.emit('file-meta', {
    code: currentCode,
    name: selectedFile.name,
    size: selectedFile.size
  });
});

socket.on('start-upload', () => {
  statusText.textContent = 'Streaming direct pipe to receiver...';
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/up/${currentCode}`);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = pct + '%';
      statusText.textContent = `Streaming file: ${pct}%`;
    }
  };

  xhr.onload = () => {
    statusText.textContent = 'File transfer complete!';
  };

  xhr.send(selectedFile);
});

// Receiver
const roomCodeInput = document.getElementById('roomCodeInput');
const connectRoomBtn = document.getElementById('connectRoomBtn');

const urlParams = new URLSearchParams(window.location.search);
const queryCode = urlParams.get('c');
if (queryCode) {
  receiveViewBtn.click();
  roomCodeInput.value = queryCode;
  setTimeout(() => connectRoomBtn.click(), 500);
}

connectRoomBtn.addEventListener('click', () => {
  const code = roomCodeInput.value.trim();
  if (!code) return alert('Code daaliye');
  socket.emit('join-room', code);
  statusContainer.classList.remove('hidden');
  statusText.textContent = 'Connecting to sender...';
});

socket.on('file-meta', (meta) => {
  statusText.textContent = `Downloading ${meta.name}...`;
  window.location.href = `/dl/${meta.code}?name=${encodeURIComponent(meta.name)}&size=${meta.size}`;
});
