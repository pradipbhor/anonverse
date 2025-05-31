// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  isAnonymous: {
    type: Boolean,
    default: true
  },
  interests: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  preferences: {
    mode: {
      type: String,
      enum: ['text', 'video'],
      default: 'text'
    },
    language: {
      type: String,
      default: 'en'
    },
    region: String
  },
  statistics: {
    totalChats: {
      type: Number,
      default: 0
    },
    totalMessages: {
      type: Number,
      default: 0
    },
    averageSessionDuration: {
      type: Number,
      default: 0
    },
    lastActiveAt: Date
  },
  metadata: {
    ip: String,
    userAgent: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastLoginAt: Date
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Indexes
userSchema.index({ 'interests': 1 });
userSchema.index({ 'preferences.mode': 1 });
userSchema.index({ 'metadata.createdAt': 1 });
userSchema.index({ 'statistics.lastActiveAt': 1 });

// TTL index for automatic cleanup (30 days)
userSchema.index({ 'updatedAt': 1 }, { expireAfterSeconds: 2592000 });

// Virtual for user activity status
userSchema.virtual('isActive').get(function() {
  if (!this.statistics.lastActiveAt) return false;
  const now = new Date();
  const lastActive = new Date(this.statistics.lastActiveAt);
  return (now - lastActive) < 300000; // 5 minutes
});

// Methods
userSchema.methods.updateActivity = function() {
  this.statistics.lastActiveAt = new Date();
  return this.save();
};

userSchema.methods.incrementChatCount = function() {
  this.statistics.totalChats += 1;
  this.statistics.lastActiveAt = new Date();
  return this.save();
};

userSchema.methods.addMessage = function() {
  this.statistics.totalMessages += 1;
  this.statistics.lastActiveAt = new Date();
  return this.save();
};

// Statics
userSchema.statics.findBySessionId = function(sessionId) {
  return this.findOne({ sessionId });
};

userSchema.statics.findActiveUsers = function() {
  const fiveMinutesAgo = new Date(Date.now() - 300000);
  return this.find({ 'statistics.lastActiveAt': { $gte: fiveMinutesAgo } });
};

userSchema.statics.getUsersByInterests = function(interests) {
  return this.find({ interests: { $in: interests } });
};

module.exports = mongoose.model('User', userSchema);

// models/ChatSession.js
const chatSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  participants: [{
    userId: String,
    sessionId: String,
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: Date,
    role: {
      type: String,
      enum: ['initiator', 'participant'],
      default: 'participant'
    }
  }],
  chatDetails: {
    mode: {
      type: String,
      enum: ['text', 'video'],
      required: true
    },
    commonInterests: [String],
    startedAt: {
      type: Date,
      default: Date.now
    },
    endedAt: Date,
    duration: Number, // in seconds
    status: {
      type: String,
      enum: ['active', 'ended', 'abandoned'],
      default: 'active'
    }
  },
  statistics: {
    messageCount: {
      type: Number,
      default: 0
    },
    participantCount: {
      type: Number,
      default: 0
    },
    skipCount: {
      type: Number,
      default: 0
    }
  },
  metadata: {
    matchingAlgorithm: String,
    matchingScore: Number,
    region: String,
    endReason: {
      type: String,
      enum: ['natural', 'skip', 'report', 'timeout', 'error']
    }
  }
}, {
  timestamps: true,
  collection: 'chatSessions'
});

// Indexes
chatSessionSchema.index({ 'chatDetails.startedAt': 1 });
chatSessionSchema.index({ 'chatDetails.mode': 1 });
chatSessionSchema.index({ 'chatDetails.status': 1 });
chatSessionSchema.index({ 'participants.userId': 1 });

// TTL index for cleanup (7 days)
chatSessionSchema.index({ 'updatedAt': 1 }, { expireAfterSeconds: 604800 });

// Methods
chatSessionSchema.methods.addParticipant = function(userId, sessionId, role = 'participant') {
  this.participants.push({ userId, sessionId, role });
  this.statistics.participantCount = this.participants.length;
  return this.save();
};

chatSessionSchema.methods.endSession = function(reason = 'natural') {
  this.chatDetails.endedAt = new Date();
  this.chatDetails.status = 'ended';
  this.chatDetails.duration = Math.floor((this.chatDetails.endedAt - this.chatDetails.startedAt) / 1000);
  this.metadata.endReason = reason;
  return this.save();
};

chatSessionSchema.methods.incrementMessageCount = function() {
  this.statistics.messageCount += 1;
  return this.save();
};

// Statics
chatSessionSchema.statics.getActiveSessionCount = function() {
  return this.countDocuments({ 'chatDetails.status': 'active' });
};

