const logger = require('../utils/logger');

class MatchingService {
  constructor() {
    this.QUEUE_KEY = 'matching_queue';
    this.USER_KEY_PREFIX = 'user:';
    this.MATCH_TIMEOUT = 30000; // 30 seconds timeout for matching
  }

  /**
   * Add user to matching queue
   */
  async addToQueue(userInfo, redisClient) {
    try {
      const queueData = {
        socketId: userInfo.socketId,
        sessionId: userInfo.sessionId,
        interests: userInfo.interests || [],
        mode: userInfo.mode || 'text',
        joinedAt: Date.now(),
        region: userInfo.region || 'global'
      };

      // Store user data in Redis with expiration
      await redisClient.setEx(
        `${this.USER_KEY_PREFIX}${userInfo.socketId}`,
        300, // 5 minutes expiration
        JSON.stringify(queueData)
      );

      // Add to sorted set queue (sorted by join time)
      await redisClient.zAdd(this.QUEUE_KEY, {
        score: Date.now(),
        value: userInfo.socketId
      });

      logger.info(`User ${userInfo.socketId} added to matching queue`);
      return true;
    } catch (error) {
      logger.error('Error adding user to queue:', error);
      throw error;
    }
  }

  /**
   * Remove user from matching queue
   */
  async removeFromQueue(socketId, redisClient) {
    try {
      // Remove from queue
      await redisClient.zRem(this.QUEUE_KEY, socketId);
      
      // Remove user data
      await redisClient.del(`${this.USER_KEY_PREFIX}${socketId}`);
      
      logger.info(`User ${socketId} removed from matching queue`);
      return true;
    } catch (error) {
      logger.error('Error removing user from queue:', error);
      throw error;
    }
  }

  /**
   * Find a match for the user
   */
  async findMatch(userInfo, redisClient) {
    try {
      // Get all users in queue (excluding current user)
      const queueMembers = await redisClient.zRange(this.QUEUE_KEY, 0, -1);
      const candidateIds = queueMembers.filter(id => id !== userInfo.socketId);

      if (candidateIds.length === 0) {
        return null; // No other users in queue
      }

      // Get candidate user data
      const candidates = [];
      for (const candidateId of candidateIds) {
        try {
          const userData = await redisClient.get(`${this.USER_KEY_PREFIX}${candidateId}`);
          if (userData) {
            candidates.push(JSON.parse(userData));
          }
        } catch (err) {
          // Skip invalid user data
          logger.warn(`Invalid user data for ${candidateId}:`, err);
        }
      }

      if (candidates.length === 0) {
        return null;
      }

      // Find best match using scoring algorithm
      const bestMatch = this.findBestMatch(userInfo, candidates);
      
      if (bestMatch) {
        // Remove both users from queue
        await this.removeFromQueue(userInfo.socketId, redisClient);
        await this.removeFromQueue(bestMatch.socketId, redisClient);
        
        logger.info(`Match found: ${userInfo.socketId} <-> ${bestMatch.socketId}`);
        return bestMatch;
      }

      return null;
    } catch (error) {
      logger.error('Error finding match:', error);
      throw error;
    }
  }

