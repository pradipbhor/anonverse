const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { body, validationResult } = require('express-validator');
const rateLimiter = require('../middleware/rateLimiter');

// Apply rate limiting to chat routes
router.use(rateLimiter.chatLimiter);

// Validation middleware
const validateMessage = [
  body('content')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters')
    .trim()
    .escape(),
  body('to')
    .isLength({ min: 1 })
    .withMessage('Recipient is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

const validateReport = [
  body('reportedUserId')
    .isLength({ min: 1 })
    .withMessage('Reported user ID is required'),
  body('reason')
    .isIn(['inappropriate-content', 'harassment', 'spam', 'underage', 'other'])
    .withMessage('Invalid report reason'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Routes
router.post('/send-message', validateMessage, chatController.sendMessage);
router.post('/report', validateReport, chatController.reportUser);
router.get('/stats', chatController.getChatStats);
router.post('/feedback', chatController.submitFeedback);

module.exports = router;