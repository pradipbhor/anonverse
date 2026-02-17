const router = require('express').Router();
const { userLimiter } = require('../middleware/rateLimiter');
const presenceService = require('../services/PresenceService');
const matchmakingService = require('../services/MatchmakingService');
const { POPULAR_INTERESTS } = require('../constants');

router.get('/test', userLimiter, (req, res) => {
  res.json({ message: 'User routes working', timestamp: new Date().toISOString() });
});

router.post('/session', userLimiter, (req, res) => {
  const { sessionId, interests, mode } = req.body;
  res.json({
    success: true,
    sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
    interests: interests || [],
    mode: mode || 'text',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString()
  });
});

router.get('/interests', userLimiter, (req, res) => {
  res.json({ success: true, interests: POPULAR_INTERESTS, count: POPULAR_INTERESTS.length });
});

router.get('/online-count', userLimiter, (req, res) => {
  const stats = matchmakingService.getQueueStats();
  res.json({
    success: true,
    onlineUsers: presenceService.getOnlineCount(),
    queueStats: {
      totalInQueue: stats.textQueue + stats.videoQueue,
      textUsers: stats.textQueue,
      videoUsers: stats.videoQueue
    }
  });
});

module.exports = router;