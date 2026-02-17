const mongoose = require('mongoose');
const logger = require('../loaders/logger');

async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    logger.warn('MONGODB_URI not set — skipping MongoDB connection');
    return false;
  }

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', { message: err.message }));

  await mongoose.connect(process.env.MONGODB_URI);
  return true;
}

async function disconnectMongo() {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectMongo, disconnectMongo, isConnected };