  /**
   * Find best match using scoring algorithm
   */
  findBestMatch(user, candidates) {
    let bestMatch = null;
    let bestScore = -1;

    for (const candidate of candidates) {
      // Skip if different chat modes (unless both support both)
      if (user.mode !== candidate.mode) {
        continue;
      }

      let score = 0;
      
      // Base score for being available
      score += 10;
      
      // Interest matching bonus
      const commonInterests = this.findCommonInterests(user.interests, candidate.interests);
      if (commonInterests.length > 0) {
        score += commonInterests.length * 20; // 20 points per common interest
        
        // Bonus for high interest overlap percentage
        const userInterestCount = user.interests.length || 1;
        const candidateInterestCount = candidate.interests.length || 1;
        const overlapPercentage = commonInterests.length / Math.max(userInterestCount, candidateInterestCount);
        score += overlapPercentage * 15;
      }
      
      // Random factor to prevent always matching same users
      score += Math.random() * 5;
      
      // Prefer users who have been waiting longer (fairness)
      const waitTime = Date.now() - candidate.joinedAt;
      if (waitTime > 10000) { // 10 seconds
        score += Math.min(waitTime / 1000, 10); // Max 10 bonus points
      }
      
      // Regional matching bonus (if implemented)
      if (user.region === candidate.region) {
        score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    return bestMatch;
  }

  /**
   * Find common interests between two users
   */
  findCommonInterests(interests1, interests2) {
    if (!interests1 || !interests2) return [];
    
    const set1 = new Set(interests1.map(i => i.toLowerCase().trim()));
    const set2 = new Set(interests2.map(i => i.toLowerCase().trim()));
    
    return [...set1].filter(interest => set2.has(interest));
  }

  /**
   * Get user's position in queue
   */
  async getQueuePosition(userInfo, redisClient) {
    try {
      const rank = await redisClient.zRank(this.QUEUE_KEY, userInfo.socketId);
      return rank !== null ? rank + 1 : null;
    } catch (error) {
      logger.error('Error getting queue position:', error);
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(redisClient) {
    try {
      const totalUsers = await redisClient.zCard(this.QUEUE_KEY);
      const queueMembers = await redisClient.zRange(this.QUEUE_KEY, 0, -1, { withScores: true });
      
      let modeStats = { text: 0, video: 0 };
      let avgWaitTime = 0;
      let totalWaitTime = 0;
      
      for (let i = 0; i < queueMembers.length; i += 2) {
        const socketId = queueMembers[i];
        const joinTime = queueMembers[i + 1];
        
        try {
          const userData = await redisClient.get(`${this.USER_KEY_PREFIX}${socketId}`);
          if (userData) {
            const user = JSON.parse(userData);
            modeStats[user.mode] = (modeStats[user.mode] || 0) + 1;
            totalWaitTime += Date.now() - joinTime;
          }
        } catch (err) {
          // Skip invalid data
        }
      }
      
      if (totalUsers > 0) {
        avgWaitTime = totalWaitTime / totalUsers;
      }

      return {
        totalUsers,
        modeStats,
        avgWaitTime: Math.round(avgWaitTime / 1000), // Convert to seconds
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return {
        totalUsers: 0,
        modeStats: { text: 0, video: 0 },
        avgWaitTime: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clean up expired users from queue
   */
  async cleanupExpiredUsers(redisClient) {
    try {
      const cutoffTime = Date.now() - 300000; // 5 minutes ago
      const expiredUsers = await redisClient.zRangeByScore(this.QUEUE_KEY, 0, cutoffTime);
      
      if (expiredUsers.length > 0) {
        // Remove expired users from queue
        await redisClient.zRemRangeByScore(this.QUEUE_KEY, 0, cutoffTime);
        
        // Clean up user data
        for (const userId of expiredUsers) {
          await redisClient.del(`${this.USER_KEY_PREFIX}${userId}`);
        }
        
        logger.info(`Cleaned up ${expiredUsers.length} expired users from queue`);
      }
      
      return expiredUsers.length;
    } catch (error) {
      logger.error('Error cleaning up expired users:', error);
      return 0;
    }
  }

  /**
   * Get popular interests for suggestions
   */
  async getPopularInterests(redisClient) {
    try {
      const POPULAR_INTERESTS_KEY = 'popular_interests';
      const interests = await redisClient.zRevRange(POPULAR_INTERESTS_KEY, 0, 19); // Top 20
      
      // Default interests if none found
      if (interests.length === 0) {
        return [
          'music', 'movies', 'gaming', 'technology', 'sports', 'art', 'books',
          'travel', 'food', 'photography', 'science', 'nature', 'fitness',
          'anime', 'programming', 'fashion', 'cooking', 'dancing', 'writing', 'memes'
        ];
      }
      
      return interests;
    } catch (error) {
      logger.error('Error getting popular interests:', error);
      return ['music', 'movies', 'gaming', 'technology', 'sports'];
    }
  }

  /**
   * Update interest popularity
   */
  async updateInterestPopularity(interests, redisClient) {
    try {
      if (!interests || interests.length === 0) return;
      
      const POPULAR_INTERESTS_KEY = 'popular_interests';
      
      for (const interest of interests) {
        const normalizedInterest = interest.toLowerCase().trim();
        await redisClient.zIncrBy(POPULAR_INTERESTS_KEY, 1, normalizedInterest);
      }
    } catch (error) {
      logger.error('Error updating interest popularity:', error);
    }
  }
}

module.exports = new MatchingService();