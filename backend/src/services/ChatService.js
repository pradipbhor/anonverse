const Message = require('../models/message');
const logger = require('../Loaders/Logger');

class ChatService {
  constructor(redisClient = null) {
    this.redisClient = redisClient;
    this.CACHE_TTL = 3600; // 1 hour cache TTL
    this.ROOM_MESSAGES_CACHE_KEY = 'room:messages:';
    this.TYPING_INDICATOR_KEY = 'typing:';
    this.TYPING_INDICATOR_TTL = 10; // 10 seconds for typing indicator
  }

  /**
   * Send a message and store it in MongoDB and Redis cache
   */
  async sendMessage(messageData) {
    try {
      const { roomId, senderId, recipientId, content, type = 'text', metadata = {} } = messageData;

      // Validate required fields
      if (!roomId || !senderId || !recipientId || !content) {
        throw new Error('Missing required message fields');
      }

      // Create message in MongoDB
      const message = new Message({
        roomId,
        senderId,
        recipientId,
        content: content.trim(),
        type,
        metadata,
        status: 'sent'
      });

      const savedMessage = await message.save();
      logger.info('Message saved to MongoDB', { 
        messageId: savedMessage._id, 
        roomId,
        senderId 
      });

      // Cache in Redis if available
      if (this.redisClient && this.redisClient.isReady) {
        await this.cacheMessage(roomId, savedMessage);
      }

      // Return formatted message
      return this.formatMessage(savedMessage);
    } catch (error) {
      logger.error('Error sending message', { error: error.message, messageData });
      throw error;
    }
  }

  /**
   * Get messages for a room with pagination
   */
  async getRoomMessages(roomId, options = {}) {
    try {
      const { limit = 50, skip = 0, useCache = true } = options;

      // Try to get from Redis cache first
      if (useCache && this.redisClient && this.redisClient.isReady) {
        const cachedMessages = await this.getCachedRoomMessages(roomId);
        if (cachedMessages && cachedMessages.length > 0) {
          logger.info('Messages retrieved from cache', { roomId, count: cachedMessages.length });
          return cachedMessages.slice(skip, skip + limit);
        }
      }

      // Get from MongoDB
      const messages = await Message.getRoomMessages(roomId, limit, skip);
      logger.info('Messages retrieved from MongoDB', { roomId, count: messages.length });

      // Cache the messages
      if (this.redisClient && this.redisClient.isReady && messages.length > 0) {
        await this.cacheRoomMessages(roomId, messages);
      }

      return messages.map(msg => this.formatMessage(msg));
    } catch (error) {
      logger.error('Error getting room messages', { error: error.message, roomId });
      throw error;
    }
  }

