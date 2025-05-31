const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');
const logger = require('../utils/logger');

// Redis-based rate limiting store
class RedisStore {
  constructor(redisClient) {
    this.client = redisClient;
    this.prefix = 'rate_limit:';
  }

  async increment(key) {
    const fullKey = this.prefix + key;
    const current = await this.client.incr(fullKey);
    
    if (current === 1) {
      await this.client.expire(fullKey, 60); // 1 minute default
    }
    
    return { totalCount: current, resetTime: new Date(Date.now() + 60000) };
  }

  async decrement(key) {
    const fullKey = this.prefix + key;
    await this.client.decr(fullKey);
  }

  async resetKey(key) {
    const fullKey = this.prefix + key;
    await this.client.del(fullKey);
  }
}

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const redisStore = new RedisStore(redisClient);

// Custom key generator that uses session ID or IP
const keyGenerator = (req) => {
  return req.sessionId || req.headers['x-session-id'] || req.ip;
};

// Custom handler for rate limit exceeded
const rateLimitHandler = (req, res) => {
  logger.warn(`Rate limit exceeded for ${keyGenerator(req)}`, {
    ip: req.ip,
    sessionId: req.sessionId,
    userAgent: req.headers['user-agent'],
    endpoint: req.path
  });

  res.status(429).json({
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please slow down.',
    retryAfter: Math.ceil(60), // seconds
    timestamp: new Date().toISOString()
  });
};

// Different rate limiters for different endpoints
class RateLimiters {
  // General API rate limiter
  get generalLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each key to 100 requests per windowMs
      keyGenerator,
      handler: rateLimitHandler,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests from this client'
    });
  }

  // Chat-specific rate limiter (more restrictive)
  get chatLimiter() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // 30 messages per minute
      keyGenerator,
      handler: rateLimitHandler,
      message: 'Too many chat requests. Please slow down.'
    });
  }

  // User actions (session creation, etc.)
  get userLimiter() {
    return rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 actions per 5 minutes
      keyGenerator,
      handler: rateLimitHandler,
      message: 'Too many user actions. Please wait a moment.'
    });
  }

  // Moderation actions (reports, etc.) - very strict
  get moderationLimiter() {
    return rateLimit({
      windowMs: 10 * 60 * 1000, // 10 minutes
      max: 5, // 5 reports per 10 minutes
      keyGenerator,
      handler: rateLimitHandler,
      message: 'Too many moderation actions. Please wait before reporting again.'
    });
  }

  // WebRTC signaling - moderate limiting
  get webrtcLimiter() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 60, // 60 signaling messages per minute
      keyGenerator,
      handler: rateLimitHandler,
      message: 'Too many WebRTC signaling requests.'
    });
  }

  // Authentication attempts - strict
  get authLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per 15 minutes
      keyGenerator: (req) => req.ip, // Use IP for auth attempts
      handler: rateLimitHandler,
      message: 'Too many authentication attempts. Please try again later.'
    });
  }

  // File upload limiter
  get uploadLimiter() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 uploads per hour
      keyGenerator,
      handler: rateLimitHandler,
      message: 'Upload limit exceeded. Please try again later.'
    });
  }
}

// Advanced rate limiting with Redis
class AdvancedRateLimiter {
  constructor(redisClient) {
    this.redis = redisClient;
    this.prefix = 'advanced_rate_limit:';
  }

  // Sliding window rate limiter
  async slidingWindow(key, limit, windowMs, identifier) {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const redisKey = `${this.prefix}sliding:${identifier}:${key}:${window}`;
    
    const count = await this.redis.incr(redisKey);
    
    if (count === 1) {
      await this.redis.expire(redisKey, Math.ceil(windowMs / 1000));
    }
    
    return {
      allowed: count <= limit,
      count,
      limit,
      resetTime: (window + 1) * windowMs
    };
  }

