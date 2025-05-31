const matchingService = require('../services/matchingService');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');
const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

class UserController {
  async createSession(req, res) {
    try {
      const { sessionId, interests, mode } = req.body;
      const ip = req.ip;
      const userAgent = req.headers['user-agent'];

      // Create session data
      const sessionData = {
        sessionId,
        interests: interests || [],
        mode: mode || 'text',
        ip,
        userAgent,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };

      // Store session in Redis with expiration
      await redisClient.setEx(
        `session:${sessionId}`,
        3600, // 1 hour
        JSON.stringify(sessionData)
      );

      // Update interest popularity if interests provided
      if (interests && interests.length > 0) {
        await matchingService.updateInterestPopularity(interests, redisClient);
      }

      // Update session statistics
      await this.updateSessionStats(mode, redisClient);

      logger.info(`Session created: ${sessionId} with ${interests?.length || 0} interests`);

      res.status(201).json({
        success: true,
        sessionId,
        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      });

    } catch (error) {
      logger.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }

  async getPopularInterests(req, res) {
    try {
      const interests = await matchingService.getPopularInterests(redisClient);
      
      res.status(200).json({
        success: true,
        interests,
        count: interests.length
      });

    } catch (error) {
      logger.error('Error getting popular interests:', error);
      res.status(500).json({ error: 'Failed to get interests' });
    }
  }

  async updateInterests(req, res) {
    try {
      const { sessionId, interests } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      if (!interests || !Array.isArray(interests) || interests.length > 10) {
        return res.status(400).json({ error: 'Invalid interests array (max 10)' });
      }

      // Get existing session
      const sessionData = await redisClient.get(`session:${sessionId}`);
      if (!sessionData) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const session = JSON.parse(sessionData);
      
      // Update interests
      session.interests = interests;
      session.lastActive = new Date().toISOString();

      // Save updated session
      await redisClient.setEx(
        `session:${sessionId}`,
        3600,
        JSON.stringify(session)
      );

      // Update interest popularity
      await matchingService.updateInterestPopularity(interests, redisClient);

      logger.info(`Interests updated for session: ${sessionId}`);

      res.status(200).json({
        success: true,
        interests,
        updatedAt: session.lastActive
      });

    } catch (error) {
      logger.error('Error updating interests:', error);
      res.status(500).json({ error: 'Failed to update interests' });
    }
  }

  async getOnlineCount(req, res) {
    try {
      const stats = await matchingService.getQueueStats(redisClient);
      const onlineCount = await redisService.getOnlineUserCount(redisClient);

      res.status(200).json({
        success: true,
        onlineUsers: onlineCount,
        queueStats: {
          totalInQueue: stats.totalUsers,
          textUsers: stats.modeStats.text || 0,
          videoUsers: stats.modeStats.video || 0,
          averageWaitTime: stats.avgWaitTime
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting online count:', error);
      res.status(500).json({ error: 'Failed to get online count' });
    }
  }

  async getUserSession(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const sessionData = await redisClient.get(`session:${sessionId}`);
      
      if (!sessionData) {
        return res.status(404).json({ error: 'Session not found or expired' });
      }

      const session = JSON.parse(sessionData);
      
      // Update last active
      session.lastActive = new Date().toISOString();
      await redisClient.setEx(
        `session:${sessionId}`,
        3600,
        JSON.stringify(session)
      );

      // Return session without sensitive data
      const publicSession = {
        sessionId: session.sessionId,
        interests: session.interests,
        mode: session.mode,
        createdAt: session.createdAt,
        lastActive: session.lastActive
      };

      res.status(200).json({
        success: true,
        session: publicSession
      });

    } catch (error) {
      logger.error('Error getting user session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  }

  async extendSession(req, res) {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const sessionData = await redisClient.get(`session:${sessionId}`);
      
      if (!sessionData) {
        return res.status(404).json({ error: 'Session not found or expired' });
      }

      const session = JSON.parse(sessionData);
      session.lastActive = new Date().toISOString();

      // Extend session by 1 hour
      await redisClient.setEx(
        `session:${sessionId}`,
        3600,
        JSON.stringify(session)
      );

      res.status(200).json({
        success: true,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActive: session.lastActive
      });

    } catch (error) {
      logger.error('Error extending session:', error);
      res.status(500).json({ error: 'Failed to extend session' });
    }
  }

  // Helper methods
  async updateSessionStats(mode, redisClient) {
    try {
      const today = new Date().toISOString().split('T')[0];
      await redisClient.incr(`stats:sessions:${today}`);
      await redisClient.incr(`stats:sessions:${mode}:${today}`);
      await redisClient.incr('stats:sessions:total');
    } catch (error) {
      logger.error('Error updating session stats:', error);
    }
  }
}

module.exports = new UserController();