const crypto = require('crypto');
const logger = require('./logger');

class Helpers {
  // Generate unique IDs
  generateId(length = 12) {
    return crypto.randomBytes(length).toString('hex');
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Validation helpers
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  isValidInterest(interest) {
    return typeof interest === 'string' && 
           interest.length >= 1 && 
           interest.length <= 50 &&
           /^[a-zA-Z0-9\s-_]+$/.test(interest);
  }

  sanitizeInterests(interests) {
    if (!Array.isArray(interests)) return [];
    
    return interests
      .filter(interest => this.isValidInterest(interest))
      .map(interest => interest.trim().toLowerCase())
      .slice(0, 10); // Max 10 interests
  }

  // Text processing
  sanitizeMessage(message) {
    if (typeof message !== 'string') return '';
    
    return message
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .substring(0, 1000); // Max 1000 characters
  }

  // Time helpers
  getTimestamp() {
    return new Date().toISOString();
  }

  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // IP address helpers
  getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip;
  }

  // Hash helpers
  hashString(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  // Array helpers
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  findCommonElements(arr1, arr2) {
    return arr1.filter(element => arr2.includes(element));
  }

  // Error handling
  createError(message, code, statusCode = 500) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }

  handleAsyncError(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Response helpers
  sendSuccess(res, data, message = 'Success') {
    res.status(200).json({
      success: true,
      message,
      data,
      timestamp: this.getTimestamp()
    });
  }

  sendError(res, error, statusCode = 500) {
    logger.error('API Error:', error);
    
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Internal server error',
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: this.getTimestamp()
    });
  }

  // Statistics helpers
  calculatePercentage(part, total) {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  }

  calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  // Environment helpers
  isDevelopment() {
    return process.env.NODE_ENV === 'development';
  }

  isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  // Configuration helpers
  getEnvVar(name, defaultValue = null) {
    const value = process.env[name];
    if (value === undefined || value === null) {
      if (defaultValue !== null) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${name} is required but not set`);
    }
    return value;
  }

  parseEnvInt(name, defaultValue = 0) {
    const value = process.env[name];
    return value ? parseInt(value, 10) : defaultValue;
  }

  parseEnvBool(name, defaultValue = false) {
    const value = process.env[name];
    return value ? value.toLowerCase() === 'true' : defaultValue;
  }
}

module.exports = new Helpers();