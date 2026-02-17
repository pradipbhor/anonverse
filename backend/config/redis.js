const { createClient } = require('redis');
const logger = require('../loaders/logger');

let redisClient = null;

async function connectRedis() {
  if (!process.env.REDIS_URL) {
    logger.warn('REDIS_URL not set — skipping Redis connection');
    return null;
  }

  redisClient = createClient({ url: process.env.REDIS_URL });

  redisClient.on('error', (err) => {
    logger.error('Redis error', { message: err.message });
  });

  redisClient.on('reconnecting', () => {
    logger.warn('Redis reconnecting...');
  });

  redisClient.on('ready', () => {
    logger.info('Redis ready');
  });

  await redisClient.connect();
  logger.info('Connected to Redis');
  return redisClient;
}

async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

function getRedisClient() {
  return redisClient;
}

module.exports = { connectRedis, disconnectRedis, getRedisClient };