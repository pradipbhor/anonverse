const logger = require('../loaders/logger');
const presenceService = require('../services/PresenceService');
const matchmakingService = require('../services/MatchmakingService');
const chatService = require('../services/ChatService');
const moderationService = require('../services/ModerationService');

/**
 * ChatHandler
 * Owns: send-message, get-messages, typing, stop-typing,
 *       mark-messages-read, report-user, disconnect-chat
 *
 * Moderation is applied in send-message BEFORE saving or delivering.
 */
function register(socket, io) {

  // ─── SEND MESSAGE ──────────────────────────────────────────
  socket.on('send-message', async (data) => {
    try {
      const user = presenceService.getUser(socket.id);
      if (!_isInMatch(user, socket)) return;

      const { content, type = 'text' } = data || {};
      if (!content?.trim()) {
        socket.emit('message-error', { error: 'Message content is required' });
        return;
      }

      // ── MODERATION CHECK (before save or delivery) ──────────
      const modResult = await moderationService.checkMessage(content, socket.id);

      if (!modResult.allowed) {
        logger.warn('Message blocked by moderation', {
          socketId: socket.id,
          layer: modResult.layer,
          categories: modResult.categories,
          action: modResult.action
        });

        // Always tell sender their message was blocked
        socket.emit('message-blocked', {
          reason: modResult.reason,
          categories: modResult.categories,
          action: modResult.action
        });

        // Escalated actions based on repeat offenses
        if (modResult.action === 'warn') {
          socket.emit('moderation-warning', {
            message: 'You have sent multiple messages that violate our guidelines. Further violations may result in removal.',
            flagCount: moderationService.getFlagCount(socket.id)
          });
        }

        if (modResult.action === 'kick') {
          logger.warn('Kicking user for repeated moderation violations', {
            socketId: socket.id
          });
          socket.emit('moderation-kick', {
            message: 'You have been removed for repeatedly violating community guidelines.'
          });
          // Small delay so the client receives the event before disconnect
          setTimeout(() => socket.disconnect(true), 500);
        }

        return; // Message is NEVER saved or delivered
      }

      // ── SAVE AND DELIVER (only reaches here if allowed) ──────
      const saved = await chatService.sendMessage({
        roomId: user.roomId,
        senderId: socket.id,
        recipientId: user.currentMatch,
        content,
        type,
        metadata: { interests: user.interests, mode: user.mode }
      });

      socket.to(user.roomId).emit('message-received', saved);
      socket.emit('message-sent', saved);

    } catch (err) {
      logger.error('Error in send-message', { error: err.message });
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });

  // ─── GET MESSAGE HISTORY ───────────────────────────────────
  socket.on('get-messages', async (data) => {
    try {
      const user = presenceService.getUser(socket.id);
      if (!user?.roomId) {
        socket.emit('messages-error', { error: 'No active chat session' });
        return;
      }

      const messages = await chatService.getRoomMessages(user.roomId, {
        limit: data?.limit || 50,
        skip: data?.skip || 0
      });

      socket.emit('messages-loaded', { messages, roomId: user.roomId });
    } catch (err) {
      logger.error('Error in get-messages', { error: err.message });
      socket.emit('messages-error', { error: 'Failed to load messages' });
    }
  });

  // ─── TYPING INDICATORS ─────────────────────────────────────
  socket.on('typing', async () => {
    const user = presenceService.getUser(socket.id);
    if (!user?.isMatched || !user.roomId) return;
    await chatService.setTypingIndicator(user.roomId, socket.id, true).catch(() => {});
    socket.to(user.roomId).emit('partner-typing', true);
  });

  socket.on('stop-typing', async () => {
    const user = presenceService.getUser(socket.id);
    if (!user?.isMatched || !user.roomId) return;
    await chatService.setTypingIndicator(user.roomId, socket.id, false).catch(() => {});
    socket.to(user.roomId).emit('partner-typing', false);
  });

  // ─── MARK MESSAGES READ ────────────────────────────────────
  socket.on('mark-messages-read', async () => {
    try {
      const user = presenceService.getUser(socket.id);
      if (!user?.roomId) return;

      const count = await chatService.markRoomMessagesAsRead(user.roomId, socket.id);
      socket.emit('messages-marked-read', { count, roomId: user.roomId });
      socket.to(user.roomId).emit('messages-read-by-partner', { readBy: socket.id, count });
    } catch (err) {
      logger.error('Error in mark-messages-read', { error: err.message });
    }
  });

  // ─── REPORT USER ───────────────────────────────────────────
  socket.on('report-user', (data) => {
    logger.warn('User reported', {
      reportedBy: socket.id,
      reportedUser: data?.reportedUserId,
      reason: data?.reason
    });
    // Reset flag count on the reported user as well — fresh slate with human review
    socket.emit('report-submitted', {
      success: true,
      reportId: `report_${Date.now()}`,
      message: 'Thank you for your report. We will review it shortly.'
    });
  });

  // ─── DISCONNECT CHAT (voluntary) ───────────────────────────
  socket.on('disconnect-chat', async () => {
    try {
      const user = presenceService.getUser(socket.id);
      if (!user?.isMatched || !user.roomId) return;

      socket.to(user.roomId).emit('partner-disconnected', {
        reason: 'left',
        message: 'Your partner has ended the chat.'
      });

      socket.leave(user.roomId);
      await chatService.scheduleRoomDeletion(user.roomId).catch(() => {});
      matchmakingService.cleanupMatch(user.roomId);

      // Clear their flag count on clean disconnect
      moderationService.resetFlagCount(socket.id);
    } catch (err) {
      logger.error('Error in disconnect-chat', { error: err.message });
    }
  });
}

// ─── PRIVATE ─────────────────────────────────────────────────

function _isInMatch(user, socket) {
  if (!user || !user.isMatched || !user.roomId) {
    socket.emit('message-error', { error: 'Not in an active chat session' });
    return false;
  }
  return true;
}

module.exports = { register };