const router = require('express').Router();
const chatService = require('../services/ChatService');
const { chatLimiter } = require('../middleware/rateLimiter');
const logger = require('../loaders/logger');

router.get('/test', chatLimiter, (req, res) => {
  res.json({ message: 'Chat routes working', timestamp: new Date().toISOString() });
});

router.post('/send-message', chatLimiter, async (req, res) => {
  const { content, to, roomId, senderId } = req.body;
  if (!content || !to) {
    return res.status(400).json({ error: 'content and to are required' });
  }
  try {
    const msg = roomId
      ? await chatService.sendMessage({ roomId, senderId: senderId || 'api', recipientId: to, content })
      : { id: Date.now().toString(), content, timestamp: new Date().toISOString() };

    res.json({ success: true, message: 'Message sent', messageData: msg });
  } catch (err) {
    logger.error('POST /chat/send-message', { error: err.message });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/report', chatLimiter, (req, res) => {
  const { reportedUserId, reason } = req.body;
  if (!reportedUserId || !reason) {
    return res.status(400).json({ error: 'reportedUserId and reason are required' });
  }
  res.json({ success: true, reportId: `report_${Date.now()}` });
});

router.get('/stats', chatLimiter, async (req, res) => {
  try {
    const stats = await chatService.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;