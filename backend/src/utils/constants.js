module.exports = {
    // User constants
    MAX_INTERESTS: 10,
    MAX_SESSION_DURATION: 3600000, // 1 hour
    SESSION_CLEANUP_INTERVAL: 300000, // 5 minutes
    
    // Chat constants
    MAX_MESSAGE_LENGTH: 1000,
    MAX_MESSAGES_PER_MINUTE: 30,
    TYPING_TIMEOUT: 3000,
    
    // Matching constants
    MATCH_TIMEOUT: 30000, // 30 seconds
    MAX_QUEUE_WAIT_TIME: 120000, // 2 minutes
    MATCHING_ALGORITHM_VERSION: '1.0',
    
    // Moderation constants
    AUTO_BAN_VIOLATION_COUNT: 5,
    DEFAULT_BAN_DURATION: 86400000, // 24 hours
    REPORT_RATE_LIMIT: 5, // per 10 minutes
    
    // Interest constants
    POPULAR_INTERESTS: [
      'music', 'movies', 'gaming', 'technology', 'sports', 'art', 'books',
      'travel', 'food', 'photography', 'science', 'nature', 'fitness',
      'anime', 'programming', 'fashion', 'cooking', 'dancing', 'writing', 'memes'
    ],
    
    // WebRTC constants
    ICE_SERVERS: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    
    // Rate limiting
    RATE_LIMITS: {
      GENERAL: { windowMs: 900000, max: 100 }, // 15 min, 100 requests
      CHAT: { windowMs: 60000, max: 30 }, // 1 min, 30 requests
      USER: { windowMs: 300000, max: 10 }, // 5 min, 10 requests
      MODERATION: { windowMs: 600000, max: 5 }, // 10 min, 5 requests
      AUTH: { windowMs: 900000, max: 5 } // 15 min, 5 requests
    },
    
    // Error codes
    ERROR_CODES: {
      INVALID_SESSION: 'INVALID_SESSION',
      USER_BANNED: 'USER_BANNED',
      RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
      CONTENT_FLAGGED: 'CONTENT_FLAGGED',
      MATCH_TIMEOUT: 'MATCH_TIMEOUT',
      CONNECTION_FAILED: 'CONNECTION_FAILED'
    }
  };