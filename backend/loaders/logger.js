const fs = require('fs');
const path = require('path');
const util = require('util');

class Logger {
  constructor(options = {}) {
    this.logDir = options.logDir || './logs';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.retentionDays = options.retentionDays || 8;
    this.currentDate = null;
    this.currentStream = null;
    
    // Create logs directory if it doesn't exist
    this.ensureLogDirectory();
    
    // Initialize the logger
    this.initializeLogger();
    
    // Schedule cleanup check
    this.scheduleCleanup();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFileName(date = new Date()) {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `annoverse-${dateStr}-${this.environment}.log`;
  }

  getLogFilePath(date = new Date()) {
    return path.join(this.logDir, this.getLogFileName(date));
  }

  initializeLogger() {
    const today = new Date().toDateString();
    
    // Check if we need to create a new file (new day)
    if (this.currentDate !== today) {
      // Close existing stream if any
      if (this.currentStream) {
        this.currentStream.end();
      }
      
      // Update current date
      this.currentDate = today;
      
      // Create new write stream
      const logPath = this.getLogFilePath();
      this.currentStream = fs.createWriteStream(logPath, { flags: 'a' });
      
      // Clean old logs
      this.cleanOldLogs();
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    
    // Format the message
    let formattedMessage = {
      timestamp,
      level: level.toUpperCase(),
      pid,
      environment: this.environment,
      message
    };

    // Add metadata if provided
    if (Object.keys(meta).length > 0) {
      formattedMessage.meta = meta;
    }

    // Handle different types of messages
    if (typeof message === 'object') {
      formattedMessage.message = util.inspect(message, { depth: null });
    }

    return JSON.stringify(formattedMessage) + '\n';
  }

  write(level, message, meta) {
    // Ensure we're writing to the correct file (handles day changes)
    this.initializeLogger();
    
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Write to file
    if (this.currentStream && this.currentStream.writable) {
      this.currentStream.write(formattedMessage);
    }
    
    // Also write to console with color coding
    const colors = {
      info: '\x1b[36m',    // Cyan
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      debug: '\x1b[35m',   // Magenta
      success: '\x1b[32m', // Green
      reset: '\x1b[0m'
    };
    
    const color = colors[level] || colors.reset;
    console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
  }

  // Log level methods
  info(message, meta) {
    this.write('info', message, meta);
  }

  warn(message, meta) {
    this.write('warn', message, meta);
  }

  error(message, meta) {
    // Handle Error objects specially
    if (message instanceof Error) {
      const errorMeta = {
        ...meta,
        stack: message.stack,
        name: message.name
      };
      this.write('error', message.message, errorMeta);
    } else {
      this.write('error', message, meta);
    }
  }

  debug(message, meta) {
    this.write('debug', message, meta);
  }

  success(message, meta) {
    this.write('success', message, meta);
  }

  // Clean logs older than retention days
  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = new Date();
      const cutoffTime = now.getTime() - (this.retentionDays * 24 * 60 * 60 * 1000);

      files.forEach(file => {
        // Only process annoverse log files
        if (file.startsWith('annoverse-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          // Delete if older than retention period
          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            console.log(`Deleted old log file: ${file}`);
          }
        }
      });
    } catch (error) {
      console.error('Error cleaning old logs:', error);
    }
  }

  // Schedule daily cleanup
  scheduleCleanup() {
    // Run cleanup every hour to check for day changes and old logs
    setInterval(() => {
      this.initializeLogger(); // This will handle day changes
      this.cleanOldLogs();
    }, 60 * 60 * 1000); // Every hour
  }

  // Gracefully close the logger
  close() {
    if (this.currentStream) {
      this.currentStream.end();
      this.currentStream = null;
    }
  }
}

// Create singleton instance - THIS IS THE KEY PART
// This ensures the same instance is used everywhere
const logger = new Logger({
  logDir: process.env.LOG_DIR || './logs',
  environment: process.env.NODE_ENV || 'development',
  retentionDays: process.env.LOG_RETENTION_DAYS || 8
});

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.close();
  process.exit(0);
});

// SINGLE EXPORT - Use this same logger instance everywhere
module.exports = logger;