const logger = require('../loaders/logger');
const presenceService = require('./PresenceService');
const config = require('../config/env');

/**
 * HeartbeatService
 * Sends periodic pings to all connected clients.
 * Tracks missed pongs and evicts stale connections.
 *
 * Flow:
 *   Server --ping--> Client (every PING_INTERVAL_MS)
 *   Client --pong--> Server (must arrive within PONG_TIMEOUT_MS)
 *   Missed > MAX_MISSED_PINGS --> socket forcefully disconnected
 */
class HeartbeatService {
  constructor() {
    this._io = null;
    this._interval = null;
    this.PING_INTERVAL_MS = config.PING_INTERVAL_MS;
    this.MAX_MISSED_PINGS = config.MAX_MISSED_PINGS;
  }

  /**
   * Start heartbeat loop — call once after io is ready
   */
  start(io) {
    this._io = io;

    this._interval = setInterval(() => {
      this._pingAll();
    }, this.PING_INTERVAL_MS);

    logger.info('Heartbeat service started', {
      interval: this.PING_INTERVAL_MS,
      maxMissed: this.MAX_MISSED_PINGS
    });
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
      logger.info('Heartbeat service stopped');
    }
  }

  /**
   * Called when a client sends back a pong
   */
  handlePong(socketId) {
    presenceService.recordPong(socketId);
  }

  // ─── PRIVATE ─────────────────────────────────────────────────

  _pingAll() {
    const users = presenceService.getAllUsers();

    users.forEach((user) => {
      const socket = this._io.sockets.sockets.get(user.socketId);
      if (!socket) return;

      // Increment missed first — handlePong will reset if they reply
      presenceService.incrementMissedPings(user.socketId);
      const updated = presenceService.getUser(user.socketId);

      if (updated && updated.missedPings > this.MAX_MISSED_PINGS) {
        logger.warn('Evicting stale socket', {
          socketId: user.socketId,
          missedPings: updated.missedPings
        });
        socket.disconnect(true);
        return;
      }

      socket.emit('ping');
    });
  }
}

// Singleton
const heartbeatService = new HeartbeatService();
module.exports = heartbeatService;