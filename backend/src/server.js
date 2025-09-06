const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

// Import logger and chat service
const logger = require('./Loaders/Logger');
const { createChatService } = require('./services/ChatService');

// Create Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware setup
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Session-ID']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Too many chat requests. Please slow down.' }
});

const userLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: 'Too many user actions. Please wait a moment.' }
});

const moderationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'Too many moderation actions. Please wait.' }
});

// Services initialization
let redisClient = null;
let mongoConnected = false;
let chatService = null;

async function initializeServices() {
  try {
    // Redis connection
    if (process.env.REDIS_URL) {
      const { createClient } = require('redis');
      redisClient = createClient({
        url: process.env.REDIS_URL
      });
      
      redisClient.on('error', (err) => {
        logger.error('Redis error:', err.message);
        console.log('Redis error:', err.message);
      });
      
      await redisClient.connect();
      logger.info('✅ Connected to Redis');
      console.log('✅ Connected to Redis');
      
      // Initialize chat service with Redis
      chatService = createChatService(redisClient);
      logger.info('✅ Chat service initialized with Redis');
      console.log('✅ Chat service initialized with Redis');
    } else {
      // Initialize chat service without Redis (will use MongoDB only)
      chatService = createChatService(null);
      logger.info('✅ Chat service initialized without Redis (MongoDB only)');
      console.log('✅ Chat service initialized without Redis');
    }
    
    // MongoDB connection
    if (process.env.MONGODB_URI) {
      const mongoose = require('mongoose');
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      mongoConnected = true;
      logger.info('✅ Connected to MongoDB');
      console.log('✅ Connected to MongoDB');
    }
    
  } catch (error) {
    logger.error('⚠️  Service initialization error:', error.message);
    console.log('⚠️  Service initialization error:', error.message);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      redis: redisClient ? 'connected' : 'disconnected',
      mongodb: mongoConnected ? 'connected' : 'disconnected',
      chatService: chatService ? 'initialized' : 'not initialized'
    }
  });
});

// Apply general rate limiting to API routes
app.use('/api', generalLimiter);

// =========================
// CHAT ROUTES
// =========================
app.get('/api/chat/test', chatLimiter, (req, res) => {
  res.json({ 
    message: 'Chat routes working',
    timestamp: new Date().toISOString(),
    endpoint: 'chat/test'
  });
});

