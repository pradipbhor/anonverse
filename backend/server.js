const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const config = require('./config/env');
const { createSocketServer } = require('./config/socket');
const { connectRedis, getRedisClient } = require('./config/redis');
const { connectMongo, isConnected: isMongoConnected } = require('./config/mongo');

const chatService = require('./services/ChatService');
const heartbeatService = require('./services/HeartbeatService');
const matchmakingService = require('./services/MatchmakingService');
const presenceService = require('./services/PresenceService');

const connectionHandler = require('./socket/connectionHandler');
const matchmakingHandler = require('./socket/matchmakingHandler');
const signalingHandler = require('./socket/signalingHandler');
const chatHandler = require('./socket/chatHandler');

const chatRoutes = require('./routes/chat');
const userRoutes = require('./routes/user');
const moderationRoutes = require('./routes/moderation');

const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const logger = require('./loaders/logger');

// ─── APP SETUP ───────────────────────────────────────────────

const app = express();
const httpServer = http.createServer(app);
const io = createSocketServer(httpServer);

// ─── MIDDLEWARE ──────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Session-ID']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── HEALTH ──────────────────────────────────────────────────

app.get('/health', (req, res) => {
  const queueStats = matchmakingService.getQueueStats();
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    services: {
      redis: getRedisClient() ? 'connected' : 'disconnected',
      mongodb: isMongoConnected() ? 'connected' : 'disconnected'
    },
    stats: {
      onlineUsers: presenceService.getOnlineCount(),
      ...queueStats
    }
  });
});

// ─── API ROUTES ──────────────────────────────────────────────

app.use('/api', generalLimiter);
app.use('/api/chat', chatRoutes);
app.use('/api/user', userRoutes);
app.use('/api/moderation', moderationRoutes);

// ─── SOCKET.IO ───────────────────────────────────────────────

io.on('connection', (socket) => {
  // Register all handlers for this socket
  connectionHandler.register(socket, io);
  matchmakingHandler.register(socket, io);
  signalingHandler.register(socket, io);
  chatHandler.register(socket, io);
});

// Periodic stale queue cleanup every 30s
setInterval(() => {
  const liveIds = Array.from(io.sockets.sockets.keys());
  matchmakingService.cleanStaleEntries(liveIds);
}, 30000);

// ─── ERROR HANDLERS ──────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ─── SERVICE INIT ────────────────────────────────────────────

async function initializeServices() {
  // Redis
  const redis = await connectRedis();
  if (redis) {
    chatService.setRedis(redis);
    logger.info('ChatService wired to Redis');
  }

  // MongoDB
  await connectMongo();

  // Heartbeat — start after io is ready
  heartbeatService.start(io);

  logger.info('All services initialized');
}

module.exports = { app, httpServer, io, initializeServices };