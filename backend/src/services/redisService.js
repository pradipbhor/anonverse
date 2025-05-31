const logger = require('../utils/logger');

class RedisService {
  constructor() {
    this.ONLINE_USERS_KEY = 'online_users';
    this.CHAT_STATS_KEY = 'chat_statistics';
    this.DAILY_STATS_PREFIX = 'daily_stats:';
    this.USER_ACTIVITY_PREFIX = 'user_activity:';
    this.MATCHING_QUEUE_KEY = 'matching_queue';
    this.USER_SESSIONS_PREFIX = 'session:';
    this.BANNED_USERS_PREFIX = 'banned:';
    this.REPORTS_PREFIX = 'reports:';
    this.INTERESTS_POPULARITY_KEY = 'popular_interests';
    this.CONNECTION_QUALITY_PREFIX = 'connection_quality:';
    this.BEHAVIOR_TRACKING_PREFIX = 'behavior:';
    this.SPAM_FLAGS_PREFIX = 'spam_flag:';
    this.SERVER_LOAD_PREFIX = 'server_load:';
    this.EMERGENCY_MODE_KEY = 'emergency_mode';
    this.RATE_LIMIT_PREFIX = 'rate_limit:';
    this.CACHE_PREFIX = 'cache:';
    this.PERFORMANCE_PREFIX = 'performance:';
    this.GEOLOCATION_KEY = 'user_locations';
    this.PREFERENCES_PREFIX = 'preferences:';
  }

  // ==================== ONLINE USER MANAGEMENT ====================
  
  async addOnlineUser(userId, userInfo, redisClient) {
    try {
      const userKey = `${this.USER_ACTIVITY_PREFIX}${userId}`;
      const userData = {
        ...userInfo,
        lastSeen: new Date().toISOString(),
        status: 'online',
        joinedAt: new Date().toISOString()
      };

      // Store user data with 5-minute expiration
      await redisClient.setEx(userKey, 300, JSON.stringify(userData));
      
      // Add to online users set
      await redisClient.sAdd(this.ONLINE_USERS_KEY, userId);
      
      // Update daily stats
      await this.updateChatStats('users_online', { userId }, redisClient);
      
      logger.info(`User ${userId} added to online users`);
      return true;
    } catch (error) {
      logger.error('Error adding online user:', error);
      return false;
    }
  }

  async removeOnlineUser(userId, redisClient) {
    try {
      // Remove from online users set
      await redisClient.sRem(this.ONLINE_USERS_KEY, userId);
      
      // Update user status to offline
      const userKey = `${this.USER_ACTIVITY_PREFIX}${userId}`;
      const userData = await redisClient.get(userKey);
      
      if (userData) {
        const user = JSON.parse(userData);
        user.status = 'offline';
        user.lastSeen = new Date().toISOString();
        
        // Store offline status for a short time
        await redisClient.setEx(userKey, 60, JSON.stringify(user));
      }
      
      // Update stats
      await this.updateChatStats('users_offline', { userId }, redisClient);
      
      logger.info(`User ${userId} removed from online users`);
      return true;
    } catch (error) {
      logger.error('Error removing online user:', error);
      return false;
    }
  }

  async getOnlineUserCount(redisClient) {
    try {
      const count = await redisClient.sCard(this.ONLINE_USERS_KEY);
      return count || 0;
    } catch (error) {
      logger.error('Error getting online user count:', error);
      return 0;
    }
  }

  async getOnlineUsers(redisClient, limit = 100) {
    try {
      const userIds = await redisClient.sMembers(this.ONLINE_USERS_KEY);
      const users = [];

      // Limit the number of users to process
      const limitedUserIds = userIds.slice(0, limit);

      for (const userId of limitedUserIds) {
        try {
          const userKey = `${this.USER_ACTIVITY_PREFIX}${userId}`;
          const userData = await redisClient.get(userKey);
          
          if (userData) {
            const user = JSON.parse(userData);
            
            // Check if user is still active (last seen within 5 minutes)
            const lastSeen = new Date(user.lastSeen);
            const now = new Date();
            const timeDiff = now - lastSeen;
            
            if (timeDiff <= 300000) { // 5 minutes
              users.push({
                userId,
                status: user.status,
                lastSeen: user.lastSeen,
                joinedAt: user.joinedAt,
                interests: user.interests || [],
                mode: user.mode || 'text'
              });
            } else {
              // Remove inactive user
              await this.removeOnlineUser(userId, redisClient);
            }
          } else {
            // Remove user with no data
            await redisClient.sRem(this.ONLINE_USERS_KEY, userId);
          }
        } catch (userError) {
          logger.warn(`Error processing user ${userId}:`, userError);
          continue;
        }
      }

      return users;
    } catch (error) {
      logger.error('Error getting online users:', error);
      return [];
    }
  }

