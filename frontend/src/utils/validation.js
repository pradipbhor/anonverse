import { MAX_MESSAGE_LENGTH, MAX_INTERESTS } from './constants';

// Validate message content
export const validateMessage = (message) => {
  const errors = [];
  
  if (!message || typeof message !== 'string') {
    errors.push('Message must be a string');
    return { isValid: false, errors };
  }
  
  const trimmed = message.trim();
  
  if (trimmed.length === 0) {
    errors.push('Message cannot be empty');
  }
  
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    errors.push(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
  }
  
  // Check for potentially harmful content patterns
  const harmfulPatterns = [
    /\b(?:https?:\/\/[^\s]+)\b/gi, // URLs
    /\b(?:\w+@\w+\.\w+)\b/g, // Email addresses
    /\b(?:\d{3}[-.]?\d{3}[-.]?\d{4})\b/g, // Phone numbers
    /\b(?:discord|telegram|whatsapp|snapchat|instagram|facebook)\b/gi // Social media mentions
  ];
  
  harmfulPatterns.forEach((pattern, index) => {
    if (pattern.test(trimmed)) {
      const types = ['URLs', 'email addresses', 'phone numbers', 'social media'];
      errors.push(`Message should not contain ${types[index]} for safety reasons`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: trimmed
  };
};

// Validate interest
export const validateInterest = (interest) => {
  const errors = [];
  
  if (!interest || typeof interest !== 'string') {
    errors.push('Interest must be a string');
    return { isValid: false, errors };
  }
  
  const trimmed = interest.trim();
  
  if (trimmed.length === 0) {
    errors.push('Interest cannot be empty');
  }
  
  if (trimmed.length < 2) {
    errors.push('Interest must be at least 2 characters long');
  }
  
  if (trimmed.length > 30) {
    errors.push('Interest cannot exceed 30 characters');
  }
  
  // Only allow alphanumeric, spaces, hyphens, and underscores
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
    errors.push('Interest can only contain letters, numbers, spaces, hyphens, and underscores');
  }
  
  // Check for inappropriate content
  const inappropriateWords = [
    'sex', 'porn', 'adult', 'nude', 'nsfw', 'xxx', 'fetish',
    'dating', 'hookup', 'meet', 'cam', 'webcam'
  ];
  
  const lowerInterest = trimmed.toLowerCase();
  inappropriateWords.forEach(word => {
    if (lowerInterest.includes(word)) {
      errors.push('Interest contains inappropriate content');
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: trimmed
  };
};

// Validate interests array
export const validateInterests = (interests) => {
  const errors = [];
  
  if (!Array.isArray(interests)) {
    errors.push('Interests must be an array');
    return { isValid: false, errors };
  }
  
  if (interests.length > MAX_INTERESTS) {
    errors.push(`Cannot have more than ${MAX_INTERESTS} interests`);
  }
  
  const validInterests = [];
  const seenInterests = new Set();
  
  interests.forEach((interest, index) => {
    const validation = validateInterest(interest);
    
    if (!validation.isValid) {
      errors.push(`Interest ${index + 1}: ${validation.errors.join(', ')}`);
    } else {
      const normalized = validation.sanitized.toLowerCase();
      
      if (seenInterests.has(normalized)) {
        errors.push(`Duplicate interest: ${validation.sanitized}`);
      } else {
        seenInterests.add(normalized);
        validInterests.push(validation.sanitized);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: validInterests
  };
};

// Validate session ID
export const validateSessionId = (sessionId) => {
  const errors = [];
  
  if (!sessionId || typeof sessionId !== 'string') {
    errors.push('Session ID must be a string');
    return { isValid: false, errors };
  }
  
  if (sessionId.length < 10) {
    errors.push('Session ID must be at least 10 characters long');
  }
  
  if (sessionId.length > 50) {
    errors.push('Session ID cannot exceed 50 characters');
  }
  
  if (!/^[a-zA-Z0-9]+$/.test(sessionId)) {
    errors.push('Session ID can only contain letters and numbers');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: sessionId.trim()
  };
};

// Validate chat mode
export const validateChatMode = (mode) => {
  const validModes = ['text', 'video'];
  
  if (!validModes.includes(mode)) {
    return {
      isValid: false,
      errors: [`Chat mode must be one of: ${validModes.join(', ')}`],
      sanitized: 'text' // Default to text
    };
  }
  
  return {
    isValid: true,
    errors: [],
    sanitized: mode
  };
};

// Validate report data
export const validateReport = (reportData) => {
  const errors = [];
  const { reportedUserId, reason, description } = reportData;
  
  if (!reportedUserId || typeof reportedUserId !== 'string') {
    errors.push('Reported user ID is required');
  }
  
  const validReasons = [
    'inappropriate-content',
    'harassment',
    'spam',
    'underage',
    'other'
  ];
  
  if (!reason || !validReasons.includes(reason)) {
    errors.push(`Report reason must be one of: ${validReasons.join(', ')}`);
  }
  
  if (description && typeof description === 'string') {
    if (description.length > 500) {
      errors.push('Report description cannot exceed 500 characters');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      reportedUserId: reportedUserId?.trim(),
      reason,
      description: description?.trim() || ''
    }
  };
};

// Validate user agent and basic security checks
export const validateClientInfo = (userAgent, ipAddress) => {
  const errors = [];
  
  // Basic bot detection
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i,
    /node/i
  ];
  
  if (userAgent && botPatterns.some(pattern => pattern.test(userAgent))) {
    errors.push('Automated requests are not allowed');
  }
  
  // Check for suspicious IP patterns
  if (ipAddress) {
    // Block common VPN/proxy IP ranges (basic check)
    const suspiciousPatterns = [
      /^10\./, // Private network
      /^192\.168\./, // Private network
      /^172\.1[6-9]\./, // Private network
      /^172\.2[0-9]\./, // Private network
      /^172\.3[0-1]\./, // Private network
    ];
    
    // Note: In production, you'd want more sophisticated IP validation
    // and perhaps allow private networks for development
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Sanitize HTML to prevent XSS
export const sanitizeHTML = (input) => {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Rate limiting validation
export const validateRateLimit = (requests, timeWindow, maxRequests) => {
  const now = Date.now();
  const windowStart = now - timeWindow;
  
  // Filter requests within the time window
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (recentRequests.length >= maxRequests) {
    return {
      isValid: false,
      retryAfter: Math.ceil((recentRequests[0] + timeWindow - now) / 1000),
      error: 'Rate limit exceeded'
    };
  }
  
  return {
    isValid: true,
    remaining: maxRequests - recentRequests.length - 1
  };
};

// Comprehensive input validation for join queue
export const validateJoinQueue = (data) => {
  const errors = [];
  const { interests, mode, sessionId } = data;
  
  // Validate session ID
  const sessionValidation = validateSessionId(sessionId);
  if (!sessionValidation.isValid) {
    errors.push(...sessionValidation.errors);
  }
  
  // Validate chat mode
  const modeValidation = validateChatMode(mode);
  if (!modeValidation.isValid) {
    errors.push(...modeValidation.errors);
  }
  
  // Validate interests
  if (interests) {
    const interestsValidation = validateInterests(interests);
    if (!interestsValidation.isValid) {
      errors.push(...interestsValidation.errors);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      sessionId: sessionValidation.sanitized,
      mode: modeValidation.sanitized,
      interests: interests ? validateInterests(interests).sanitized : []
    }
  };
};