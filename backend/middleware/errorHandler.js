const logger = require('../loaders/logger');
const config = require('../config/env');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: config.isDev() ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
}

module.exports = { errorHandler, notFoundHandler };