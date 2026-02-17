const { v4: uuidv4 } = require('uuid');
const logger = require('../loaders/logger');
const presenceService = require('./PresenceService');
const config = require('../config/env');

/**
 * MatchmakingService
 * Owns: text/video queues, active matches, scoring, grace period logic.
 * Extracted fully from server.js monolith.
 */
class MatchmakingService {
  constructor() {
    this._textQueue = [];
    this._videoQueue = [];
    // roomId -> ActiveMatch
    this._activeMatches = new Map();
    // sessionId -> graceTimer
    this._graceTimers = new Map();

    this.GRACE_PERIOD_MS = config.GRACE_PERIOD_MS;
    this.STARVATION_WAIT_MS = 30000; // bonus score after waiting 30s
  }

  // ─── PUBLIC API ───────────────────────────────────────────────

  /**
   * Add user to the correct queue and try to match immediately.
   * Returns { matched: bool, match: ActiveMatch | null, position: number }
   */
  joinQueue(queueUser) {
    const queue = this._getQueue(queueUser.mode);

    // Remove any stale entry for this socket first (idempotent)
    this._removeFromQueue(queueUser.socketId, queue);

    const bestMatch = this._findBestMatch(queueUser, queue);

    if (bestMatch) {
      const match = this._createMatch(queueUser, bestMatch);
      if (match) {
        return { matched: true, match, position: 0 };
      }
    }

    // No match — add to queue
    queue.push(queueUser);
    logger.info('User added to queue', {
      socketId: queueUser.socketId,
      mode: queueUser.mode,
      position: queue.length
    });

    return { matched: false, match: null, position: queue.length };
  }

  /**
   * Remove user from all queues (leave queue / disconnect)
   */
  removeFromQueues(socketId) {
    const removedText = this._removeFromQueue(socketId, this._textQueue);
    const removedVideo = this._removeFromQueue(socketId, this._videoQueue);
    return removedText || removedVideo;
  }

  /**
   * Get active match for a room
   */
  getMatch(roomId) {
    return this._activeMatches.get(roomId) || null;
  }

  /**
   * Get partner socketId from a match
   */
  getPartnerSocketId(roomId, mySocketId) {
    const match = this._activeMatches.get(roomId);
    if (!match) return null;
    return match.user1SocketId === mySocketId
      ? match.user2SocketId
      : match.user1SocketId;
  }

  /**
   * Handle disconnect — start grace period before cleaning up
   * Partner is NOT notified during the grace window
   */
  handleGracePeriod(roomId, disconnectedSocketId, onExpired) {
    const match = this._activeMatches.get(roomId);
    if (!match) return;

    const user = presenceService.getUser(disconnectedSocketId);
    const sessionId = user?.sessionId;

    match.state = 'GRACE';
    match.graceStartedAt = new Date();
    this._activeMatches.set(roomId, match);

    logger.info('Grace period started', { roomId, disconnectedSocketId, sessionId });

    const timer = setTimeout(() => {
      logger.info('Grace period expired', { roomId, sessionId });
      this._graceTimers.delete(sessionId);
      this.cleanupMatch(roomId);
      if (onExpired) onExpired(roomId, match);
    }, this.GRACE_PERIOD_MS);

    if (sessionId) {
      this._graceTimers.set(sessionId, timer);
    }
  }

  /**
   * Attempt to restore a match after reconnection.
   * Returns the restored ActiveMatch or null if not found / expired.
   */
  restoreMatch(sessionId, newSocketId) {
    // Cancel grace timer first
    this._cancelGraceTimer(sessionId);

    // Find the match this session was in
    const match = this._findMatchBySession(sessionId);
    if (!match) {
      logger.warn('restoreMatch: no match found for session', { sessionId });
      return null;
    }

    // Remap the socket in the match
    const oldSocketId = presenceService.getSocketIdBySession(sessionId);
    if (match.user1SocketId === oldSocketId) {
      match.user1SocketId = newSocketId;
    } else {
      match.user2SocketId = newSocketId;
    }

    match.state = 'CHATTING';
    this._activeMatches.set(match.roomId, match);

    logger.info('Match restored after reconnection', {
      sessionId,
      newSocketId,
      roomId: match.roomId
    });

    return match;
  }

  /**
   * Fully remove match and update presence state for both users
   */
  cleanupMatch(roomId) {
    const match = this._activeMatches.get(roomId);
    if (!match) return;

    [match.user1SocketId, match.user2SocketId].forEach((sid) => {
      presenceService.updateUser(sid, {
        isMatched: false,
        currentMatch: null,
        roomId: null,
        inQueue: false,
        matchState: 'idle'
      });
    });

    this._activeMatches.delete(roomId);
    logger.info('Match cleaned up', { roomId });
  }

