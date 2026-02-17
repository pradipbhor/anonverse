const logger = require('../loaders/logger');
const presenceService = require('../services/PresenceService');

/**
 * SignalingHandler
 * Owns: webrtc-offer, webrtc-answer, webrtc-ice-candidate events.
 * Server is NOT in the media path — it only relays signaling messages
 * between peers via the shared room.
 */
function register(socket, io) {

  // ─── OFFER ─────────────────────────────────────────────────
  socket.on('webrtc-offer', (data) => {
    const user = presenceService.getUser(socket.id);
    if (!_isInMatch(user, socket)) return;

    logger.info('Relaying webrtc-offer', { from: socket.id, roomId: user.roomId });

    socket.to(user.roomId).emit('webrtc-offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  // ─── ANSWER ────────────────────────────────────────────────
  socket.on('webrtc-answer', (data) => {
    const user = presenceService.getUser(socket.id);
    if (!_isInMatch(user, socket)) return;

    logger.info('Relaying webrtc-answer', { from: socket.id, roomId: user.roomId });

    socket.to(user.roomId).emit('webrtc-answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  // ─── ICE CANDIDATE ─────────────────────────────────────────
  socket.on('webrtc-ice-candidate', (data) => {
    const user = presenceService.getUser(socket.id);
    if (!_isInMatch(user, socket)) return;

    socket.to(user.roomId).emit('webrtc-ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });
}

// ─── PRIVATE ─────────────────────────────────────────────────

function _isInMatch(user, socket) {
  if (!user || !user.isMatched || !user.roomId) {
    logger.warn('Signaling event from unmatched user', { socketId: socket.id });
    return false;
  }
  return true;
}

module.exports = { register };