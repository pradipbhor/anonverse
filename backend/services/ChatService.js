const Message = require('../models/Message');
const logger = require('../loaders/logger');
const config = require('../config/env');

class ChatService {
  constructor() {
    this._redis = null;
    this.CACHE_TTL = config.CACHE_TTL;
    this.MSG_KEY = 'room:messages:';
    this.TYPING_KEY = 'typing:';
    this.TYPING_TTL = 10;
  }

  /**
   * Inject redis client after connection is established
   */
  setRedis(redisClient) {
    this._redis = redisClient;
  }

  // ─── MESSAGES ────────────────────────────────────────────────

  async sendMessage({ roomId, senderId, recipientId, content, type = 'text', metadata = {} }) {
    if (!roomId || !senderId || !recipientId || !content) {
      throw new Error('Missing required message fields');
    }

    const msg = new Message({
      roomId,
      senderId,
      recipientId,
      content: content.trim(),
      type,
      metadata,
      status: 'sent'
    });

    const saved = await msg.save();
    logger.info('Message saved', { messageId: saved._id, roomId });

    if (this._isRedisReady()) {
      await this._cacheMessage(roomId, saved).catch(() => {});
    }

    return this._format(saved);
  }

  async getRoomMessages(roomId, { limit = 50, skip = 0, useCache = true } = {}) {
    if (useCache && this._isRedisReady()) {
      const cached = await this._getCached(roomId).catch(() => null);
      if (cached?.length) {
        return cached.slice(skip, skip + limit);
      }
    }

    const msgs = await Message.getRoomMessages(roomId, limit, skip);

    if (this._isRedisReady() && msgs.length) {
      await this._cacheAll(roomId, msgs).catch(() => {});
    }

    return msgs.map(m => this._format(m));
  }

  async markRoomMessagesAsRead(roomId, recipientId) {
    const result = await Message.updateMany(
      { roomId, recipientId, status: { $in: ['sent', 'delivered'] } },
      { $set: { status: 'read' } }
    );

    if (this._isRedisReady()) {
      await this._clearCache(roomId).catch(() => {});
    }

    return result.modifiedCount;
  }

  async scheduleRoomDeletion(roomId, hours = config.MESSAGE_EXPIRY_HOURS) {
    const result = await Message.scheduleRoomDeletion(roomId, hours);

    if (this._isRedisReady()) {
      await this._clearCache(roomId).catch(() => {});
    }

    logger.info('Room deletion scheduled', { roomId, hours });
    return result;
  }

  async deleteRoomMessages(roomId) {
    const result = await Message.deleteRoomMessages(roomId);

    if (this._isRedisReady()) {
      await this._clearCache(roomId).catch(() => {});
    }

    logger.info('Room messages deleted', { roomId, count: result.deletedCount });
    return result;
  }

  async getUnreadCount(recipientId, roomId) {
    return Message.getUnreadCount(recipientId, roomId);
  }

  // ─── TYPING ──────────────────────────────────────────────────

  async setTypingIndicator(roomId, userId, isTyping = true) {
    if (!this._isRedisReady()) return false;
    const key = `${this.TYPING_KEY}${roomId}:${userId}`;
    if (isTyping) {
      await this._redis.setEx(key, this.TYPING_TTL, '1');
    } else {
      await this._redis.del(key);
    }
    return true;
  }

  async getTypingUsers(roomId) {
    if (!this._isRedisReady()) return [];
    const keys = await this._redis.keys(`${this.TYPING_KEY}${roomId}:*`);
    return keys.map(k => k.split(':').pop());
  }

  // ─── STATS ───────────────────────────────────────────────────

  async getStats() {
    return {
      totalMessages: await Message.countDocuments(),
      todayMessages: await Message.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      cacheEnabled: this._isRedisReady()
    };
  }

  // ─── PRIVATE ─────────────────────────────────────────────────

  _isRedisReady() {
    return this._redis && this._redis.isReady;
  }

  _format(msg) {
    if (!msg) return null;
    return {
      id: msg._id || msg.id,
      roomId: msg.roomId,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      content: msg.content,
      type: msg.type,
      status: msg.status,
      metadata: msg.metadata,
      createdAt: msg.createdAt,
      timestamp: msg.createdAt
    };
  }

  async _cacheMessage(roomId, msg) {
    const key = `${this.MSG_KEY}${roomId}`;
    await this._redis.lPush(key, JSON.stringify(this._format(msg)));
    await this._redis.lTrim(key, 0, 99);
    await this._redis.expire(key, this.CACHE_TTL);
  }

  async _cacheAll(roomId, msgs) {
    const key = `${this.MSG_KEY}${roomId}`;
    await this._redis.del(key);
    const strs = msgs.map(m => JSON.stringify(this._format(m))).reverse();
    await this._redis.rPush(key, ...strs);
    await this._redis.expire(key, this.CACHE_TTL);
  }

  async _getCached(roomId) {
    const key = `${this.MSG_KEY}${roomId}`;
    const items = await this._redis.lRange(key, 0, -1);
    if (!items?.length) return null;
    await this._redis.expire(key, this.CACHE_TTL);
    return items.map(i => JSON.parse(i));
  }

  async _clearCache(roomId) {
    if (!this._isRedisReady()) return;
    await this._redis.del(`${this.MSG_KEY}${roomId}`);
    const typingKeys = await this._redis.keys(`${this.TYPING_KEY}${roomId}:*`);
    if (typingKeys.length) await this._redis.del(...typingKeys);
  }
}

// Singleton
const chatService = new ChatService();
module.exports = chatService;