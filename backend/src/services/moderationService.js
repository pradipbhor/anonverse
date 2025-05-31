const OpenAI = require('openai');
const logger = require('../utils/logger');

class ModerationService {
  constructor() {
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }) : null;
    
    // Fallback word filter
    this.bannedWords = [
      // Add inappropriate words here
      'spam', 'scam', 'fraud'
    ];
  }

  async moderateContent(content) {
    try {
      // Use OpenAI moderation if available
      if (this.openai) {
        const moderation = await this.openai.moderations.create({
          input: content
        });
        
        const result = moderation.results[0];
        return {
          flagged: result.flagged,
          categories: Object.keys(result.categories).filter(
            key => result.categories[key]
          ),
          scores: result.category_scores
        };
      }
      
      // Fallback to basic word filtering
      return this.basicWordFilter(content);
    } catch (error) {
      logger.error('Moderation error:', error);
      return this.basicWordFilter(content);
    }
  }

  basicWordFilter(content) {
    const lowerContent = content.toLowerCase();
    const flagged = this.bannedWords.some(word => lowerContent.includes(word));
    
    return {
      flagged,
      categories: flagged ? ['inappropriate-content'] : [],
      scores: {}
    };
  }

  async reportUser(reportData, redisClient) {
    try {
      const reportKey = `report:${reportData.reportedUserId}:${Date.now()}`;
      await redisClient.setEx(reportKey, 86400, JSON.stringify({
        ...reportData,
        timestamp: new Date().toISOString()
      }));
      
      // Increment report count
      const countKey = `report_count:${reportData.reportedUserId}`;
      const count = await redisClient.incr(countKey);
      await redisClient.expire(countKey, 3600); // 1 hour expiry
      
      // Auto-ban if too many reports
      if (count >= 5) {
        await this.banUser(reportData.reportedUserId, redisClient);
      }
      
      return true;
    } catch (error) {
      logger.error('Error reporting user:', error);
      throw error;
    }
  }

  async banUser(userId, redisClient) {
    try {
      const banKey = `banned:${userId}`;
      await redisClient.setEx(banKey, 86400, 'banned'); // 24 hour ban
      logger.info(`User ${userId} has been banned`);
    } catch (error) {
      logger.error('Error banning user:', error);
    }
  }

  async isUserBanned(userId, redisClient) {
    try {
      const banKey = `banned:${userId}`;
      const banned = await redisClient.get(banKey);
      return !!banned;
    } catch (error) {
      logger.error('Error checking ban status:', error);
      return false;
    }
  }
}

module.exports = new ModerationService();