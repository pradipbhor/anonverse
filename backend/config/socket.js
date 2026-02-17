const { Server } = require('socket.io');

function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    // Reconnection settings on the server side
    pingTimeout: 20000,   // How long to wait for pong before disconnecting
    pingInterval: 15000,  // How often to ping clients
    connectTimeout: 30000,
    maxHttpBufferSize: 1e6 // 1MB max message size
  });

  return io;
}

module.exports = { createSocketServer };