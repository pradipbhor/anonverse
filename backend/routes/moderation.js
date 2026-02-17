const router = require('express').Router();
const { moderationLimiter } = require('../middleware/rateLimiter');
const moderationService = require('../services/ModerationService');
const logger = require('../loaders/logger');

const VALID_REASONS = [
  'inappropriate-content', 'harassment', 'spam', 'underage', 'other'
];

router.get('/test', moderationLimiter, (req, res) => {
  res.json({
    message: 'Moderation routes working',
    openaiEnabled: moderationService.isEnabled(),
    timestamp: new Date().toISOString()
  });
});

// ─── CHECK CONTENT ───────────────────────────────────────────
router.post('/check-content', moderationLimiter, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  try {
    const result = await moderationService.checkContent(content);
    res.json({
      success: true,
      allowed: result.allowed,
      flagged: result.flagged,
      reason: result.reason || null,
      categories: result.categories,
      layer: result.layer,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('POST /moderation/check-content', { error: err.message });
    res.status(500).json({ error: 'Moderation check failed' });
  }
});

// ─── REPORT USER ─────────────────────────────────────────────
router.post('/report-user', moderationLimiter, (req, res) => {
  const { userId, reason, description } = req.body;

  if (!userId || !reason) {
    return res.status(400).json({ error: 'userId and reason are required' });
  }
  if (!VALID_REASONS.includes(reason)) {
    return res.status(400).json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` });
  }

  logger.warn('User reported via API', { userId, reason, description });

  res.json({
    success: true,
    reportId: `report_${Date.now()}`,
    timestamp: new Date().toISOString()
  });
});

// ─── STATS ───────────────────────────────────────────────────
router.get('/stats', moderationLimiter, (req, res) => {
  res.json({
    success: true,
    stats: {
      openaiEnabled: moderationService.isEnabled(),
      activeFlaggedUsers: 0  // extend later with Redis tracking
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;