  // Token bucket rate limiter
  async tokenBucket(key, capacity, refillRate, identifier) {
    const now = Date.now();
    const bucketKey = `${this.prefix}bucket:${identifier}:${key}`;
    
    const bucket = await this.redis.hmget(bucketKey, 'tokens', 'lastRefill');
    let tokens = parseInt(bucket[0]) || capacity;
    let lastRefill = parseInt(bucket[1]) || now;
    
    // Refill tokens based on time elapsed
    const elapsed = now - lastRefill;
    const tokensToAdd = Math.floor(elapsed * refillRate / 1000);
    tokens = Math.min(capacity, tokens + tokensToAdd);
    
    if (tokens > 0) {
      tokens--;
      await this.redis.hmset(bucketKey, 'tokens', tokens, 'lastRefill', now);
      await this.redis.expire(bucketKey, 3600); // 1 hour expiry
      
      return { allowed: true, tokens, capacity };
    } else {
      await this.redis.hmset(bucketKey, 'lastRefill', now);
      return { allowed: false, tokens: 0, capacity };
    }
  }

  // Adaptive rate limiter based on user behavior
  async adaptiveLimit(key, baseLimit, identifier) {
    const violationKey = `${this.prefix}violations:${identifier}`;
    const violations = await this.redis.get(violationKey) || 0;
    
    // Reduce limit based on violations
    const adjustedLimit = Math.max(1, baseLimit - violations * 2);
    
    return this.slidingWindow(key, adjustedLimit, 60000, identifier);
  }

  // Middleware factory
  createMiddleware(options = {}) {
    return async (req, res, next) => {
      try {
        const identifier = keyGenerator(req);
        const key = options.key || req.path;
        
        let result;
        
        switch (options.type) {
          case 'sliding':
            result = await this.slidingWindow(
              key, 
              options.limit || 10, 
              options.window || 60000, 
              identifier
            );
            break;
          case 'bucket':
            result = await this.tokenBucket(
              key,
              options.capacity || 10,
              options.refillRate || 1,
              identifier
            );
            break;
          case 'adaptive':
            result = await this.adaptiveLimit(
              key,
              options.baseLimit || 10,
              identifier
            );
            break;
          default:
            return next();
        }
        
        if (!result.allowed) {
          logger.warn(`Advanced rate limit exceeded for ${identifier}`, {
            key,
            type: options.type,
            result
          });
          
          return res.status(429).json({
            error: 'Rate limit exceeded',
            limit: result.limit || result.capacity,
            remaining: result.tokens || 0,
            resetTime: result.resetTime,
            type: options.type
          });
        }
        
        // Add rate limit info to response headers
        res.set({
          'X-RateLimit-Limit': result.limit || result.capacity,
          'X-RateLimit-Remaining': Math.max(0, (result.limit || result.capacity) - result.count || result.tokens || 0),
          'X-RateLimit-Reset': result.resetTime
        });
        
        next();
      } catch (error) {
        logger.error('Advanced rate limiter error:', error);
        next(); // Continue on error
      }
    };
  }
}

const rateLimiters = new RateLimiters();
const advancedLimiter = new AdvancedRateLimiter(redisClient);

// Export individual limiters and factory
module.exports = {
  // Standard rate limiters
  generalLimiter: rateLimiters.generalLimiter,
  chatLimiter: rateLimiters.chatLimiter,
  userLimiter: rateLimiters.userLimiter,
  moderationLimiter: rateLimiters.moderationLimiter,
  webrtcLimiter: rateLimiters.webrtcLimiter,
  authLimiter: rateLimiters.authLimiter,
  uploadLimiter: rateLimiters.uploadLimiter,
  
  // Advanced rate limiter
  advanced: advancedLimiter,
  
  // Utility functions
  keyGenerator,
  rateLimitHandler,
  
  // Create custom rate limiter
  create: (options) => rateLimit({
    windowMs: options.windowMs || 60000,
    max: options.max || 10,
    keyGenerator: options.keyGenerator || keyGenerator,
    handler: options.handler || rateLimitHandler,
    ...options
  })
};