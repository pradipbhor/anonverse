const moderationService = require('../services/moderationService');
const logger = require('../utils/logger');
const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

class ModerationController {
  async checkContent(req, res) {
    try {
      const { content } = req.body;
      const userId = req.headers['x-session-id'] || req.ip;

      // Check if user is banned
      const isBanned = await moderationService.isUserBanned(userId, redisClient);
      if (isBanned) {
        return res.status(403).json({ 
          error: 'User is banned',
          banned: true 
        });
      }

      // Moderate content
      const result = await moderationService.moderateContent(content);

      // Log flagged content
      if (result.flagged) {
        logger.warn(`Content flagged for user ${userId}:`, {
          content: content.substring(0, 100) + '...',
          categories: result.categories,
          scores: result.scores
        });

        // Increment violation count
        await this.incrementViolationCount(userId, redisClient);
      }

      res.status(200).json({
        success: true,
        flagged: result.flagged,
        categories: result.categories,
        confidence: this.calculateConfidence(result.scores),
        action: result.flagged ? 'blocked' : 'approved'
      });

    } catch (error) {
      logger.error('Error checking content:', error);
      res.status(500).json({ error: 'Failed to check content' });
    }
  }

  async reportUser(req, res) {
    try {
      const { userId, reason, evidence } = req.body;
      const reporterId = req.headers['x-session-id'] || req.ip;

      // Prevent self-reporting
      if (reporterId === userId) {
        return res.status(400).json({ error: 'Cannot report yourself' });
      }

      // Check report rate limiting
      const reportLimitKey = `report_limit:${reporterId}`;
      const reportCount = await redisClient.incr(reportLimitKey);
      
      if (reportCount === 1) {
        await redisClient.expire(reportLimitKey, 3600); // 1 hour
      }
      
      if (reportCount > 10) {
        return res.status(429).json({ 
          error: 'Report limit exceeded. Please try again later.' 
        });
      }

      const reportData = {
        reportedUserId: userId,
        reporterId,
        reason,
        evidence: evidence || '',
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      };

      // Submit report
      const success = await moderationService.reportUser(reportData, redisClient);

      if (success) {
        // Update moderation statistics
        await this.updateModerationStats('report', reason, redisClient);

        logger.info(`User report: ${userId} reported by ${reporterId} for ${reason}`);

        res.status(200).json({
          success: true,
          message: 'Report submitted successfully',
          reportId: `report_${Date.now()}_${reporterId.substring(0, 8)}`
        });
      } else {
        res.status(500).json({ error: 'Failed to submit report' });
      }

    } catch (error) {
      logger.error('Error reporting user:', error);
      res.status(500).json({ error: 'Failed to submit report' });
    }
  }

