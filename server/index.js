import { Server } from 'socket.io';
import http from 'http';

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const players = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', (userData) => {
    players[socket.id] = {
      id: socket.id,
      position: userData.position || { x: 0, y: 0, z: 0 },
      rotation: userData.rotation || { x: 0, y: 0, z: 0 },
      weaponId: userData.weaponId || 'Pistol',
      name: userData.name || 'Anonymous',
      health: 100,
    };

    // Send existing players to the new player
    socket.emit('playersList', Object.values(players));

    // Broadcast new player to others
    socket.broadcast.emit('playerJoined', players[socket.id]);
  });

  socket.on('updateState', (state) => {
    if (players[socket.id]) {
      players[socket.id].position = state.position;
      players[socket.id].rotation = state.rotation;
      players[socket.id].weaponId = state.weaponId;

      socket.broadcast.emit('playerUpdated', players[socket.id]);
    }
  });

  socket.on('fire', (fireData) => {
    socket.broadcast.emit('playerFired', {
      playerId: socket.id,
      ...fireData,
    });
  });

  socket.on('hit', (hitData) => {
    const targetId = hitData.targetId;
    if (players[targetId]) {
      players[targetId].health -= hitData.damage;

      io.emit('playerHit', {
        playerId: targetId,
        damage: hitData.damage,
        newHealth: players[targetId].health,
        attackerId: socket.id,
      });

      if (players[targetId].health <= 0) {
        io.emit('playerDied', {
          playerId: targetId,
          attackerId: socket.id,
        });
        // Reset health for respawn (simple logic)
        players[targetId].health = 100;
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
