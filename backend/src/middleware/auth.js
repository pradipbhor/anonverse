const jwt = require('jsonwebtoken');
const { createClient } = require('redis');
const logger = require('../utils/logger');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

class AuthMiddleware {
  // Session-based authentication for anonymous users
  async authenticateSession(req, res, next) {
    try {
      const sessionId = req.headers['x-session-id'] || req.query.sessionId;
      
      if (!sessionId) {
        return res.status(401).json({ error: 'Session ID required' });
      }

      // Check if session exists and is valid
      const sessionData = await redisClient.get(`session:${sessionId}`);
      
      if (!sessionData) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      const session = JSON.parse(sessionData);
      
      // Check if session is expired
      const sessionAge = Date.now() - new Date(session.createdAt).getTime();
      if (sessionAge > 3600000) { // 1 hour
        await redisClient.del(`session:${sessionId}`);
        return res.status(401).json({ error: 'Session expired' });
      }

      // Update last active time
      session.lastActive = new Date().toISOString();
      await redisClient.setEx(`session:${sessionId}`, 3600, JSON.stringify(session));

      // Add session info to request
      req.session = session;
      req.sessionId = sessionId;
      
      next();
    } catch (error) {
      logger.error('Session authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  // Optional session authentication (doesn't fail if no session)
  async optionalSession(req, res, next) {
    try {
      const sessionId = req.headers['x-session-id'] || req.query.sessionId;
      
      if (sessionId) {
        const sessionData = await redisClient.get(`session:${sessionId}`);
        
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const sessionAge = Date.now() - new Date(session.createdAt).getTime();
          
          if (sessionAge <= 3600000) { // 1 hour
            session.lastActive = new Date().toISOString();
            await redisClient.setEx(`session:${sessionId}`, 3600, JSON.stringify(session));
            
            req.session = session;
            req.sessionId = sessionId;
          }
        }
      }
      
      next();
    } catch (error) {
      logger.error('Optional session authentication error:', error);
      next(); // Continue without session
    }
  }

  // Moderator authentication (for admin endpoints)
  async authenticateModerator(req, res, next) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Moderator token required' });
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.role !== 'moderator' && decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Check if moderator is still active
      const moderatorData = await redisClient.get(`moderator:${decoded.id}`);
      
      if (!moderatorData) {
        return res.status(401).json({ error: 'Invalid moderator credentials' });
      }

      req.moderator = JSON.parse(moderatorData);
      req.moderatorId = decoded.id;
      
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      
      logger.error('Moderator authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  // Check if user is banned
  async checkBanStatus(req, res, next) {
    try {
      const userId = req.sessionId || req.ip;
      const banKey = `banned:${userId}`;
      const banned = await redisClient.get(banKey);
      
      if (banned) {
        const banData = banned === 'banned' ? { banned: true } : JSON.parse(banned);
        
        return res.status(403).json({
          error: 'User is banned',
          banInfo: {
            banned: true,
            reason: banData.reason || 'Terms of service violation',
            expiresAt: banData.expiresAt || null,
            appealUrl: process.env.APPEAL_URL || null
          }
        });
      }
      
      next();
    } catch (error) {
      logger.error('Ban check error:', error);
      next(); // Continue if ban check fails
    }
  }

  // Generate anonymous session
  async generateAnonymousSession(req, res, next) {
    try {
      // Generate unique session ID
      const sessionId = this.generateSessionId();
      const ip = req.ip;
      const userAgent = req.headers['user-agent'];

      const sessionData = {
        sessionId,
        ip,
        userAgent,
        isAnonymous: true,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        interests: [],
        mode: 'text'
      };

      // Store session
      await redisClient.setEx(
        `session:${sessionId}`,
        3600, // 1 hour
        JSON.stringify(sessionData)
      );

      req.session = sessionData;
      req.sessionId = sessionId;
      
      res.setHeader('X-Session-ID', sessionId);
      
      next();
    } catch (error) {
      logger.error('Error generating anonymous session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }

  // Validate session ownership
  async validateSessionOwnership(req, res, next) {
    try {
      const requestedSessionId = req.params.sessionId || req.body.sessionId;
      const currentSessionId = req.sessionId;
      
      if (requestedSessionId && requestedSessionId !== currentSessionId) {
        return res.status(403).json({ error: 'Session access denied' });
      }
      
      next();
    } catch (error) {
      logger.error('Session ownership validation error:', error);
      res.status(500).json({ error: 'Validation failed' });
    }
  }

  // Rate limiting based on session/IP
  async createRateLimitKey(req) {
    return req.sessionId || req.ip;
  }

  // Helper methods
  generateSessionId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Middleware factory for different auth requirements
  require(type = 'session') {
    switch (type) {
      case 'session':
        return this.authenticateSession.bind(this);
      case 'optional':
        return this.optionalSession.bind(this);
      case 'moderator':
        return this.authenticateModerator.bind(this);
      case 'ban-check':
        return this.checkBanStatus.bind(this);
      case 'generate':
        return this.generateAnonymousSession.bind(this);
      case 'ownership':
        return this.validateSessionOwnership.bind(this);
      default:
        return this.optionalSession.bind(this);
    }
  }
}

module.exports = new AuthMiddleware();