chatSessionSchema.statics.getSessionsByMode = function(mode) {
  return this.find({ 'chatDetails.mode': mode });
};

chatSessionSchema.statics.getAverageSessionDuration = async function() {
  const result = await this.aggregate([
    { $match: { 'chatDetails.status': 'ended' } },
    { $group: { _id: null, avgDuration: { $avg: '$chatDetails.duration' } } }
  ]);
  return result[0]?.avgDuration || 0;
};

module.exports = mongoose.model('ChatSession', chatSessionSchema);

// models/Report.js
const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  reportedUser: {
    userId: String,
    sessionId: String
  },
  reporter: {
    userId: String,
    sessionId: String,
    ip: String
  },
  reportDetails: {
    reason: {
      type: String,
      enum: ['inappropriate-content', 'harassment', 'spam', 'underage', 'other'],
      required: true
    },
    description: {
      type: String,
      maxlength: 1000
    },
    evidence: {
      type: String,
      maxlength: 2000
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'investigating', 'resolved', 'dismissed'],
    default: 'pending'
  },
  resolution: {
    resolvedBy: String,
    resolvedAt: Date,
    action: {
      type: String,
      enum: ['no-action', 'warning', 'temporary-ban', 'permanent-ban']
    },
    notes: String
  },
  metadata: {
    chatSessionId: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    priority: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true,
  collection: 'reports'
});

// Indexes
reportSchema.index({ 'reportedUser.userId': 1 });
reportSchema.index({ 'reportDetails.reason': 1 });
reportSchema.index({ 'status': 1 });
reportSchema.index({ 'metadata.timestamp': 1 });
reportSchema.index({ 'metadata.priority': -1 });

// Methods
reportSchema.methods.resolve = function(resolvedBy, action, notes) {
  this.status = 'resolved';
  this.resolution = {
    resolvedBy,
    resolvedAt: new Date(),
    action,
    notes
  };
  return this.save();
};

reportSchema.methods.dismiss = function(resolvedBy, notes) {
  this.status = 'dismissed';
  this.resolution = {
    resolvedBy,
    resolvedAt: new Date(),
    action: 'no-action',
    notes
  };
  return this.save();
};

// Statics
reportSchema.statics.getPendingReports = function() {
  return this.find({ status: 'pending' }).sort({ 'metadata.priority': -1, 'metadata.timestamp': 1 });
};

reportSchema.statics.getReportsByUser = function(userId) {
  return this.find({ 'reportedUser.userId': userId });
};

reportSchema.statics.getReportStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const reasonStats = await this.aggregate([
    {
      $group: {
        _id: '$reportDetails.reason',
        count: { $sum: 1 }
      }
    }
  ]);

  return { statusStats: stats, reasonStats };
};

module.exports = mongoose.model('Report', reportSchema);

// models/Analytics.js
const analyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  metrics: {
    dailyActiveUsers: {
      type: Number,
      default: 0
    },
    newUsers: {
      type: Number,
      default: 0
    },
    totalSessions: {
      type: Number,
      default: 0
    },
    textSessions: {
      type: Number,
      default: 0
    },
    videoSessions: {
      type: Number,
      default: 0
    },
    averageSessionDuration: {
      type: Number,
      default: 0
    },
    totalMessages: {
      type: Number,
      default: 0
    },
    successfulMatches: {
      type: Number,
      default: 0
    },
    skippedConnections: {
      type: Number,
      default: 0
    },
    reportedUsers: {
      type: Number,
      default: 0
    }
  },
  hourlyBreakdown: [{
    hour: {
      type: Number,
      min: 0,
      max: 23
    },
    activeUsers: Number,
    sessions: Number,
    messages: Number
  }],
  interestStats: [{
    interest: String,
    count: Number
  }],
  regionStats: [{
    region: String,
    users: Number,
    sessions: Number
  }]
}, {
  timestamps: true,
  collection: 'analytics'
});

// Ensure one document per date
analyticsSchema.index({ date: 1 }, { unique: true });

// Methods
analyticsSchema.methods.updateMetric = function(metric, value) {
  this.metrics[metric] = value;
  return this.save();
};

analyticsSchema.methods.incrementMetric = function(metric, amount = 1) {
  this.metrics[metric] += amount;
  return this.save();
};

// Statics
analyticsSchema.statics.getOrCreateToday = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let analytics = await this.findOne({ date: today });
  if (!analytics) {
    analytics = new this({ date: today });
    await analytics.save();
  }
  
  return analytics;
};

analyticsSchema.statics.getDateRange = function(startDate, endDate) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: 1 });
};

module.exports = mongoose.model('Analytics', analyticsSchema);