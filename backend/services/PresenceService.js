const logger = require('../loaders/logger');

/**
 * PresenceService
 * Single source of truth for all connected users.
 * Owns the connectedUsers map and sessionId -> socketId mapping.
 * Extracted from server.js to follow SRP.
 */
class PresenceService {
  constructor() {
    // socketId -> ConnectedUser
    this._users = new Map();
    // sessionId -> socketId (for reconnection)
    this._sessionToSocket = new Map();
  }

  /**
   * Register a new socket connection
   */
  addUser(socketId, sessionId) {
    const user = {
      socketId,
      sessionId,
      isMatched: false,
      currentMatch: null,
      roomId: null,
      inQueue: false,
      interests: [],
      mode: 'text',
      lastPing: new Date(),
      missedPings: 0,
      matchState: 'idle',
      joinedAt: new Date()
    };

    this._users.set(socketId, user);
    this._sessionToSocket.set(sessionId, socketId);

    logger.info('User added to presence', { socketId, sessionId });
    return user;
  }

  /**
   * Remove user by socketId — called on disconnect
   */
  removeUser(socketId) {
    const user = this._users.get(socketId);
    if (!user) return null;

    this._sessionToSocket.delete(user.sessionId);
    this._users.delete(socketId);

    logger.info('User removed from presence', { socketId });
    return user;
  }

  /**
   * Get user by socketId
   */
  getUser(socketId) {
    return this._users.get(socketId) || null;
  }

  /**
   * Get user by sessionId — used during reconnection
   */
  getUserBySession(sessionId) {
    const socketId = this._sessionToSocket.get(sessionId);
    if (!socketId) return null;
    return this._users.get(socketId) || null;
  }

  /**
   * Partial update of a user's data
   */
  updateUser(socketId, data) {
    const user = this._users.get(socketId);
    if (!user) {
      logger.warn('updateUser: user not found', { socketId });
      return null;
    }
    const updated = { ...user, ...data };
    this._users.set(socketId, updated);
    return updated;
  }

  /**
   * Remap socketId when user reconnects with a new socket
   * Keeps all match/room state intact under the new socketId
   */
  remapSocket(oldSocketId, newSocketId, sessionId) {
    const user = this._users.get(oldSocketId);
    if (!user) {
      logger.warn('remapSocket: old socket not found', { oldSocketId });
      return null;
    }

    const remapped = {
      ...user,
      socketId: newSocketId,
      lastPing: new Date(),
      missedPings: 0
    };

    this._users.delete(oldSocketId);
    this._users.set(newSocketId, remapped);
    this._sessionToSocket.set(sessionId, newSocketId);

    logger.info('Socket remapped for reconnection', { oldSocketId, newSocketId, sessionId });
    return remapped;
  }

  /**
   * Get socketId for a given sessionId
   */
  getSocketIdBySession(sessionId) {
    return this._sessionToSocket.get(sessionId) || null;
  }

  /**
   * Check if sessionId is already tracked (for reconnect detection)
   */
  hasSession(sessionId) {
    return this._sessionToSocket.has(sessionId);
  }

  /**
   * Get all connected users as array
   */
  getAllUsers() {
    return Array.from(this._users.values());
  }

  /**
   * Get all socket IDs currently tracked
   */
  getAllSocketIds() {
    return Array.from(this._users.keys());
  }

  /**
   * Total online user count
   */
  getOnlineCount() {
    return this._users.size;
  }

  /**
   * Update heartbeat timestamp and reset missed pings
   */
  recordPong(socketId) {
    return this.updateUser(socketId, {
      lastPing: new Date(),
      missedPings: 0
    });
  }

  /**
   * Increment missed ping counter
   */
  incrementMissedPings(socketId) {
    const user = this._users.get(socketId);
    if (!user) return null;
    return this.updateUser(socketId, {
      missedPings: (user.missedPings || 0) + 1
    });
  }
}

// Singleton
const presenceService = new PresenceService();
module.exports = presenceService;