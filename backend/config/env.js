require('dotenv').config();

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  // Database
  MONGODB_URI: process.env.MONGODB_URI || '',
  REDIS_URL: process.env.REDIS_URL || '',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Logging
  LOG_DIR: process.env.LOG_DIR || './logs',
  LOG_RETENTION_DAYS: parseInt(process.env.LOG_RETENTION_DAYS, 10) || 8,

  // Matching
  GRACE_PERIOD_MS: parseInt(process.env.GRACE_PERIOD_MS, 10) || 30000,
  RECONNECT_WINDOW_MS: parseInt(process.env.RECONNECT_WINDOW_MS, 10) || 30000,

  // Heartbeat
  PING_INTERVAL_MS: parseInt(process.env.PING_INTERVAL_MS, 10) || 15000,
  PONG_TIMEOUT_MS: parseInt(process.env.PONG_TIMEOUT_MS, 10) || 5000,
  MAX_MISSED_PINGS: parseInt(process.env.MAX_MISSED_PINGS, 10) || 2,

  // Chat
  MESSAGE_EXPIRY_HOURS: parseInt(process.env.MESSAGE_EXPIRY_HOURS, 10) || 12,
  CACHE_TTL: parseInt(process.env.CACHE_TTL, 10) || 3600,

  // Moderation
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  MODERATION_BLOCK_ON_FAIL: process.env.MODERATION_BLOCK_ON_FAIL === 'true',
  MODERATION_LOG_FLAGGED: process.env.MODERATION_LOG_FLAGGED !== 'false',

  isDev() {
    return this.NODE_ENV === 'development';
  },

  isProd() {
    return this.NODE_ENV === 'production';
  }
};

module.exports = config;