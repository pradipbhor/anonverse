const config = require('./config/env');
const logger = require('./loaders/logger');
const { app, httpServer, initializeServices } = require('./server');
const { disconnectRedis } = require('./config/redis');
const { disconnectMongo } = require('./config/mongo');
const heartbeatService = require('./services/HeartbeatService');

async function startServer() {
  try {
    await initializeServices();

    httpServer.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
      logger.info(`CORS origin: ${config.CORS_ORIGIN}`);
      logger.info(`Health: http://localhost:${config.PORT}/health`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

// ─── GRACEFUL SHUTDOWN ───────────────────────────────────────

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  heartbeatService.stop();

  try {
    await disconnectRedis();
    await disconnectMongo();
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
  process.exit(1);
});

startServer();