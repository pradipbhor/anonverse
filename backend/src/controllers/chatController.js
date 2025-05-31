const moderationService = require('../services/moderationService');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');
const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

class ChatController {
  async sendMessage(req, res) {
    try {
      const { content, to } = req.body;
      const senderId = req.headers['x-session-id'] || req.ip;

      // Check if user is banned
      const isBanned = await moderationService.isUserBanned(senderId, redisClient);
      if (isBanned) {
        return res.status(403).json({ error: 'User is banned' });
      }

      // Moderate content
      const moderationResult = await moderationService.moderateContent(content);
      
      if (moderationResult.flagged) {
        // Log the flagged content
        logger.warn(`Flagged message from ${senderId}:`, {
          content: content.substring(0, 100),
          categories: moderationResult.categories,
          senderId
        });

        return res.status(400).json({
          error: 'Message blocked by content filter',
          categories: moderationResult.categories
        });
      }

      // Store message for analytics (temporary)
      const messageData = {
        id: Date.now().toString(),
        senderId,
        recipientId: to,
        content,
        timestamp: new Date().toISOString(),
        moderation: moderationResult
      };

      // Store in Redis with short expiration (for debugging/analytics)
      await redisClient.setEx(
        `message:${messageData.id}`,
        300, // 5 minutes
        JSON.stringify(messageData)
      );

      // Update message statistics
      await this.updateMessageStats(redisClient);

      res.status(200).json({
        success: true,
        messageId: messageData.id,
        timestamp: messageData.timestamp
      });

    } catch (error) {
      logger.error('Error in sendMessage:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  async reportUser(req, res) {
    try {
      const { reportedUserId, reason, description } = req.body;
      const reporterId = req.headers['x-session-id'] || req.ip;

      // Prevent self-reporting
      if (reporterId === reportedUserId) {
        return res.status(400).json({ error: 'Cannot report yourself' });
      }

      // Check rate limiting for reports
      const reportKey = `reports:${reporterId}`;
      const reportCount = await redisClient.incr(reportKey);
      
      if (reportCount === 1) {
        await redisClient.expire(reportKey, 3600); // 1 hour
      }
      
      if (reportCount > 5) {
        return res.status(429).json({ error: 'Too many reports. Please try again later.' });
      }

      const reportData = {
        reportedUserId,
        reporterId,
        reason,
        description: description || '',
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      };

      // Submit report
      await moderationService.reportUser(reportData, redisClient);

      // Update report statistics
      await this.updateReportStats(reason, redisClient);

      logger.info(`User report submitted: ${reportedUserId} reported by ${reporterId} for ${reason}`);

      res.status(200).json({
        success: true,
        message: 'Report submitted successfully'
      });

    } catch (error) {
      logger.error('Error in reportUser:', error);
      res.status(500).json({ error: 'Failed to submit report' });
    }
  }

  async getChatStats(req, res) {
    try {
      const stats = await redisService.getChatStatistics(redisClient);
      res.status(200).json(stats);
    } catch (error) {
      logger.error('Error getting chat stats:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  }

  async submitFeedback(req, res) {
    try {
      const { rating, comment, category } = req.body;
      const userId = req.headers['x-session-id'] || req.ip;

      // Validate rating
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      const feedback = {
        userId,
        rating,
        comment: comment || '',
        category: category || 'general',
        timestamp: new Date().toISOString(),
        ip: req.ip
      };

      // Store feedback
      const feedbackKey = `feedback:${Date.now()}:${userId}`;
      await redisClient.setEx(feedbackKey, 86400 * 7, JSON.stringify(feedback)); // 1 week

      // Update feedback statistics
      await this.updateFeedbackStats(rating, category, redisClient);

      logger.info(`Feedback submitted: ${rating} stars from ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully'
      });

    } catch (error) {
      logger.error('Error submitting feedback:', error);
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  }

  // Helper methods
  async updateMessageStats(redisClient) {
    try {
      const today = new Date().toISOString().split('T')[0];
      await redisClient.incr(`stats:messages:${today}`);
      await redisClient.incr('stats:messages:total');
    } catch (error) {
      logger.error('Error updating message stats:', error);
    }
  }

  async updateReportStats(reason, redisClient) {
    try {
      const today = new Date().toISOString().split('T')[0];
      await redisClient.incr(`stats:reports:${today}`);
      await redisClient.incr(`stats:reports:${reason}:${today}`);
      await redisClient.incr('stats:reports:total');
    } catch (error) {
      logger.error('Error updating report stats:', error);
    }
  }

  async updateFeedbackStats(rating, category, redisClient) {
    try {
      const today = new Date().toISOString().split('T')[0];
      await redisClient.incr(`stats:feedback:${today}`);
      await redisClient.incr(`stats:feedback:rating:${rating}:${today}`);
      await redisClient.incr(`stats:feedback:category:${category}:${today}`);
    } catch (error) {
      logger.error('Error updating feedback stats:', error);
    }
  }
}

module.exports = new ChatController();