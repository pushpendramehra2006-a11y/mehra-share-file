const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 120000,
  pingInterval: 30000,
  maxHttpBufferSize: 1e8
});

server.timeout = 0;
server.keepAliveTimeout = 0;
server.requestTimeout = 0;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
  socket.on('create-room', (code) => {
    rooms[code] = { sender: socket.id, receiver: null };
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

  // WebRTC Signal Forwarder (Zero data P2P)
  socket.on('signal', (data) => {
    socket.to(data.code).emit('signal', data);
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

require('./keepalive');

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
