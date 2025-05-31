const { body, param, query, validationResult } = require('express-validator');
const helpers = require('../utils/helpers');
const constants = require('../utils/constants');

class ValidationMiddleware {
  // Handle validation errors
  handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return helpers.sendError(res, {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      }, 400);
    }
    next();
  }

  // Session validation
  validateSession() {
    return [
      body('sessionId')
        .isLength({ min: 1 })
        .withMessage('Session ID is required')
        .isAlphanumeric()
        .withMessage('Session ID must be alphanumeric'),
      
      body('interests')
        .optional()
        .isArray({ max: constants.MAX_INTERESTS })
        .withMessage(`Maximum ${constants.MAX_INTERESTS} interests allowed`),
      
      body('interests.*')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('Each interest must be 1-50 characters')
        .matches(/^[a-zA-Z0-9\s-_]+$/)
        .withMessage('Interests can only contain letters, numbers, spaces, hyphens, and underscores'),
      
      body('mode')
        .optional()
        .isIn(['text', 'video'])
        .withMessage('Mode must be either text or video'),
      
      this.handleValidationErrors
    ];
  }

  // Message validation
  validateMessage() {
    return [
      body('content')
        .isLength({ min: 1, max: constants.MAX_MESSAGE_LENGTH })
        .withMessage(`Message must be 1-${constants.MAX_MESSAGE_LENGTH} characters`)
        .trim(),
      
      body('to')
        .isLength({ min: 1 })
        .withMessage('Recipient is required'),
      
      this.handleValidationErrors
    ];
  }

  // Report validation
  validateReport() {
    return [
      body('reportedUserId')
        .isLength({ min: 1 })
        .withMessage('Reported user ID is required'),
      
      body('reason')
        .isIn(['inappropriate-content', 'harassment', 'spam', 'underage', 'other'])
        .withMessage('Invalid report reason'),
      
      body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description must be less than 1000 characters')
        .trim(),
      
      body('evidence')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Evidence must be less than 2000 characters')
        .trim(),
      
      this.handleValidationErrors
    ];
  }

  // Content moderation validation
  validateContent() {
    return [
      body('content')
        .isLength({ min: 1, max: 2000 })
        .withMessage('Content must be 1-2000 characters')
        .trim(),
      
      this.handleValidationErrors
    ];
  }

  // Feedback validation
  validateFeedback() {
    return [
      body('rating')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be between 1 and 5'),
      
      body('comment')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Comment must be less than 500 characters')
        .trim(),
      
      body('category')
        .optional()
        .isIn(['general', 'matching', 'video', 'text', 'moderation', 'bug'])
        .withMessage('Invalid feedback category'),
      
      this.handleValidationErrors
    ];
  }

  // WebRTC validation
  validateWebRTCSignal() {
    return [
      body('type')
        .isIn(['offer', 'answer', 'ice-candidate'])
        .withMessage('Invalid signal type'),
      
      body('data')
        .exists()
        .withMessage('Signal data is required'),
      
      body('to')
        .isLength({ min: 1 })
        .withMessage('Recipient is required'),
      
      this.handleValidationErrors
    ];
  }

  // Moderator validation
  validateModeratorAction() {
    return [
      body('userId')
        .isLength({ min: 1 })
        .withMessage('User ID is required'),
      
      body('action')
        .isIn(['warn', 'temporary-ban', 'permanent-ban', 'unban'])
        .withMessage('Invalid moderator action'),
      
      body('reason')
        .isLength({ min: 1, max: 200 })
        .withMessage('Reason is required and must be less than 200 characters')
        .trim(),
      
      body('duration')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Duration must be a positive integer'),
      
      this.handleValidationErrors
    ];
  }

  // Parameter validation
  validateSessionParam() {
    return [
      param('sessionId')
        .isAlphanumeric()
        .withMessage('Invalid session ID format'),
      
      this.handleValidationErrors
    ];
  }

  validateUserParam() {
    return [
      param('userId')
        .isLength({ min: 1 })
        .withMessage('User ID is required'),
      
      this.handleValidationErrors
    ];
  }

  // Query validation
  validatePagination() {
    return [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
      
      this.handleValidationErrors
    ];
  }

  validateDateRange() {
    return [
      query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be in ISO 8601 format'),
      
      query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be in ISO 8601 format'),
      
      this.handleValidationErrors
    ];
  }

  // Custom validators
  customValidators = {
    isValidInterest: (value) => {
      return helpers.isValidInterest(value);
    },
    
    isUniqueArray: (value) => {
      if (!Array.isArray(value)) return false;
      return value.length === new Set(value).size;
    },
    
    isValidSessionId: (value) => {
      return typeof value === 'string' && 
             value.length === 32 && 
             /^[a-f0-9]+$/.test(value);
    }
  };
}

module.exports = new ValidationMiddleware();