  async checkBanStatus(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const isBanned = await moderationService.isUserBanned(userId, redisClient);
      const banDetails = await this.getBanDetails(userId, redisClient);

      res.status(200).json({
        success: true,
        banned: isBanned,
        banDetails: isBanned ? banDetails : null
      });

    } catch (error) {
      logger.error('Error checking ban status:', error);
      res.status(500).json({ error: 'Failed to check ban status' });
    }
  }

  async getModerationStats(req, res) {
    try {
      const stats = await this.compileModerationStats(redisClient);
      
      res.status(200).json({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting moderation stats:', error);
      res.status(500).json({ error: 'Failed to get moderation statistics' });
    }
  }

  async banUser(req, res) {
    try {
      const { userId, duration, reason } = req.body;
      const moderatorId = req.headers['x-moderator-id'];

      if (!moderatorId) {
        return res.status(401).json({ error: 'Moderator authentication required' });
      }

      const banData = {
        userId,
        moderatorId,
        reason,
        duration: duration || 86400, // Default 24 hours
        timestamp: new Date().toISOString()
      };

      await moderationService.banUser(userId, redisClient, banData);
      await this.updateModerationStats('ban', reason, redisClient);

      logger.info(`User banned: ${userId} by ${moderatorId} for ${reason}`);

      res.status(200).json({
        success: true,
        message: 'User banned successfully',
        banId: `ban_${Date.now()}_${userId}`
      });

    } catch (error) {
      logger.error('Error banning user:', error);
      res.status(500).json({ error: 'Failed to ban user' });
    }
  }

  async unbanUser(req, res) {
    try {
      const { userId } = req.body;
      const moderatorId = req.headers['x-moderator-id'];

      if (!moderatorId) {
        return res.status(401).json({ error: 'Moderator authentication required' });
      }

      await redisClient.del(`banned:${userId}`);
      await this.updateModerationStats('unban', 'manual', redisClient);

      logger.info(`User unbanned: ${userId} by ${moderatorId}`);

      res.status(200).json({
        success: true,
        message: 'User unbanned successfully'
      });

    } catch (error) {
      logger.error('Error unbanning user:', error);
      res.status(500).json({ error: 'Failed to unban user' });
    }
  }

  // Helper methods
  calculateConfidence(scores) {
    if (!scores || typeof scores !== 'object') return 0;
    
    const maxScore = Math.max(...Object.values(scores));
    return Math.round(maxScore * 100);
  }

  async incrementViolationCount(userId, redisClient) {
    try {
      const violationKey = `violations:${userId}`;
      const count = await redisClient.incr(violationKey);
      await redisClient.expire(violationKey, 86400); // 24 hours

      // Auto-ban after 5 violations
      if (count >= 5) {
        await moderationService.banUser(userId, redisClient, {
          reason: 'Multiple violations',
          duration: 86400,
          automatic: true
        });
        logger.warn(`User auto-banned for violations: ${userId}`);
      }

      return count;
    } catch (error) {
      logger.error('Error incrementing violation count:', error);
    }
  }

  async getBanDetails(userId, redisClient) {
    try {
      const banKey = `banned:${userId}`;
      const banData = await redisClient.get(banKey);
      
      if (banData && banData !== 'banned') {
        return JSON.parse(banData);
      }
      
      return banData ? { banned: true } : null;
    } catch (error) {
      logger.error('Error getting ban details:', error);
      return null;
    }
  }

  async updateModerationStats(action, reason, redisClient) {
    try {
      const today = new Date().toISOString().split('T')[0];
      await redisClient.incr(`moderation:${action}:${today}`);
      await redisClient.incr(`moderation:${action}:${reason}:${today}`);
      await redisClient.incr(`moderation:${action}:total`);
    } catch (error) {
      logger.error('Error updating moderation stats:', error);
    }
  }

  async compileModerationStats(redisClient) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const stats = {
        today: {
          reports: await redisClient.get(`moderation:report:${today}`) || 0,
          bans: await redisClient.get(`moderation:ban:${today}`) || 0,
          flaggedContent: await redisClient.get(`moderation:flag:${today}`) || 0
        },
        yesterday: {
          reports: await redisClient.get(`moderation:report:${yesterday}`) || 0,
          bans: await redisClient.get(`moderation:ban:${yesterday}`) || 0,
          flaggedContent: await redisClient.get(`moderation:flag:${yesterday}`) || 0
        },
        total: {
          reports: await redisClient.get('moderation:report:total') || 0,
          bans: await redisClient.get('moderation:ban:total') || 0,
          flaggedContent: await redisClient.get('moderation:flag:total') || 0
        },
        activeBans: await this.getActiveBanCount(redisClient),
        topReportReasons: await this.getTopReportReasons(redisClient)
      };

      return stats;
    } catch (error) {
      logger.error('Error compiling moderation stats:', error);
      return {};
    }
  }

  async getActiveBanCount(redisClient) {
    try {
      const keys = await redisClient.keys('banned:*');
      return keys.length;
    } catch (error) {
      logger.error('Error getting active ban count:', error);
      return 0;
    }
  }

  async getTopReportReasons(redisClient) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const reasons = ['inappropriate-content', 'harassment', 'spam', 'underage', 'other'];
      
      const reasonCounts = await Promise.all(
        reasons.map(async (reason) => ({
          reason,
          count: parseInt(await redisClient.get(`moderation:report:${reason}:${today}`) || 0)
        }))
      );

      return reasonCounts
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    } catch (error) {
      logger.error('Error getting top report reasons:', error);
      return [];
    }
  }
}

module.exports = new ModerationController();