  /**
   * Check if a session is currently in grace period
   */
  isInGrace(sessionId) {
    return this._graceTimers.has(sessionId);
  }

  /**
   * Remove stale queue entries — called by cleanup interval
   */
  cleanStaleEntries(liveSocketIds) {
    const liveSet = new Set(liveSocketIds);
    const before = this._textQueue.length + this._videoQueue.length;

    this._textQueue = this._textQueue.filter(u => liveSet.has(u.socketId));
    this._videoQueue = this._videoQueue.filter(u => liveSet.has(u.socketId));

    const removed = before - (this._textQueue.length + this._videoQueue.length);
    if (removed > 0) {
      logger.info('Stale queue entries cleaned', { removed });
    }
  }

  /**
   * Queue and match stats
   */
  getQueueStats() {
    return {
      textQueue: this._textQueue.length,
      videoQueue: this._videoQueue.length,
      activeMatches: this._activeMatches.size,
      graceTimers: this._graceTimers.size
    };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────

  _getQueue(mode) {
    return mode === 'video' ? this._videoQueue : this._textQueue;
  }

  _removeFromQueue(socketId, queue) {
    const idx = queue.findIndex(u => u.socketId === socketId);
    if (idx !== -1) {
      queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Score-based best match selection.
   * score = (commonInterests × 10) + waitBonus(3 if waited > 30s)
   * Tie-break: longest wait time wins (prevents starvation)
   */
  _findBestMatch(user, queue) {
    if (queue.length === 0) return null;

    let best = null;
    let bestScore = -1;
    let bestIndex = -1;

    queue.forEach((candidate, i) => {
      if (candidate.socketId === user.socketId) return;

      const score = this._calculateScore(user, candidate);
      const isBetter =
        score > bestScore ||
        (score === bestScore && best && candidate.joinedQueueAt < best.joinedQueueAt);

      if (isBetter) {
        best = candidate;
        bestScore = score;
        bestIndex = i;
      }
    });

    if (best) {
      queue.splice(bestIndex, 1); // remove from queue before returning
    }

    return best;
  }

  _calculateScore(u1, u2) {
    const common = this._findCommonInterests(u1.interests, u2.interests);
    let score = common.length * 10;

    // Starvation guard — reward long waits
    const waitMs = Date.now() - new Date(u2.joinedQueueAt).getTime();
    if (waitMs > this.STARVATION_WAIT_MS) {
      score += 3;
    }

    return score;
  }

  _findCommonInterests(a = [], b = []) {
    const setB = new Set(b.map(i => i.toLowerCase()));
    return a.filter(i => setB.has(i.toLowerCase()));
  }

  _createMatch(user1, user2) {
    const roomId = `room_${uuidv4()}`;
    const commonInterests = this._findCommonInterests(user1.interests, user2.interests);

    const match = {
      roomId,
      user1SocketId: user1.socketId,
      user2SocketId: user2.socketId,
      createdAt: new Date(),
      mode: user1.mode,
      commonInterests,
      state: 'MATCHED'
    };

    this._activeMatches.set(roomId, match);

    // Update presence for both users
    presenceService.updateUser(user1.socketId, {
      isMatched: true,
      currentMatch: user2.socketId,
      roomId,
      inQueue: false,
      matchState: 'MATCHED'
    });

    presenceService.updateUser(user2.socketId, {
      isMatched: true,
      currentMatch: user1.socketId,
      roomId,
      inQueue: false,
      matchState: 'MATCHED'
    });

    logger.info('Match created', {
      roomId,
      user1: user1.socketId,
      user2: user2.socketId,
      commonInterests,
      mode: user1.mode
    });

    return match;
  }

  _cancelGraceTimer(sessionId) {
    const timer = this._graceTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this._graceTimers.delete(sessionId);
      logger.info('Grace timer cancelled', { sessionId });
    }
  }

  _findMatchBySession(sessionId) {
    const socketId = presenceService.getSocketIdBySession(sessionId);
    if (!socketId) return null;

    for (const match of this._activeMatches.values()) {
      if (
        match.user1SocketId === socketId ||
        match.user2SocketId === socketId ||
        match.state === 'GRACE'
      ) {
        return match;
      }
    }
    return null;
  }
}

// Singleton
const matchmakingService = new MatchmakingService();
module.exports = matchmakingService;