  async cleanupInactiveUsers(redisClient) {
    try {
      const userIds = await redisClient.sMembers(this.ONLINE_USERS_KEY);
      let cleanedCount = 0;
      const fiveMinutesAgo = new Date(Date.now() - 300000);

      for (const userId of userIds) {
        try {
          const userKey = `${this.USER_ACTIVITY_PREFIX}${userId}`;
          const userData = await redisClient.get(userKey);
          
          if (!userData) {
            await redisClient.sRem(this.ONLINE_USERS_KEY, userId);
            cleanedCount++;
            continue;
          }

          const user = JSON.parse(userData);
          const lastSeen = new Date(user.lastSeen);
          
          if (lastSeen < fiveMinutesAgo) {
            await this.removeOnlineUser(userId, redisClient);
            cleanedCount++;
          }
        } catch (userError) {
          logger.warn(`Error cleaning up user ${userId}:`, userError);
          await redisClient.sRem(this.ONLINE_USERS_KEY, userId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} inactive users`);
      }
      
      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up inactive users:', error);
      return 0;
    }
  }

  // ==================== CHAT STATISTICS ====================

  async updateChatStats(action, data = {}, redisClient) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();
      const timestamp = Date.now();
      
      // Daily stats
      await redisClient.hIncrBy(`${this.DAILY_STATS_PREFIX}${today}`, action, 1);
      
      // Hourly stats
      await redisClient.hIncrBy(`${this.DAILY_STATS_PREFIX}${today}:hourly`, `${action}:${hour}`, 1);
      
      // Overall stats
      await redisClient.hIncrBy(this.CHAT_STATS_KEY, action, 1);
      await redisClient.hSet(this.CHAT_STATS_KEY, 'last_updated', timestamp);

      // Mode-specific stats
      if (data.mode) {
        await redisClient.hIncrBy(`${this.DAILY_STATS_PREFIX}${today}`, `${action}:${data.mode}`, 1);
      }

      // Store recent activity for real-time stats
      const recentKey = `recent_activity:${action}`;
      await redisClient.lPush(recentKey, JSON.stringify({
        timestamp,
        data
      }));
      await redisClient.lTrim(recentKey, 0, 99); // Keep last 100 activities
      await redisClient.expire(recentKey, 3600); // 1 hour expiry

      return true;
    } catch (error) {
      logger.error('Error updating chat stats:', error);
      return false;
    }
  }

  async getChatStatistics(redisClient) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 604800000).toISOString().split('T')[0];

      const [overallStats, todayStats, yesterdayStats, weekStats] = await Promise.all([
        redisClient.hGetAll(this.CHAT_STATS_KEY),
        redisClient.hGetAll(`${this.DAILY_STATS_PREFIX}${today}`),
        redisClient.hGetAll(`${this.DAILY_STATS_PREFIX}${yesterday}`),
        this.getWeeklyStats(redisClient)
      ]);

      const onlineUsers = await this.getOnlineUserCount(redisClient);
      const queueSize = await redisClient.zCard(this.MATCHING_QUEUE_KEY);

      return {
        overall: this.formatStats(overallStats),
        today: this.formatStats(todayStats),
        yesterday: this.formatStats(yesterdayStats),
        weekly: weekStats,
        realTime: {
          onlineUsers,
          queueSize,
          activeChats: await this.getActiveChatCount(redisClient)
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting chat statistics:', error);
      return {
        overall: {},
        today: {},
        yesterday: {},
        weekly: {},
        realTime: { onlineUsers: 0, queueSize: 0, activeChats: 0 },
        timestamp: new Date().toISOString()
      };
    }
  }

  async getWeeklyStats(redisClient) {
    try {
      const weeklyStats = {};
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today.getTime() - i * 86400000);
        const dateStr = date.toISOString().split('T')[0];
        const dayStats = await redisClient.hGetAll(`${this.DAILY_STATS_PREFIX}${dateStr}`);
        weeklyStats[dateStr] = this.formatStats(dayStats);
      }
      
      return weeklyStats;
    } catch (error) {
      logger.error('Error getting weekly stats:', error);
      return {};
    }
  }

  async getHourlyStats(date, redisClient) {
    try {
      const dateStr = date || new Date().toISOString().split('T')[0];
      const hourlyStats = await redisClient.hGetAll(`${this.DAILY_STATS_PREFIX}${dateStr}:hourly`);
      
      const formatted = {};
      for (const [key, value] of Object.entries(hourlyStats)) {
        const [action, hour] = key.split(':');
        if (!formatted[action]) formatted[action] = {};
        formatted[action][hour] = parseInt(value) || 0;
      }

      return formatted;
    } catch (error) {
      logger.error('Error getting hourly stats:', error);
      return {};
    }
  }

  async getActiveChatCount(redisClient) {
    try {
      // Count active chat sessions
      const sessions = await redisClient.keys('chat_session:*');
      return sessions.length;
    } catch (error) {
      logger.error('Error getting active chat count:', error);
      return 0;
    }
  }

  // ==================== USER ACTIVITY TRACKING ====================

  async trackUserActivity(userId, activity, data = {}, redisClient) {
    try {
      const activityKey = `activity:${userId}:${new Date().toISOString().split('T')[0]}`;
      const activityData = {
        type: activity,
        data,
        timestamp: new Date().toISOString(),
        ip: data.ip || null,
        userAgent: data.userAgent || null
      };

      await redisClient.lPush(activityKey, JSON.stringify(activityData));
      await redisClient.lTrim(activityKey, 0, 199); // Keep last 200 activities
      await redisClient.expire(activityKey, 86400 * 7); // Keep for 1 week
      
      // Update user's last activity
      const userKey = `${this.USER_ACTIVITY_PREFIX}${userId}`;
      await redisClient.hSet(userKey, 'lastActivity', activity);
      await redisClient.hSet(userKey, 'lastActivityTime', Date.now());
      
      // Track activity patterns for spam detection
      await this.updateActivityPattern(userId, activity, redisClient);
      
      return true;
    } catch (error) {
      logger.error('Error tracking user activity:', error);
      return false;
    }
  }

  async getUserActivity(userId, days = 1, redisClient) {
    try {
      const activities = [];
      
      for (let i = 0; i < days; i++) {
        const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        const activityKey = `activity:${userId}:${date}`;
        const dayActivities = await redisClient.lRange(activityKey, 0, -1);
        
        const parsedActivities = dayActivities.map(a => {
          try {
            return JSON.parse(a);
          } catch (parseError) {
            logger.warn('Error parsing activity:', parseError);
            return null;
          }
        }).filter(Boolean);

        if (parsedActivities.length > 0) {
          activities.push({
            date,
            activities: parsedActivities,
            count: parsedActivities.length
          });
        }
      }

      return activities;
    } catch (error) {
      logger.error('Error getting user activity:', error);
      return [];
    }
  }

  async updateActivityPattern(userId, activity, redisClient) {
    try {
      const patternKey = `activity_pattern:${userId}`;
      const now = Date.now();
      
      // Store activity with timestamp
      await redisClient.zAdd(patternKey, {
        score: now,
        value: `${activity}:${now}`
      });
      
      // Keep only last hour of activities
      const oneHourAgo = now - 3600000;
      await redisClient.zRemRangeByScore(patternKey, 0, oneHourAgo);
      await redisClient.expire(patternKey, 3600); // 1 hour expiry
      
      return true;
    } catch (error) {
      logger.error('Error updating activity pattern:', error);
      return false;
    }
  }

  // ==================== QUEUE MANAGEMENT ====================

  async getQueueInfo(redisClient) {
    try {
      const queueSize = await redisClient.zCard(this.MATCHING_QUEUE_KEY);
      const queueMembers = await redisClient.zRangeWithScores(this.MATCHING_QUEUE_KEY, 0, -1);
      
      const queueData = [];
      for (let i = 0; i < queueMembers.length; i++) {
        const member = queueMembers[i];
        const userId = member.value;
        const joinTime = member.score;
        const waitTime = Date.now() - joinTime;
        
        // Get user info
        const userInfo = await redisClient.get(`user:${userId}`);
        let userData = {};
        if (userInfo) {
          try {
            userData = JSON.parse(userInfo);
          } catch (parseError) {
            logger.warn(`Error parsing user data for ${userId}:`, parseError);
          }
        }
        
        queueData.push({
          userId,
          joinTime: new Date(joinTime).toISOString(),
          waitTime: Math.round(waitTime / 1000), // seconds
          mode: userData.mode || 'text',
          interests: userData.interests || [],
          region: userData.region || 'unknown'
        });
      }

      const averageWaitTime = queueData.length > 0 
        ? queueData.reduce((sum, user) => sum + user.waitTime, 0) / queueData.length 
        : 0;

      return {
        size: queueSize,
        queue: queueData,
        averageWaitTime: Math.round(averageWaitTime),
        modeBreakdown: this.getModeBreakdown(queueData),
        regionBreakdown: this.getRegionBreakdown(queueData)
      };
    } catch (error) {
      logger.error('Error getting queue info:', error);
      return { 
        size: 0, 
        queue: [], 
        averageWaitTime: 0,
        modeBreakdown: {},
        regionBreakdown: {}
      };
    }
  }

  getModeBreakdown(queueData) {
    const breakdown = { text: 0, video: 0 };
    queueData.forEach(user => {
      breakdown[user.mode] = (breakdown[user.mode] || 0) + 1;
    });
    return breakdown;
  }

  getRegionBreakdown(queueData) {
    const breakdown = {};
    queueData.forEach(user => {
      breakdown[user.region] = (breakdown[user.region] || 0) + 1;
    });
    return breakdown;
  }

  // ==================== PERFORMANCE MONITORING ====================

  async recordPerformanceMetric(metric, value, redisClient) {
    try {
      const timestamp = Date.now();
      const metricKey = `${this.PERFORMANCE_PREFIX}${metric}`;
      
      const metricData = {
        value: parseFloat(value),
        timestamp,
        date: new Date().toISOString()
      };
      
      // Store last 1000 values for each metric
      await redisClient.lPush(metricKey, JSON.stringify(metricData));
      await redisClient.lTrim(metricKey, 0, 999);
      
      // Set expiry for 24 hours
      await redisClient.expire(metricKey, 86400);
      
      return true;
    } catch (error) {
      logger.error('Error recording performance metric:', error);
      return false;
    }
  }

  async getPerformanceMetrics(metric, redisClient) {
    try {
      const metricKey = `${this.PERFORMANCE_PREFIX}${metric}`;
      const rawData = await redisClient.lRange(metricKey, 0, -1);
      
      if (rawData.length === 0) return null;
      
      const data = rawData.map(d => {
        try {
          return JSON.parse(d);
        } catch (parseError) {
          logger.warn('Error parsing performance data:', parseError);
          return null;
        }
      }).filter(Boolean);
      
      if (data.length === 0) return null;
      
      const values = data.map(d => d.value);
      const timestamps = data.map(d => d.timestamp);
      
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const median = this.calculateMedian(values);
      const percentile95 = this.calculatePercentile(values, 95);
      
      return {
        average: Math.round(avg * 100) / 100,
        minimum: min,
        maximum: max,
        median,
        percentile95,
        count: data.length,
        latest: data[0],
        timeRange: {
          start: new Date(Math.min(...timestamps)).toISOString(),
          end: new Date(Math.max(...timestamps)).toISOString()
        },
        trend: this.calculateTrend(data.slice(0, 10)) // Last 10 data points
      };
    } catch (error) {
      logger.error('Error getting performance metrics:', error);
      return null;
    }
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  calculateTrend(data) {
    if (data.length < 2) return 'stable';
    
    const recent = data.slice(0, Math.ceil(data.length / 2));
    const older = data.slice(Math.ceil(data.length / 2));
    
    const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.value, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  // ==================== CACHE MANAGEMENT ====================

  async setCache(key, value, ttl = 300, redisClient) {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      const cacheData = {
        value,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
      };
      
      await redisClient.setEx(cacheKey, ttl, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      logger.error('Error setting cache:', error);
      return false;
    }
  }

  async getCache(key, redisClient) {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${key}`;
      const cached = await redisClient.get(cacheKey);
      
      if (!cached) return null;
      
      const cacheData = JSON.parse(cached);
      return cacheData.value;
    } catch (error) {
      logger.error('Error getting cache:', error);
      return null;
    }
  }

  async invalidateCache(pattern, redisClient) {
    try {
      const keys = await redisClient.keys(`${this.CACHE_PREFIX}${pattern}*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return keys.length;
    } catch (error) {
      logger.error('Error invalidating cache:', error);
      return 0;
    }
  }

  async getCacheStats(redisClient) {
    try {
      const keys = await redisClient.keys(`${this.CACHE_PREFIX}*`);
      let totalSize = 0;
      let expiredCount = 0;
      
      for (const key of keys) {
        const ttl = await redisClient.ttl(key);
        if (ttl === -2) {
          expiredCount++;
        }
        
        const size = await redisClient.memory('usage', key);
        totalSize += size || 0;
      }
      
      return {
        totalKeys: keys.length,
        expiredKeys: expiredCount,
        totalSize,
        hitRate: await this.getCacheHitRate(redisClient)
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return { totalKeys: 0, expiredKeys: 0, totalSize: 0, hitRate: 0 };
    }
  }

  async getCacheHitRate(redisClient) {
    try {
      const info = await redisClient.info('stats');
      const lines = info.split('\r\n');
      let hits = 0, misses = 0;
      
      for (const line of lines) {
        if (line.startsWith('keyspace_hits:')) {
          hits = parseInt(line.split(':')[1]) || 0;
        } else if (line.startsWith('keyspace_misses:')) {
          misses = parseInt(line.split(':')[1]) || 0;
        }
      }
      
      const total = hits + misses;
      return total > 0 ? Math.round((hits / total) * 100) : 0;
    } catch (error) {
      logger.error('Error calculating cache hit rate:', error);
      return 0;
    }
  }

  // ==================== PUB/SUB FOR REAL-TIME FEATURES ====================

  async publishEvent(channel, data, redisClient) {
    try {
      const eventData = {
        ...data,
        timestamp: new Date().toISOString(),
        eventId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      const published = await redisClient.publish(channel, JSON.stringify(eventData));
      
      if (published > 0) {
        logger.debug(`Event published to ${channel}: ${eventData.eventId}`);
      }
      
      return published;
    } catch (error) {
      logger.error('Error publishing event:', error);
      return 0;
    }
  }

  async subscribeToChannel(channel, callback, redisClient) {
    try {
      const subscriber = redisClient.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe(channel, (message) => {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch (parseError) {
          logger.error('Error parsing subscribed message:', parseError);
          callback({ error: 'Invalid message format', raw: message });
        }
      });
      
      logger.info(`Subscribed to channel: ${channel}`);
      return subscriber;
    } catch (error) {
      logger.error('Error subscribing to channel:', error);
      return null;
    }
  }

  // ==================== GEOLOCATION FEATURES ====================

  async addUserLocation(userId, latitude, longitude, redisClient) {
    try {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      // Validate coordinates
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error('Invalid coordinates');
      }
      
      await redisClient.geoAdd(this.GEOLOCATION_KEY, {
        longitude: lng,
        latitude: lat,
        member: userId
      });
      
      // Store additional location metadata
      const locationKey = `location:${userId}`;
      const locationData = {
        latitude: lat,
        longitude: lng,
        updatedAt: new Date().toISOString(),
        accuracy: 'approximate' // Could be enhanced with actual accuracy data
      };
      
      await redisClient.setEx(locationKey, 3600, JSON.stringify(locationData)); // 1 hour expiry
      
      return true;
    } catch (error) {
      logger.error('Error adding user location:', error);
      return false;
    }
  }

  async findNearbyUsers(userId, radiusKm = 50, limit = 10, redisClient) {
    try {
      const nearby = await redisClient.geoRadius(this.GEOLOCATION_KEY, {
        member: userId,
        radius: radiusKm,
        unit: 'km',
        withDist: true,
        withCoord: true,
        count: limit + 1 // +1 because it includes the user themselves
      });
      
      // Filter out the user themselves and format results
      const nearbyUsers = nearby
        .filter(user => user.member !== userId)
        .map(user => ({
          userId: user.member,
          distance: Math.round(parseFloat(user.distance) * 100) / 100, // Round to 2 decimals
          coordinates: user.coordinates,
          distanceUnit: 'km'
        }))
        .slice(0, limit);
      
      return nearbyUsers;
    } catch (error) {
      logger.error('Error finding nearby users:', error);
      return [];
    }
  }

  async getUserLocation(userId, redisClient) {
    try {
      const locationKey = `location:${userId}`;
      const locationData = await redisClient.get(locationKey);
      
      if (!locationData) return null;
      
      return JSON.parse(locationData);
    } catch (error) {
      logger.error('Error getting user location:', error);
      return null;
    }
  }

  // ==================== ADVANCED MATCHING FEATURES ====================

  async updateMatchingPreferences(userId, preferences, redisClient) {
    try {
      const prefKey = `${this.PREFERENCES_PREFIX}${userId}`;
      const prefData = {
        ...preferences,
        updatedAt: new Date().toISOString(),
        version: 1
      };
      
      await redisClient.setEx(prefKey, 3600, JSON.stringify(prefData)); // 1 hour expiry
      
      return true;
    } catch (error) {
      logger.error('Error updating matching preferences:', error);
      return false;
    }
  }

  async getMatchingPreferences(userId, redisClient) {
    try {
      const prefKey = `${this.PREFERENCES_PREFIX}${userId}`;
      const prefs = await redisClient.get(prefKey);
      
      if (!prefs) return null;
      
      return JSON.parse(prefs);
    } catch (error) {
      logger.error('Error getting matching preferences:', error);
      return null;
    }
  }

  // ==================== CONNECTION QUALITY TRACKING ====================

  async trackConnectionQuality(userId, quality, metadata = {}, redisClient) {
    try {
      const qualityKey = `${this.CONNECTION_QUALITY_PREFIX}${userId}`;
      const qualityData = {
        quality: parseFloat(quality),
        timestamp: Date.now(),
        userId,
        metadata: {
          ...metadata,
          userAgent: metadata.userAgent || null,
          platform: metadata.platform || null,
          connectionType: metadata.connectionType || null
        }
      };
      
      await redisClient.lPush(qualityKey, JSON.stringify(qualityData));
      await redisClient.lTrim(qualityKey, 0, 49); // Keep last 50 measurements
      await redisClient.expire(qualityKey, 7200); // 2 hours expiry
      
      return true;
    } catch (error) {
      logger.error('Error tracking connection quality:', error);
      return false;
    }
  }

  async getAverageConnectionQuality(userId, redisClient) {
    try {
      const qualityKey = `${this.CONNECTION_QUALITY_PREFIX}${userId}`;
      const measurements = await redisClient.lRange(qualityKey, 0, -1);
      
      if (measurements.length === 0) return null;
      
      const qualities = measurements.map(m => {
        try {
          return JSON.parse(m);
        } catch (parseError) {
          logger.warn('Error parsing quality measurement:', parseError);
          return null;
        }
      }).filter(Boolean);
      
      if (qualities.length === 0) return null;
      
      const qualityValues = qualities.map(q => q.quality);
      const average = qualityValues.reduce((sum, q) => sum + q, 0) / qualityValues.length;
      
      return {
        average: Math.round(average * 100) / 100,
        sampleCount: qualities.length,
        latest: qualities[0],
        trend: this.calculateQualityTrend(qualities),
        distribution: this.getQualityDistribution(qualityValues)
      };
    } catch (error) {
      logger.error('Error getting connection quality:', error);
      return null;
    }
  }

  calculateQualityTrend(qualities) {
    if (qualities.length < 5) return 'insufficient_data';
    
    const recent = qualities.slice(0, 3).map(q => q.quality);
    const older = qualities.slice(-3).map(q => q.quality);
    
    const recentAvg = recent.reduce((sum, q) => sum + q, 0) / recent.length;
    const olderAvg = older.reduce((sum, q) => sum + q, 0) / older.length;
    
    const change = recentAvg - olderAvg;
    
    if (change > 0.2) return 'improving';
    if (change < -0.2) return 'degrading';
    return 'stable';
  }

  getQualityDistribution(qualityValues) {
    const distribution = { poor: 0, fair: 0, good: 0, excellent: 0 };
    
    qualityValues.forEach(quality => {
      if (quality < 2) distribution.poor++;
      else if (quality < 3) distribution.fair++;
      else if (quality < 4) distribution.good++;
      else distribution.excellent++;
    });
    
    return distribution;
  }

  // ==================== SPAM DETECTION ====================

  async trackUserBehavior(userId, action, metadata = {}, redisClient) {
    try {
      const behaviorKey = `${this.BEHAVIOR_TRACKING_PREFIX}${userId}`;
      const behaviorData = {
        action,
        metadata,
        timestamp: Date.now(),
        ip: metadata.ip || null,
        userAgent: metadata.userAgent || null
      };
      
      await redisClient.lPush(behaviorKey, JSON.stringify(behaviorData));
      await redisClient.lTrim(behaviorKey, 0, 199); // Keep last 200 actions
      await redisClient.expire(behaviorKey, 86400); // 24 hours
      
      // Check for spam patterns
      const isSpam = await this.checkSpamPatterns(userId, redisClient);
      
      if (isSpam) {
        await this.publishEvent('spam_detected', {
          userId,
          action,
          severity: 'medium',
          timestamp: new Date().toISOString()
        }, redisClient);
      }
      
      return !isSpam;
    } catch (error) {
      logger.error('Error tracking user behavior:', error);
      return true; // Allow action on error
    }
  }

  async checkSpamPatterns(userId, redisClient) {
    try {
      const behaviorKey = `${this.BEHAVIOR_TRACKING_PREFIX}${userId}`;
      const recentActions = await redisClient.lRange(behaviorKey, 0, 49); // Last 50 actions
      
      if (recentActions.length < 5) return false;
      
      const actions = recentActions.map(a => {
        try {
          return JSON.parse(a);
        } catch (parseError) {
          return null;
        }
      }).filter(Boolean);
      
      const now = Date.now();
      const fiveMinutesAgo = now - 300000;
      const oneMinuteAgo = now - 60000;
      
      // Count recent actions
      const recentCount = actions.filter(a => a.timestamp > fiveMinutesAgo).length;
      const veryRecentCount = actions.filter(a => a.timestamp > oneMinuteAgo).length;
      
      // Check for various spam patterns
      const patterns = {
        highFrequency: recentCount > 25, // More than 25 actions in 5 minutes
        burstActivity: veryRecentCount > 10, // More than 10 actions in 1 minute
        repetitiveActions: this.checkRepetitiveActions(actions),
        suspiciousUserAgent: this.checkSuspiciousUserAgent(actions)
      };
      
      const spamScore = Object.values(patterns).filter(Boolean).length;
      
      if (spamScore >= 2) {
        const reason = Object.keys(patterns).filter(key => patterns[key]).join(', ');
        await this.flagUserAsSpammer(userId, reason, 'medium', redisClient);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error checking spam patterns:', error);
      return false;
    }
  }

  checkRepetitiveActions(actions) {
    if (actions.length < 10) return false;
    
    const recent10 = actions.slice(0, 10);
    const actionTypes = recent10.map(a => a.action);
    const uniqueActions = new Set(actionTypes).size;
    
    // If less than 3 unique actions in last 10, it's repetitive
    return uniqueActions < 3;
  }

  checkSuspiciousUserAgent(actions) {
    const userAgents = actions
      .map(a => a.userAgent)
      .filter(Boolean);
    
    if (userAgents.length === 0) return false;
    
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /headless/i,
      /phantom/i,
      /selenium/i
    ];
    
    return userAgents.some(ua => 
      suspiciousPatterns.some(pattern => pattern.test(ua))
    );
  }

  async flagUserAsSpammer(userId, reason, severity = 'medium', redisClient) {
    try {
      const spamKey = `${this.SPAM_FLAGS_PREFIX}${userId}`;
      const spamData = {
        reason,
        severity,
        flaggedAt: new Date().toISOString(),
        flaggedBy: 'system',
        autoFlagged: true,
        score: this.calculateSpamScore(severity)
      };
      
      const duration = severity === 'high' ? 7200 : 3600; // 2 hours for high, 1 hour for medium
      await redisClient.setEx(spamKey, duration, JSON.stringify(spamData));
      
      // Track spam statistics
      await this.updateChatStats('spam_detected', { userId, reason, severity }, redisClient);
      
      logger.warn(`User flagged as spammer: ${userId} - ${reason} (${severity})`);
      
      return true;
    } catch (error) {
      logger.error('Error flagging user as spammer:', error);
      return false;
    }
  }

  calculateSpamScore(severity) {
    const scores = { low: 1, medium: 3, high: 5, critical: 10 };
    return scores[severity] || 1;
  }

  async isUserFlaggedAsSpam(userId, redisClient) {
    try {
      const spamKey = `${this.SPAM_FLAGS_PREFIX}${userId}`;
      const spamData = await redisClient.get(spamKey);
      
      if (!spamData) return false;
      
      return JSON.parse(spamData);
    } catch (error) {
      logger.error('Error checking spam flag:', error);
      return false;
    }
  }

  // ==================== LOAD BALANCING HELPERS ====================

  async getServerLoad(serverId, redisClient) {
    try {
      const loadKey = `${this.SERVER_LOAD_PREFIX}${serverId}`;
      const loadData = await redisClient.get(loadKey);
      
      if (!loadData) return null;
      
      return JSON.parse(loadData);
    } catch (error) {
      logger.error('Error getting server load:', error);
      return null;
    }
  }

  async updateServerLoad(serverId, loadData, redisClient) {
    try {
      const loadKey = `${this.SERVER_LOAD_PREFIX}${serverId}`;
      const enhancedLoadData = {
        ...loadData,
        serverId,
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now()
      };
      
      await redisClient.setEx(loadKey, 120, JSON.stringify(enhancedLoadData)); // 2 minutes expiry
      
      return true;
    } catch (error) {
      logger.error('Error updating server load:', error);
      return false;
    }
  }

  async getAllServerLoads(redisClient) {
    try {
      const loadKeys = await redisClient.keys(`${this.SERVER_LOAD_PREFIX}*`);
      const loads = {};
      
      for (const key of loadKeys) {
        const serverId = key.replace(this.SERVER_LOAD_PREFIX, '');
        const loadData = await redisClient.get(key);
        
        if (loadData) {
          loads[serverId] = JSON.parse(loadData);
        }
      }
      
      return loads;
    } catch (error) {
      logger.error('Error getting all server loads:', error);
      return {};
    }
  }

  // ==================== EMERGENCY CONTROLS ====================

  async enableEmergencyMode(reason, enabledBy = 'system', redisClient) {
    try {
      const emergencyData = {
        enabled: true,
        reason,
        enabledAt: new Date().toISOString(),
        enabledBy,
        level: 'high',
        restrictions: {
          newConnections: false,
          videoChat: false,
          messageThrottling: true
        }
      };
      
      await redisClient.set(this.EMERGENCY_MODE_KEY, JSON.stringify(emergencyData));
      
      // Publish emergency event
      await this.publishEvent('system_alerts', {
        type: 'emergency_mode_enabled',
        data: emergencyData
      }, redisClient);
      
      logger.error(`Emergency mode enabled: ${reason} by ${enabledBy}`);
      return true;
    } catch (error) {
      logger.error('Error enabling emergency mode:', error);
      return false;
    }
  }

  async isEmergencyMode(redisClient) {
    try {
      const emergencyData = await redisClient.get(this.EMERGENCY_MODE_KEY);
      if (!emergencyData) return false;
      
      const data = JSON.parse(emergencyData);
      return data.enabled === true;
    } catch (error) {
      logger.error('Error checking emergency mode:', error);
      return false;
    }
  }

  async getEmergencyModeDetails(redisClient) {
    try {
      const emergencyData = await redisClient.get(this.EMERGENCY_MODE_KEY);
      if (!emergencyData) return null;
      
      return JSON.parse(emergencyData);
    } catch (error) {
      logger.error('Error getting emergency mode details:', error);
      return null;
    }
  }

  async disableEmergencyMode(disabledBy = 'system', redisClient) {
    try {
      await redisClient.del(this.EMERGENCY_MODE_KEY);
      
      // Publish emergency resolved event
      await this.publishEvent('system_alerts', {
        type: 'emergency_mode_disabled',
        disabledBy,
        disabledAt: new Date().toISOString()
      }, redisClient);
      
      logger.info(`Emergency mode disabled by ${disabledBy}`);
      return true;
    } catch (error) {
      logger.error('Error disabling emergency mode:', error);
      return false;
    }
  }

  // ==================== CLEANUP OPERATIONS ====================

  async cleanupExpiredSessions(redisClient) {
    try {
      const sessionKeys = await redisClient.keys(`${this.USER_SESSIONS_PREFIX}*`);
      let cleanedCount = 0;

      for (const key of sessionKeys) {
        try {
          const ttl = await redisClient.ttl(key);
          if (ttl === -2) { // Key expired
            await redisClient.del(key);
            cleanedCount++;
          } else if (ttl === -1) { // Key exists but has no expiry
            // Check if session is old
            const sessionData = await redisClient.get(key);
            if (sessionData) {
              const session = JSON.parse(sessionData);
              const createdAt = new Date(session.createdAt || session.lastActive || 0);
              const now = new Date();
              const ageHours = (now - createdAt) / (1000 * 60 * 60);
              
              if (ageHours > 24) { // Older than 24 hours
                await redisClient.del(key);
                cleanedCount++;
              } else {
                // Set expiry for future cleanup
                await redisClient.expire(key, 86400); // 24 hours
              }
            }
          }
        } catch (keyError) {
          logger.warn(`Error processing session key ${key}:`, keyError);
          continue;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired sessions`);
      }
      
      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  async cleanupOldStatistics(daysToKeep = 30, redisClient) {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 86400000);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      const statKeys = await redisClient.keys(`${this.DAILY_STATS_PREFIX}*`);
      let cleanedCount = 0;

      for (const key of statKeys) {
        try {
          const dateMatch = key.match(/daily_stats:(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            const keyDate = dateMatch[1];
            if (keyDate < cutoffDateStr) {
              await redisClient.del(key);
              cleanedCount++;
            }
          }
        } catch (keyError) {
          logger.warn(`Error processing stat key ${key}:`, keyError);
          continue;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old statistics`);
      }
      
      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up old statistics:', error);
      return 0;
    }
  }

  async performMaintenanceCleanup(redisClient) {
    try {
      logger.info('Starting maintenance cleanup...');
      
      const results = await Promise.allSettled([
        this.cleanupInactiveUsers(redisClient),
        this.cleanupExpiredSessions(redisClient),
        this.cleanupOldStatistics(30, redisClient),
        this.invalidateCache('temp_*', redisClient)
      ]);
      
      const summary = {
        inactiveUsers: results[0].status === 'fulfilled' ? results[0].value : 0,
        expiredSessions: results[1].status === 'fulfilled' ? results[1].value : 0,
        oldStatistics: results[2].status === 'fulfilled' ? results[2].value : 0,
        tempCache: results[3].status === 'fulfilled' ? results[3].value : 0,
        timestamp: new Date().toISOString()
      };
      
      logger.info('Maintenance cleanup completed:', summary);
      return summary;
    } catch (error) {
      logger.error('Error performing maintenance cleanup:', error);
      return null;
    }
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(redisClient) {
    try {
      const start = Date.now();
      await redisClient.ping();
      const latency = Date.now() - start;

      const [info, memory, stats] = await Promise.all([
        redisClient.info(),
        redisClient.info('memory'),
        redisClient.info('stats')
      ]);

      const memoryInfo = this.parseRedisInfo(memory);
      const statsInfo = this.parseRedisInfo(stats);
      const serverInfo = this.parseRedisInfo(info);

      return {
        status: 'healthy',
        latency,
        memory: {
          used: memoryInfo.used_memory_human,
          peak: memoryInfo.used_memory_peak_human,
          rss: memoryInfo.used_memory_rss_human,
          fragmentation: memoryInfo.mem_fragmentation_ratio
        },
        stats: {
          totalConnections: statsInfo.total_connections_received,
          totalCommands: statsInfo.total_commands_processed,
          instantaneousOps: statsInfo.instantaneous_ops_per_sec,
          keyspaceHits: statsInfo.keyspace_hits,
          keyspaceMisses: statsInfo.keyspace_misses
        },
        server: {
          version: serverInfo.redis_version,
          uptime: serverInfo.uptime_in_seconds,
          connectedClients: serverInfo.connected_clients
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ==================== HELPER METHODS ====================

  formatStats(stats) {
    const formatted = {};
    for (const [key, value] of Object.entries(stats)) {
      const numValue = parseInt(value);
      formatted[key] = isNaN(numValue) ? value : numValue;
    }
    return formatted;
  }

  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const parsed = {};
    
    for (const line of lines) {
      if (line.includes(':') && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value !== undefined) {
          // Try to parse as number, keep as string if not
          const numValue = parseFloat(value);
          parsed[key] = isNaN(numValue) ? value : numValue;
        }
      }
    }
    
    return parsed;
  }

  // ==================== BATCH OPERATIONS ====================

  async batchSet(operations, redisClient) {
    try {
      const pipeline = redisClient.multi();
      
      for (const op of operations) {
        switch (op.type) {
          case 'set':
            pipeline.set(op.key, JSON.stringify(op.value));
            break;
          case 'setex':
            pipeline.setEx(op.key, op.ttl || 3600, JSON.stringify(op.value));
            break;
          case 'incr':
            pipeline.incr(op.key);
            break;
          case 'hincrby':
            pipeline.hIncrBy(op.key, op.field, op.increment || 1);
            break;
          case 'del':
            pipeline.del(op.key);
            break;
          case 'expire':
            pipeline.expire(op.key, op.ttl || 3600);
            break;
          case 'sadd':
            pipeline.sAdd(op.key, op.members);
            break;
          case 'zadd':
            pipeline.zAdd(op.key, op.members);
            break;
          default:
            logger.warn(`Unknown batch operation type: ${op.type}`);
        }
      }
      
      const results = await pipeline.exec();
      
      logger.debug(`Batch operation completed: ${operations.length} operations`);
      return results;
    } catch (error) {
      logger.error('Error in batch operations:', error);
      return null;
    }
  }

  // ==================== EXPORT/IMPORT DATA ====================

  async exportData(pattern = '*', redisClient) {
    try {
      const keys = await redisClient.keys(pattern);
      const data = {};
      const batchSize = 100;
      
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        for (const key of batch) {
          try {
            const [value, ttl, type] = await Promise.all([
              redisClient.get(key),
              redisClient.ttl(key),
              redisClient.type(key)
            ]);
            
            data[key] = {
              value,
              ttl: ttl > 0 ? ttl : null,
              type,
              exportedAt: new Date().toISOString()
            };
          } catch (keyError) {
            logger.warn(`Error exporting key ${key}:`, keyError);
            continue;
          }
        }
      }
      
      return {
        exportDate: new Date().toISOString(),
        keyCount: Object.keys(data).length,
        pattern,
        data
      };
    } catch (error) {
      logger.error('Error exporting data:', error);
      return null;
    }
  }

  async importData(exportData, redisClient) {
    try {
      let importedCount = 0;
      const operations = [];
      
      for (const [key, item] of Object.entries(exportData.data)) {
        const operation = {
          type: 'setex',
          key,
          value: item.value,
          ttl: item.ttl || 3600
        };
        
        operations.push(operation);
        
        // Process in batches
        if (operations.length >= 100) {
          await this.batchSet(operations, redisClient);
          importedCount += operations.length;
          operations.length = 0; // Clear array
        }
      }
      
      // Process remaining operations
      if (operations.length > 0) {
        await this.batchSet(operations, redisClient);
        importedCount += operations.length;
      }
      
      logger.info(`Imported ${importedCount} keys from backup`);
      return importedCount;
    } catch (error) {
      logger.error('Error importing data:', error);
      return 0;
    }
  }
}

module.exports = new RedisService();