  /**
   * Mark message as delivered
   */
  async markMessageDelivered(messageId, recipientId) {
    try {
      const message = await Message.findOne({ 
        _id: messageId, 
        recipientId,
        status: 'sent'
      });

      if (message) {
        await message.markAsDelivered();
        
        // Update cache
        if (this.redisClient && this.redisClient.isReady) {
          await this.updateCachedMessage(message.roomId, message);
        }

        logger.info('Message marked as delivered', { messageId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error marking message as delivered', { error: error.message, messageId });
      return false;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageRead(messageId, recipientId) {
    try {
      const message = await Message.findOne({ 
        _id: messageId, 
        recipientId,
        status: { $in: ['sent', 'delivered'] }
      });

      if (message) {
        await message.markAsRead();
        
        // Update cache
        if (this.redisClient && this.redisClient.isReady) {
          await this.updateCachedMessage(message.roomId, message);
        }

        logger.info('Message marked as read', { messageId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error marking message as read', { error: error.message, messageId });
      return false;
    }
  }

  /**
   * Mark all messages in a room as read
   */
  async markRoomMessagesAsRead(roomId, recipientId) {
    try {
      const result = await Message.updateMany(
        { 
          roomId, 
          recipientId,
          status: { $in: ['sent', 'delivered'] }
        },
        { 
          $set: { status: 'read' }
        }
      );

      // Clear cache to force refresh
      if (this.redisClient && this.redisClient.isReady) {
        await this.clearRoomCache(roomId);
      }

      logger.info('Room messages marked as read', { 
        roomId, 
        recipientId, 
        count: result.modifiedCount 
      });

      return result.modifiedCount;
    } catch (error) {
      logger.error('Error marking room messages as read', { error: error.message, roomId });
      return 0;
    }
  }

  /**
   * Set typing indicator
   */
  async setTypingIndicator(roomId, userId, isTyping = true) {
    try {
      if (!this.redisClient || !this.redisClient.isReady) {
        return false;
      }

      const key = `${this.TYPING_INDICATOR_KEY}${roomId}:${userId}`;
      
      if (isTyping) {
        await this.redisClient.setEx(key, this.TYPING_INDICATOR_TTL, '1');
      } else {
        await this.redisClient.del(key);
      }

      return true;
    } catch (error) {
      logger.error('Error setting typing indicator', { error: error.message, roomId, userId });
      return false;
    }
  }

  /**
   * Get typing indicators for a room
   */
  async getTypingUsers(roomId) {
    try {
      if (!this.redisClient || !this.redisClient.isReady) {
        return [];
      }

      const pattern = `${this.TYPING_INDICATOR_KEY}${roomId}:*`;
      const keys = await this.redisClient.keys(pattern);
      
      const typingUsers = keys.map(key => {
        const parts = key.split(':');
        return parts[parts.length - 1];
      });

      return typingUsers;
    } catch (error) {
      logger.error('Error getting typing users', { error: error.message, roomId });
      return [];
    }
  }

  /**
   * Delete messages for a room after chat ends
   */
  async scheduleRoomDeletion(roomId, hours = 12) {
    try {
      const result = await Message.scheduleRoomDeletion(roomId, hours);
      
      // Clear cache
      if (this.redisClient && this.redisClient.isReady) {
        await this.clearRoomCache(roomId);
      }

      logger.info('Room deletion scheduled', { 
        roomId, 
        hours,
        messagesAffected: result.modifiedCount 
      });

      return result;
    } catch (error) {
      logger.error('Error scheduling room deletion', { error: error.message, roomId });
      throw error;
    }
  }

  /**
   * Immediately delete all messages for a room
   */
  async deleteRoomMessages(roomId) {
    try {
      const result = await Message.deleteRoomMessages(roomId);
      
      // Clear cache
      if (this.redisClient && this.redisClient.isReady) {
        await this.clearRoomCache(roomId);
      }

      logger.info('Room messages deleted', { 
        roomId, 
        deletedCount: result.deletedCount 
      });

      return result;
    } catch (error) {
      logger.error('Error deleting room messages', { error: error.message, roomId });
      throw error;
    }
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(recipientId, roomId) {
    try {
      const count = await Message.getUnreadCount(recipientId, roomId);
      return count;
    } catch (error) {
      logger.error('Error getting unread count', { error: error.message, recipientId, roomId });
      return 0;
    }
  }

  // ============= Redis Cache Helper Methods =============

  /**
   * Cache a message in Redis
   */
  async cacheMessage(roomId, message) {
    try {
      const key = `${this.ROOM_MESSAGES_CACHE_KEY}${roomId}`;
      const messageStr = JSON.stringify(this.formatMessage(message));
      
      // Add to list (newest first)
      await this.redisClient.lPush(key, messageStr);
      
      // Trim to keep only last 100 messages
      await this.redisClient.lTrim(key, 0, 99);
      
      // Set expiry
      await this.redisClient.expire(key, this.CACHE_TTL);
      
      return true;
    } catch (error) {
      logger.error('Error caching message', { error: error.message });
      return false;
    }
  }

  /**
   * Cache multiple messages
   */
  async cacheRoomMessages(roomId, messages) {
    try {
      if (!messages || messages.length === 0) return false;

      const key = `${this.ROOM_MESSAGES_CACHE_KEY}${roomId}`;
      
      // Delete existing cache
      await this.redisClient.del(key);
      
      // Add all messages (newest first)
      const messageStrs = messages.map(msg => JSON.stringify(this.formatMessage(msg)));
      await this.redisClient.rPush(key, ...messageStrs.reverse());
      
      // Set expiry
      await this.redisClient.expire(key, this.CACHE_TTL);
      
      return true;
    } catch (error) {
      logger.error('Error caching room messages', { error: error.message });
      return false;
    }
  }

  /**
   * Get cached messages for a room
   */
  async getCachedRoomMessages(roomId) {
    try {
      const key = `${this.ROOM_MESSAGES_CACHE_KEY}${roomId}`;
      const messages = await this.redisClient.lRange(key, 0, -1);
      
      if (messages && messages.length > 0) {
        // Refresh TTL
        await this.redisClient.expire(key, this.CACHE_TTL);
        return messages.map(msg => JSON.parse(msg));
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting cached messages', { error: error.message });
      return null;
    }
  }

  /**
   * Update a cached message
   */
  async updateCachedMessage(roomId, updatedMessage) {
    try {
      const messages = await this.getCachedRoomMessages(roomId);
      if (!messages) return false;

      const updatedMessages = messages.map(msg => 
        msg.id === updatedMessage._id.toString() 
          ? this.formatMessage(updatedMessage)
          : msg
      );

      return await this.cacheRoomMessages(roomId, updatedMessages);
    } catch (error) {
      logger.error('Error updating cached message', { error: error.message });
      return false;
    }
  }

  /**
   * Clear room cache
   */
  async clearRoomCache(roomId) {
    try {
      if (!this.redisClient || !this.redisClient.isReady) return false;
      
      const key = `${this.ROOM_MESSAGES_CACHE_KEY}${roomId}`;
      await this.redisClient.del(key);
      
      // Also clear typing indicators
      const typingPattern = `${this.TYPING_INDICATOR_KEY}${roomId}:*`;
      const typingKeys = await this.redisClient.keys(typingPattern);
      if (typingKeys.length > 0) {
        await this.redisClient.del(...typingKeys);
      }
      
      return true;
    } catch (error) {
      logger.error('Error clearing room cache', { error: error.message });
      return false;
    }
  }

  /**
   * Format message for client
   */
  formatMessage(message) {
    if (!message) return null;

    return {
      id: message._id || message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content,
      type: message.type,
      status: message.status,
      metadata: message.metadata,
      edited: message.edited,
      editedAt: message.editedAt,
      createdAt: message.createdAt,
      timestamp: message.createdAt
    };
  }

  /**
   * Get service statistics
   */
  async getStats() {
    try {
      const stats = {
        totalMessages: await Message.countDocuments(),
        todayMessages: await Message.countDocuments({
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }),
        cacheEnabled: this.redisClient && this.redisClient.isReady
      };

      return stats;
    } catch (error) {
      logger.error('Error getting chat stats', { error: error.message });
      return null;
    }
  }
}

// Create singleton instance
let chatServiceInstance = null;

function createChatService(redisClient) {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService(redisClient);
  }
  return chatServiceInstance;
}

module.exports = { ChatService, createChatService };