app.post('/api/chat/send-message', chatLimiter, async (req, res) => {
  const { content, to, roomId } = req.body;
  
  if (!content || !to) {
    return res.status(400).json({ error: 'Content and recipient required' });
  }
  
  try {
    if (chatService && roomId) {
      const message = await chatService.sendMessage({
        roomId,
        senderId: req.body.senderId || 'api-user',
        recipientId: to,
        content,
        type: 'text'
      });
      
      res.json({ 
        success: true, 
        message: 'Message sent and saved',
        messageData: message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({ 
        success: true, 
        message: 'Message sent',
        messageId: Date.now().toString(),
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error sending message via API:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send message' 
    });
  }
});

app.post('/api/chat/report', chatLimiter, (req, res) => {
  const { reportedUserId, reason, description } = req.body;
  
  if (!reportedUserId || !reason) {
    return res.status(400).json({ error: 'Reported user ID and reason required' });
  }
  
  res.json({ 
    success: true, 
    message: 'Report submitted',
    reportId: `report_${Date.now()}`,
    timestamp: new Date().toISOString()
  });
});

// Get chat statistics
app.get('/api/chat/stats', async (req, res) => {
  try {
    if (chatService) {
      const stats = await chatService.getStats();
      res.json({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        stats: { message: 'Chat service not initialized' },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error getting chat stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat statistics'
    });
  }
});

// =========================
// USER ROUTES  
// =========================
app.get('/api/user/test', userLimiter, (req, res) => {
  res.json({ 
    message: 'User routes working',
    timestamp: new Date().toISOString(),
    endpoint: 'user/test'
  });
});

app.post('/api/user/session', userLimiter, (req, res) => {
  const { sessionId, interests, mode } = req.body;
  
  const session = {
    sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
    interests: interests || [],
    mode: mode || 'text',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour
  };
  
  res.json({
    success: true,
    ...session
  });
});

app.get('/api/user/interests', userLimiter, (req, res) => {
  const interests = [
    'Music', 'Movies', 'Gaming', 'Technology', 'Sports', 'Art', 'Books',
    'Travel', 'Food', 'Photography', 'Science', 'Nature', 'Fitness',
    'Anime', 'Programming', 'Fashion', 'Cooking', 'Dancing', 'Writing',
    'Memes', 'Politics', 'History', 'Philosophy', 'Languages', 'Pets'
  ];
  
  res.json({
    success: true,
    interests,
    count: interests.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/user/online-count', userLimiter, (req, res) => {
  const onlineCount = connectedUsers.size;
  const queueCount = matchingQueue.textQueue.length + matchingQueue.videoQueue.length;
  
  res.json({
    success: true,
    onlineUsers: onlineCount,
    queueStats: {
      totalInQueue: queueCount,
      textUsers: matchingQueue.textQueue.length,
      videoUsers: matchingQueue.videoQueue.length,
      averageWaitTime: Math.floor(Math.random() * 30) + 10
    },
    timestamp: new Date().toISOString()
  });
});

// =========================
// MODERATION ROUTES
// =========================
app.get('/api/moderation/test', moderationLimiter, (req, res) => {
  res.json({ 
    message: 'Moderation routes working',
    timestamp: new Date().toISOString(),
    endpoint: 'moderation/test'
  });
});

app.post('/api/moderation/check-content', moderationLimiter, (req, res) => {
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  // Simple content moderation
  const flaggedWords = ['spam', 'scam', 'fraud', 'hack', 'fake'];
  const contentLower = content.toLowerCase();
  const flagged = flaggedWords.some(word => contentLower.includes(word));
  
  const response = {
    success: true,
    flagged,
    categories: flagged ? ['inappropriate-content'] : [],
    confidence: flagged ? Math.floor(Math.random() * 50) + 50 : Math.floor(Math.random() * 30),
    action: flagged ? 'blocked' : 'approved',
    timestamp: new Date().toISOString()
  };
  
  res.json(response);
});

app.post('/api/moderation/report-user', moderationLimiter, (req, res) => {
  const { userId, reason, evidence } = req.body;
  
  if (!userId || !reason) {
    return res.status(400).json({ error: 'User ID and reason are required' });
  }
  
  const validReasons = ['inappropriate-content', 'harassment', 'spam', 'underage', 'other'];
  if (!validReasons.includes(reason)) {
    return res.status(400).json({ error: 'Invalid report reason' });
  }
  
  res.json({
    success: true,
    message: 'User report submitted successfully',
    reportId: `user_report_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/moderation/stats', moderationLimiter, (req, res) => {
  const stats = {
    today: {
      reports: Math.floor(Math.random() * 50) + 10,
      blockedContent: Math.floor(Math.random() * 20) + 5,
      bannedUsers: Math.floor(Math.random() * 5)
    },
    total: {
      reports: Math.floor(Math.random() * 1000) + 500,
      blockedContent: Math.floor(Math.random() * 300) + 100,
      bannedUsers: Math.floor(Math.random() * 50) + 10
    },
    timestamp: new Date().toISOString()
  };
  
  res.json({
    success: true,
    stats
  });
});

// =========================
// SOCKET.IO MATCHING LOGIC
// =========================
const connectedUsers = new Map();
const matchingQueue = {
  textQueue: [],
  videoQueue: []
};
const activeMatches = new Map(); // Map of roomId -> {user1, user2}

// Helper function to find common interests
function findCommonInterests(interests1, interests2) {
  if (!interests1 || !interests2) return [];
  const set1 = new Set(interests1.map(i => i.toLowerCase()));
  const set2 = new Set(interests2.map(i => i.toLowerCase()));
  return [...set1].filter(interest => set2.has(interest));
}

// Helper function to calculate compatibility score
function calculateCompatibility(user1, user2) {
  const commonInterests = findCommonInterests(user1.interests, user2.interests);
  return commonInterests.length;
}

// Helper function to find best match
function findBestMatch(user, queue) {
  if (queue.length === 0) return null;
  
  let bestMatch = null;
  let bestScore = -1;
  let bestIndex = -1;
  
  for (let i = 0; i < queue.length; i++) {
    const candidate = queue[i];
    if (candidate.socketId === user.socketId) continue; // Don't match with self
    
    const score = calculateCompatibility(user, candidate);
    if (score > bestScore) {
      bestMatch = candidate;
      bestScore = score;
      bestIndex = i;
    }
  }
  
  // If no perfect match, just take the first available user
  if (bestMatch) {
    queue.splice(bestIndex, 1); // Remove from queue
    return bestMatch;
  }
  
  return null;
}

// Replace your entire createMatch function with this:
function createMatch(user1, user2) {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  const commonInterests = findCommonInterests(user1.interests, user2.interests);
  
  console.log('🔨 Creating match between:', user1.socketId, 'and', user2.socketId);
  
  // Store the match
  activeMatches.set(roomId, {
    user1: user1.socketId,
    user2: user2.socketId,
    createdAt: new Date(),
    mode: user1.mode,
    commonInterests
  });
  
  // Update user statuses
  const connectedUser1 = connectedUsers.get(user1.socketId);
  const connectedUser2 = connectedUsers.get(user2.socketId);
  
  if (connectedUser1) {
    connectedUsers.set(user1.socketId, {
      ...connectedUser1,
      isMatched: true,
      currentMatch: user2.socketId,
      roomId,
      inQueue: false
    });
  }
  
  if (connectedUser2) {
    connectedUsers.set(user2.socketId, {
      ...connectedUser2,
      isMatched: true,
      currentMatch: user1.socketId,
      roomId,
      inQueue: false
    });
  }
  
  // Get socket instances
  const socket1 = io.sockets.sockets.get(user1.socketId);
  const socket2 = io.sockets.sockets.get(user2.socketId);
  
  if (socket1 && socket2) {
    // Join room
    socket1.join(roomId);
    socket2.join(roomId);
    
    // CRITICAL: Send DIFFERENT sendOffer values to each user
    // Create separate objects to avoid reference issues
    const matchDataForUser1 = {
      partnerId: user2.socketId,
      commonInterests: commonInterests,
      mode: user1.mode,
      sendOffer: true,  // User1 ALWAYS initiates
      roomId: roomId
    };
    
    const matchDataForUser2 = {
      partnerId: user1.socketId,
      commonInterests: commonInterests,
      mode: user2.mode,
      sendOffer: false, // User2 ALWAYS receives
      roomId: roomId
    };
    
    // Send to each user
    socket1.emit('match-found', matchDataForUser1);
    socket2.emit('match-found', matchDataForUser2);
    
    console.log(`💑 Match created successfully!`);
    console.log(`📤 Sent to ${user1.socketId}: sendOffer=TRUE (initiator)`);
    console.log(`📤 Sent to ${user2.socketId}: sendOffer=FALSE (receiver)`);
    
    logger.info(`💑 Match created: ${user1.socketId} (initiator) ↔ ${user2.socketId} (receiver) (Room: ${roomId})`);
    
    return true;
  }
  
  console.error('❌ Failed to create match - one or both sockets not found');
  return false;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`👤 User connected: ${socket.id}`);
  console.log(`👤 User connected: ${socket.id}`);
  
  // Add user to connected users
  connectedUsers.set(socket.id, {
    socketId: socket.id,
    joinedAt: new Date(),
    isMatched: false,
    currentMatch: null,
    interests: [],
    mode: 'text',
    inQueue: false,
    roomId: null
  });

  // Handle user joining with data
  socket.on('user-join', (userData) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.set(socket.id, {
        ...user,
        ...userData,
        joinedAt: new Date()
      });
    }
    logger.info(`✅ User ${socket.id} joined with data:`, userData);
    console.log(`✅ User ${socket.id} joined with data:`, userData);
  });

 // Also update your join-queue handler to clean up any existing queue entries:
socket.on('join-queue', (queueData) => {
  logger.info(`🔍 User ${socket.id} joined queue:`, queueData);
  console.log(`🔍 User ${socket.id} joined queue:`, queueData);
  
  const user = connectedUsers.get(socket.id);
  if (!user) {
    console.error(`❌ User ${socket.id} not found in connectedUsers`);
    return;
  }
  
  // Update user data
  const updatedUser = {
    ...user,
    interests: queueData.interests || [],
    mode: queueData.mode || 'text',
    inQueue: true
  };
  connectedUsers.set(socket.id, updatedUser);
  
  // Determine which queue to use
  const queue = queueData.mode === 'video' ? matchingQueue.videoQueue : matchingQueue.textQueue;
  
  // IMPORTANT: Remove any existing entries for this user first
  const existingIndex = queue.findIndex(q => q.socketId === socket.id);
  if (existingIndex !== -1) {
    queue.splice(existingIndex, 1);
    console.log(`🔄 Removed duplicate entry for ${socket.id} from queue`);
  }
  
  // Create queue entry
  const queueUser = {
    socketId: socket.id,
    interests: queueData.interests || [],
    mode: queueData.mode || 'text',
    joinedQueueAt: new Date()
  };
  
  // Try to find a match immediately
  const match = findBestMatch(queueUser, queue);
  
  if (match) {
    console.log(`🎯 Found immediate match for ${socket.id} with ${match.socketId}`);
    const success = createMatch(queueUser, match);
    if (!success) {
      // Match creation failed, add to queue
      queue.push(queueUser);
      socket.emit('queue-status', { 
        position: queue.length,
        estimatedWait: queue.length * 15,
        message: 'Looking for someone with similar interests...'
      });
    }
  } else {
    // No match found, add to queue
    queue.push(queueUser);
    socket.emit('queue-status', { 
      position: queue.length,
      estimatedWait: queue.length * 15,
      message: queue.length === 1 ? 'You are first in queue!' : 'Looking for someone with similar interests...'
    });
    
    console.log(`📋 User ${socket.id} added to ${queueData.mode} queue (position: ${queue.length})`);
    logger.info(`📋 User ${socket.id} added to ${queueData.mode} queue (position: ${queue.length})`);
  }
});

  // Add this cleanup on leave-queue as well:
  socket.on('leave-queue', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.set(socket.id, {
        ...user,
        inQueue: false,
        isMatched: false
      });
    }
    
    // Remove from BOTH queues to be safe
    matchingQueue.textQueue = matchingQueue.textQueue.filter(q => q.socketId !== socket.id);
    matchingQueue.videoQueue = matchingQueue.videoQueue.filter(q => q.socketId !== socket.id);
    
    logger.info(`❌ User ${socket.id} left queue`);
    console.log(`❌ User ${socket.id} left all queues`);
  });

  // Handle sending messages - ENHANCED with database storage
  socket.on('send-message', async (messageData) => {
    logger.info(`💬 Message from ${socket.id}:`, { 
      preview: messageData.content?.substring(0, 50) 
    });
    console.log(`💬 Message from ${socket.id}:`, messageData.content?.substring(0, 50));
    
    const user = connectedUsers.get(socket.id);
    if (!user || !user.isMatched || !user.roomId) {
      logger.warn(`❌ User ${socket.id} not in a match`);
      console.log(`❌ User ${socket.id} not in a match`);
      socket.emit('message-error', { 
        error: 'Not in an active chat session' 
      });
      return;
    }

    try {
      // Save message to database if chat service is available
      if (chatService) {
        const savedMessage = await chatService.sendMessage({
          roomId: user.roomId,
          senderId: socket.id,
          recipientId: user.currentMatch,
          content: messageData.content,
          type: messageData.type || 'text',
          metadata: {
            interests: user.interests || [],
            mode: user.mode || 'text'
          }
        });

        // Send to partner in the same room
        socket.to(user.roomId).emit('message-received', savedMessage);
        
        // Acknowledge to sender with saved message details
        socket.emit('message-sent', savedMessage);
        
        logger.info('✅ Message delivered and saved', { 
          messageId: savedMessage.id,
          roomId: user.roomId 
        });
      } else {
        // Fallback if chat service is not initialized
        const message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          content: messageData.content,
          senderId: socket.id,
          timestamp: new Date().toISOString(),
          type: 'text'
        };

        socket.to(user.roomId).emit('message-received', message);
        socket.emit('message-sent', message);
      }
      
    } catch (error) {
      logger.error('❌ Error sending message:', error);
      socket.emit('message-error', { 
        error: 'Failed to send message' 
      });
    }
  });

  // NEW: Handle getting message history
  socket.on('get-messages', async (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !user.roomId) {
      socket.emit('messages-error', { 
        error: 'No active chat session' 
      });
      return;
    }

    try {
      if (chatService) {
        const messages = await chatService.getRoomMessages(user.roomId, {
          limit: data?.limit || 50,
          skip: data?.skip || 0
        });
        
        socket.emit('messages-loaded', { 
          messages,
          roomId: user.roomId 
        });
        
        logger.info('📜 Message history sent', { 
          userId: socket.id,
          roomId: user.roomId,
          count: messages.length 
        });
      } else {
        socket.emit('messages-loaded', { 
          messages: [],
          roomId: user.roomId 
        });
      }
      
    } catch (error) {
      logger.error('❌ Error getting messages:', error);
      socket.emit('messages-error', { 
        error: 'Failed to load messages' 
      });
    }
  });

  // Handle typing indicators - ENHANCED with Redis
  socket.on('typing', async () => {
    const user = connectedUsers.get(socket.id);
    if (user && user.isMatched && user.roomId) {
      // Store typing indicator in Redis if available
      if (chatService) {
        await chatService.setTypingIndicator(user.roomId, socket.id, true);
      }
      socket.to(user.roomId).emit('partner-typing', true);
    }
  });

  socket.on('stop-typing', async () => {
    const user = connectedUsers.get(socket.id);
    if (user && user.isMatched && user.roomId) {
      // Remove typing indicator from Redis if available
      if (chatService) {
        await chatService.setTypingIndicator(user.roomId, socket.id, false);
      }
      socket.to(user.roomId).emit('partner-typing', false);
    }
  });

  // NEW: Handle marking messages as read
  socket.on('mark-messages-read', async (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !user.roomId) return;

    try {
      if (chatService) {
        const count = await chatService.markRoomMessagesAsRead(
          user.roomId, 
          socket.id
        );
        
        socket.emit('messages-marked-read', { 
          count,
          roomId: user.roomId 
        });
        
        // Notify sender that messages were read
        if (user.currentMatch) {
          socket.to(user.roomId).emit('messages-read-by-partner', {
            readBy: socket.id,
            count
          });
        }
      }
      
    } catch (error) {
      logger.error('❌ Error marking messages as read:', error);
    }
  });

  // Handle user reports
  socket.on('report-user', (reportData) => {
    logger.info(`🚨 Report from ${socket.id}:`, reportData);
    console.log(`🚨 Report from ${socket.id}:`, reportData);
    
    socket.emit('report-submitted', { 
      success: true,
      reportId: `report_${Date.now()}`,
      message: 'Thank you for your report. We will review it shortly.'
    });
  });

  // Handle skip user - ENHANCED with message cleanup
  socket.on('skip-user', async () => {
    const user = connectedUsers.get(socket.id);
    if (!user || !user.isMatched || !user.roomId) return;
    
    logger.info(`⏭️  User ${socket.id} skipped partner`);
    console.log(`⏭️  User ${socket.id} skipped partner`);
    
    try {
      // Schedule message deletion after 12 hours
      if (chatService) {
        await chatService.scheduleRoomDeletion(user.roomId, 12);
        logger.info(`🗑️ Scheduled message deletion for room ${user.roomId} after skip`);
      }
    } catch (error) {
      logger.error('❌ Error scheduling message deletion:', error);
    }
    
    // Notify partner
    socket.to(user.roomId).emit('partner-disconnected');
    
    // Clean up match
    const match = activeMatches.get(user.roomId);
    if (match) {
      const partnerId = match.user1 === socket.id ? match.user2 : match.user1;
      const partner = connectedUsers.get(partnerId);
      
      if (partner) {
        connectedUsers.set(partnerId, {
          ...partner,
          isMatched: false,
          currentMatch: null,
          roomId: null
        });
      }
      
      activeMatches.delete(user.roomId);
    }
    
    // Reset current user
    connectedUsers.set(socket.id, {
      ...user,
      isMatched: false,
      currentMatch: null,
      roomId: null
    });
    
    // Leave the room
    socket.leave(user.roomId);
  });

  // Handle disconnect chat - ENHANCED with message cleanup
  socket.on('disconnect-chat', async () => {
    const user = connectedUsers.get(socket.id);
    if (!user || !user.isMatched || !user.roomId) return;
    
    logger.info(`🛑 User ${socket.id} disconnected from chat`);
    console.log(`🛑 User ${socket.id} disconnected from chat`);
    
    try {
      // Schedule message deletion after 12 hours
      if (chatService) {
        await chatService.scheduleRoomDeletion(user.roomId, 12);
        logger.info(`🗑️ Scheduled message deletion for room ${user.roomId} after 12 hours`);
      }
    } catch (error) {
      logger.error('❌ Error scheduling message deletion:', error);
    }
    
    // Notify partner
    socket.to(user.roomId).emit('partner-disconnected');
    
    // Clean up match
    const match = activeMatches.get(user.roomId);
    if (match) {
      const partnerId = match.user1 === socket.id ? match.user2 : match.user1;
      const partner = connectedUsers.get(partnerId);
      
      if (partner) {
        connectedUsers.set(partnerId, {
          ...partner,
          isMatched: false,
          currentMatch: null,
          roomId: null
        });
      }
      
      activeMatches.delete(user.roomId);
    }
    
    // Reset current user
    connectedUsers.set(socket.id, {
      ...user,
      isMatched: false,
      currentMatch: null,
      roomId: null
    });
    
    // Leave the room
    socket.leave(user.roomId);
  });

  // Handle WebRTC signaling - KEEP EXACTLY AS YOUR ORIGINAL
  socket.on('webrtc-offer', (data) => {
    logger.info(`📹 WebRTC offer from ${socket.id} to ${data.to}`);
    console.log(`📹 WebRTC offer from ${socket.id} to ${data.to}`);
    const user = connectedUsers.get(socket.id);
    if (user && user.isMatched && user.roomId) {
      socket.to(user.roomId).emit('webrtc-offer', {
        ...data,
        from: socket.id
      });
    }
  });

  socket.on('webrtc-answer', (data) => {
    logger.info(`📹 WebRTC answer from ${socket.id} to ${data.to}`);
    console.log(`📹 WebRTC answer from ${socket.id} to ${data.to}`);
    const user = connectedUsers.get(socket.id);
    if (user && user.isMatched && user.roomId) {
      socket.to(user.roomId).emit('webrtc-answer', {
        ...data,
        from: socket.id
      });
    }
  });

  socket.on('webrtc-ice-candidate', (data) => {
    logger.info(`🧊 ICE candidate from ${socket.id}`);
    console.log(`🧊 ICE candidate from ${socket.id}`);
    const user = connectedUsers.get(socket.id);
    if (user && user.isMatched && user.roomId) {
      socket.to(user.roomId).emit('webrtc-ice-candidate', {
        ...data,
        from: socket.id
      });
    }
  });

// In your server.js, update the disconnect handler to properly clean up the queues:

// Handle disconnect
socket.on('disconnect', async (reason) => {
  logger.info(`👋 User disconnected: ${socket.id} (${reason})`);
  console.log(`👋 User disconnected: ${socket.id} (${reason})`);
  
  const user = connectedUsers.get(socket.id);
  if (user) {
    // Remove from ALL queues (both text and video)
    const textQueueIndex = matchingQueue.textQueue.findIndex(q => q.socketId === socket.id);
    if (textQueueIndex !== -1) {
      matchingQueue.textQueue.splice(textQueueIndex, 1);
      console.log(`🗑️ Removed ${socket.id} from text queue`);
    }
    
    const videoQueueIndex = matchingQueue.videoQueue.findIndex(q => q.socketId === socket.id);
    if (videoQueueIndex !== -1) {
      matchingQueue.videoQueue.splice(videoQueueIndex, 1);
      console.log(`🗑️ Removed ${socket.id} from video queue`);
    }
    
    // If user was matched, notify partner and schedule message deletion
    if (user.isMatched && user.roomId) {
      socket.to(user.roomId).emit('partner-disconnected');
      
      try {
        // Schedule message deletion after 12 hours
        if (chatService) {
          await chatService.scheduleRoomDeletion(user.roomId, 12);
          logger.info(`🗑️ Scheduled message deletion for room ${user.roomId} after disconnect`);
        }
      } catch (error) {
        logger.error('❌ Error scheduling message deletion:', error);
      }
      
      // Clean up match
      const match = activeMatches.get(user.roomId);
      if (match) {
        const partnerId = match.user1 === socket.id ? match.user2 : match.user1;
        const partner = connectedUsers.get(partnerId);
        
        if (partner) {
          connectedUsers.set(partnerId, {
            ...partner,
            isMatched: false,
            currentMatch: null,
            roomId: null
          });
        }
        
        activeMatches.delete(user.roomId);
      }
    }
  }
  
  // Always delete the user from connected users
  connectedUsers.delete(socket.id);
  
  // Log current queue status
  console.log(`📊 Queue status after disconnect:
    - Text queue: ${matchingQueue.textQueue.length} users
    - Video queue: ${matchingQueue.videoQueue.length} users
    - Connected users: ${connectedUsers.size}`);
});

// Also add a periodic cleanup to remove stale connections (add this near the bottom of server.js):
setInterval(() => {
  // Clean up queues from disconnected users
  const connectedSocketIds = Array.from(io.sockets.sockets.keys());
  
  // Clean text queue
  const originalTextLength = matchingQueue.textQueue.length;
  matchingQueue.textQueue = matchingQueue.textQueue.filter(user => 
    connectedSocketIds.includes(user.socketId)
  );
  
  // Clean video queue
  const originalVideoLength = matchingQueue.videoQueue.length;
  matchingQueue.videoQueue = matchingQueue.videoQueue.filter(user => 
    connectedSocketIds.includes(user.socketId)
  );
  
  const textRemoved = originalTextLength - matchingQueue.textQueue.length;
  const videoRemoved = originalVideoLength - matchingQueue.videoQueue.length;
  
  if (textRemoved > 0 || videoRemoved > 0) {
    console.log(`🧹 Cleanup: Removed ${textRemoved} from text queue, ${videoRemoved} from video queue`);
  }
}, 30000); // Run every 30 seconds
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('❌ Unhandled error:', err);
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM received, shutting down gracefully');
  console.log('🛑 SIGTERM received, shutting down gracefully');
  
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('✅ Redis connection closed');
      console.log('✅ Redis connection closed');
    }
    
    if (mongoConnected) {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      logger.info('✅ MongoDB connection closed');
      console.log('✅ MongoDB connection closed');
    }
    
    server.close(() => {
      logger.info('✅ Server closed');
      console.log('✅ Server closed');
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Error during graceful shutdown:', error);
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
});

module.exports = { app, server, io, initializeServices };