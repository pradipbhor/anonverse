const logger = require('../loaders/logger');
const presenceService = require('./PresenceService');
const matchmakingService = require('./MatchmakingService');

/**
 * ReconnectionService
 * Handles the full lifecycle of a socket reconnection:
 *   1. On disconnect  → start grace timer via MatchmakingService
 *   2. On reconnect   → remap socket, restore match, cancel grace timer
 *   3. On expiry      → notify partner, schedule message deletion
 */
class ReconnectionService {
  constructor() {
    // sessionId -> { roomId, partnerSocketId } — held during grace window
    this._pendingReconnections = new Map();
  }

  /**
   * Called when a socket disconnects.
   * If the user was in a match, starts grace period.
   * If in queue, just remove them.
   */
  handleDisconnect(socketId, reason, io, chatService) {
    const user = presenceService.getUser(socketId);
    if (!user) return;

    logger.info('Handling disconnect', { socketId, reason, isMatched: user.isMatched });

    // Always remove from queues
    matchmakingService.removeFromQueues(socketId);

    if (user.isMatched && user.roomId) {
      const partnerSocketId = matchmakingService.getPartnerSocketId(
        user.roomId,
        socketId
      );

      // Store context for potential reconnect
      this._pendingReconnections.set(user.sessionId, {
        roomId: user.roomId,
        partnerSocketId,
        disconnectedAt: new Date()
      });

      // Start grace period — partner is NOT notified yet
      matchmakingService.handleGracePeriod(
        user.roomId,
        socketId,
        async (roomId, match) => {
          // Grace expired — now notify partner and clean up
          this._pendingReconnections.delete(user.sessionId);

          if (partnerSocketId) {
            io.to(partnerSocketId).emit('partner-disconnected', {
              reason: 'timeout',
              message: 'Your partner has disconnected.'
            });
          }

          if (chatService) {
            await chatService.scheduleRoomDeletion(roomId, 12).catch(() => {});
          }

          logger.info('Grace expired — partner notified', {
            roomId,
            partnerSocketId
          });
        }
      );
    }

    // Remove user from presence AFTER extracting data above
    presenceService.removeUser(socketId);
  }

  /**
   * Called when a socket reconnects with a known sessionId.
   * Returns { success, roomId, partnerId, matchRestored }
   */
  handleReconnect(newSocketId, sessionId, io) {
    logger.info('Handling reconnect attempt', { newSocketId, sessionId });

    const pending = this._pendingReconnections.get(sessionId);
    const isInGrace = matchmakingService.isInGrace(sessionId);

    if (!pending || !isInGrace) {
      logger.info('No active grace period for session', { sessionId });
      return { success: false, matchRestored: false };
    }

    // Remap socket in presence — keeps all user state intact
    const oldSocketId = presenceService.getSocketIdBySession(sessionId);
    presenceService.remapSocket(oldSocketId, newSocketId, sessionId);

    // Restore match with new socket ID
    const match = matchmakingService.restoreMatch(sessionId, newSocketId);

    if (!match) {
      this._pendingReconnections.delete(sessionId);
      return { success: false, matchRestored: false };
    }

    this._pendingReconnections.delete(sessionId);

    const { roomId, partnerSocketId } = pending;

    // Notify partner that their peer is back
    if (partnerSocketId) {
      io.to(partnerSocketId).emit('partner-reconnected', {
        partnerId: newSocketId,
        roomId
      });
    }

    logger.info('Reconnection successful', {
      sessionId,
      newSocketId,
      roomId,
      partnerSocketId
    });

    return {
      success: true,
      matchRestored: true,
      roomId,
      partnerId: partnerSocketId
    };
  }

  /**
   * Check if a session has a pending reconnection context
   */
  isPending(sessionId) {
    return this._pendingReconnections.has(sessionId);
  }
}

// Singleton
const reconnectionService = new ReconnectionService();
module.exports = reconnectionService;