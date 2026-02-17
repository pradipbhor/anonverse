const logger = require('../loaders/logger');
const presenceService = require('../services/PresenceService');
const matchmakingService = require('../services/MatchmakingService');

/**
 * MatchmakingHandler
 * Owns: join-queue, leave-queue, skip-user events
 */
function register(socket, io) {

  // ─── JOIN QUEUE ────────────────────────────────────────────
  socket.on('join-queue', (data) => {
    try {
      const user = presenceService.getUser(socket.id);
      if (!user) {
        socket.emit('error', { message: 'Session not initialized. Send user-join first.' });
        return;
      }

      if (user.isMatched) {
        socket.emit('error', { message: 'Already in a match.' });
        return;
      }

      const { interests = [], mode = 'text' } = data || {};

      // Update user data before queuing
      presenceService.updateUser(socket.id, { interests, mode, inQueue: true });

      const queueUser = {
        socketId: socket.id,
        sessionId: user.sessionId,
        interests,
        mode,
        joinedQueueAt: new Date()
      };

      const result = matchmakingService.joinQueue(queueUser);

      if (result.matched) {
        _emitMatchFound(io, result.match);
      } else {
        socket.emit('queue-status', {
          position: result.position,
          estimatedWait: result.position * 15,
          message: result.position === 1
            ? 'You are first in queue!'
            : 'Looking for someone with similar interests...'
        });
      }

      logger.info('User joined queue', {
        socketId: socket.id,
        mode,
        matched: result.matched
      });
    } catch (err) {
      logger.error('Error in join-queue', { error: err.message });
      socket.emit('error', { message: 'Failed to join queue' });
    }
  });

  // ─── LEAVE QUEUE ───────────────────────────────────────────
  socket.on('leave-queue', () => {
    matchmakingService.removeFromQueues(socket.id);
    presenceService.updateUser(socket.id, { inQueue: false });
    logger.info('User left queue', { socketId: socket.id });
  });

  // ─── SKIP USER ─────────────────────────────────────────────
  socket.on('skip-user', async () => {
    try {
      const user = presenceService.getUser(socket.id);
      if (!user?.isMatched || !user.roomId) return;

      logger.info('User skipping partner', { socketId: socket.id, roomId: user.roomId });

      // Notify partner
      socket.to(user.roomId).emit('partner-disconnected', {
        reason: 'skipped',
        message: 'Your partner has skipped to the next user.'
      });

      // Leave the socket room
      socket.leave(user.roomId);

      // Clean up match
      matchmakingService.cleanupMatch(user.roomId);

      socket.emit('skip-confirmed');
    } catch (err) {
      logger.error('Error in skip-user', { error: err.message });
    }
  });
}

// ─── PRIVATE HELPERS ─────────────────────────────────────────

/**
 * Emit match-found to both users.
 * User1 is always the WebRTC initiator (sendOffer: true).
 * User2 is always the receiver (sendOffer: false).
 */
function _emitMatchFound(io, match) {
  const { roomId, user1SocketId, user2SocketId, commonInterests, mode } = match;

  const s1 = io.sockets.sockets.get(user1SocketId);
  const s2 = io.sockets.sockets.get(user2SocketId);

  if (!s1 || !s2) {
    logger.error('Match emit failed — socket not found', { user1SocketId, user2SocketId });
    matchmakingService.cleanupMatch(roomId);
    return;
  }

  s1.join(roomId);
  s2.join(roomId);

  // Update match state to CHATTING
  presenceService.updateUser(user1SocketId, { matchState: 'CHATTING' });
  presenceService.updateUser(user2SocketId, { matchState: 'CHATTING' });

  s1.emit('match-found', {
    partnerId: user2SocketId,
    commonInterests,
    mode,
    sendOffer: true,   // initiator
    roomId
  });

  s2.emit('match-found', {
    partnerId: user1SocketId,
    commonInterests,
    mode,
    sendOffer: false,  // receiver
    roomId
  });

  logger.info('match-found emitted', {
    roomId,
    initiator: user1SocketId,
    receiver: user2SocketId,
    commonInterests
  });
}

module.exports = { register };