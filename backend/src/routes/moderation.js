const express = require('express');
const router = express.Router();
const moderationController = require('../controllers/moderationController');
const { body, validationResult } = require('express-validator');
const rateLimiter = require('../middleware/rateLimiter');

// Apply strict rate limiting for moderation endpoints
router.use(rateLimiter.moderationLimiter);

// Validation middleware
const validateContent = [
  body('content')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Content must be between 1 and 2000 characters')
    .trim(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

const validateReport = [
  body('userId')
    .isLength({ min: 1 })
    .withMessage('User ID is required'),
  body('reason')
    .isIn(['inappropriate-content', 'harassment', 'spam', 'underage', 'other'])
    .withMessage('Invalid report reason'),
  body('evidence')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Evidence must be less than 1000 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Routes
router.post('/check-content', validateContent, moderationController.checkContent);
router.post('/report-user', validateReport, moderationController.reportUser);
router.get('/banned/:userId', moderationController.checkBanStatus);
router.get('/stats', moderationController.getModerationStats);

module.exports = router;