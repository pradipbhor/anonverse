const logger = require('../loaders/logger');
const presenceService = require('../services/PresenceService');
const reconnectionService = require('../services/ReconnectionService');
const heartbeatService = require('../services/HeartbeatService');
const chatService = require('../services/ChatService');

/**
 * ConnectionHandler
 * Owns: connect, disconnect, user-join, reconnect, pong events
 */
function register(socket, io) {
  // ─── CONNECT ───────────────────────────────────────────────
  // Socket is already connected at this point.
  // We add the user to presence but wait for 'user-join' for full data.
  const tempSessionId = `temp_${socket.id}`;
  presenceService.addUser(socket.id, tempSessionId);

  logger.info('Socket connected', { socketId: socket.id });

  // ─── USER JOIN ─────────────────────────────────────────────
  socket.on('user-join', (data) => {
    try {
      const { sessionId, interests = [], mode = 'text' } = data || {};

      if (!sessionId) {
        socket.emit('error', { message: 'sessionId is required' });
        return;
      }

      // Check if this is a reconnecting session
      const isReconnect = presenceService.hasSession(sessionId);

      if (isReconnect && reconnectionService.isPending(sessionId)) {
        // Hand off to reconnect flow
        const result = reconnectionService.handleReconnect(socket.id, sessionId, io);

        if (result.success) {
          // Re-join the socket room
          socket.join(result.roomId);

          socket.emit('reconnect-success', {
            matchRestored: true,
            roomId: result.roomId,
            partnerId: result.partnerId
          });

          logger.info('Session reconnected with match restored', {
            socketId: socket.id,
            sessionId,
            roomId: result.roomId
          });
          return;
        }
      }

      // Fresh join — remap the temp session to real sessionId
      presenceService.remapSocket(socket.id, socket.id, sessionId);
      presenceService.updateUser(socket.id, { interests, mode });

      socket.emit('session-confirmed', { sessionId });

      logger.info('User joined', { socketId: socket.id, sessionId, mode });
    } catch (err) {
      logger.error('Error in user-join', { error: err.message });
    }
  });

  // ─── PONG (heartbeat response) ─────────────────────────────
  socket.on('pong', () => {
    heartbeatService.handlePong(socket.id);
  });

  // ─── DISCONNECT ────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    logger.info('Socket disconnecting', { socketId: socket.id, reason });

    reconnectionService.handleDisconnect(
      socket.id,
      reason,
      io,
      chatService
    );
  });
}

module.exports = { register };