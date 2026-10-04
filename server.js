const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});

server.timeout = 0;
server.keepAliveTimeout = 0;
server.requestTimeout = 0;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
  socket.on('create-room', (code) => {
    rooms[code] = { sender: socket.id, receiver: null, pendingRes: null };
    socket.join(code);
    socket.emit('room-created', code);
  });

  socket.on('join-room', (code) => {
    if (rooms[code]) {
      rooms[code].receiver = socket.id;
      socket.join(code);
      io.to(rooms[code].sender).emit('receiver-joined', socket.id);
      socket.emit('room-joined', code);
    } else {
      socket.emit('error-msg', 'Invalid code or room expired');
    }
  });

  socket.on('file-meta', (data) => {
    socket.to(data.code).emit('file-meta', data);
  });

  socket.on('disconnect', () => {
    for (const code in rooms) {
      if (rooms[code].sender === socket.id || rooms[code].receiver === socket.id) {
        socket.to(code).emit('peer-disconnected');
        delete rooms[code];
      }
    }
  });
});

app.post('/up/:code', (req, res) => {
  const code = req.params.code;
  const room = rooms[code];

  if (!room || !room.pendingRes) {
    return res.status(400).send('Receiver not ready for download');
  }

  req.pipe(room.pendingRes);

  req.on('end', () => {
    res.status(200).send('Done');
  });

  req.on('error', () => {
    if (room.pendingRes) room.pendingRes.end();
    res.status(500).send('Transfer error');
  });
});

app.get('/dl/:code', (req, res) => {
  const code = req.params.code;
  const room = rooms[code];

  if (!room) {
    return res.status(404).send('Session not found');
  }

  const name = req.query.name || 'file';
  const size = req.query.size || '';

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  if (size) res.setHeader('Content-Length', size);

  room.pendingRes = res;
  io.to(room.sender).emit('start-upload', { code });
});

require('./keepalive');

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
