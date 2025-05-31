const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

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

async function initializeServices() {
  try {
    // Redis connection
    if (process.env.REDIS_URL) {
      const { createClient } = require('redis');
      redisClient = createClient({
        url: process.env.REDIS_URL
      });
      
      redisClient.on('error', (err) => {
        console.log('Redis error:', err.message);
      });
      
      await redisClient.connect();
      console.log('✅ Connected to Redis');
    }
    
    // MongoDB connection
    if (process.env.MONGODB_URI) {
      const mongoose = require('mongoose');
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      mongoConnected = true;
      console.log('✅ Connected to MongoDB');
    }
    
  } catch (error) {
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
      mongodb: mongoConnected ? 'connected' : 'disconnected'
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

app.post('/api/chat/send-message', chatLimiter, (req, res) => {
  const { content, to } = req.body;
  
  if (!content || !to) {
    return res.status(400).json({ error: 'Content and recipient required' });
  }
  
  res.json({ 
    success: true, 
    message: 'Message sent',
    messageId: Date.now().toString(),
    timestamp: new Date().toISOString()
  });
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
  const queueCount = Math.floor(onlineCount * 0.3); // Simulate queue
  
  res.json({
    success: true,
    onlineUsers: onlineCount,
    queueStats: {
      totalInQueue: queueCount,
      textUsers: Math.floor(queueCount * 0.7),
      videoUsers: Math.floor(queueCount * 0.3),
      averageWaitTime: Math.floor(Math.random() * 30) + 10 // 10-40 seconds
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
    confidence: flagged ? Math.floor(Math.random() * 50) + 50 : Math.floor(Math.random() * 30), // 0-30% if clean, 50-100% if flagged
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
  // Mock moderation statistics
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

// Socket.IO connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`👤 User connected: ${socket.id}`);
  
  // Add user to connected users
  connectedUsers.set(socket.id, {
    socketId: socket.id,
    joinedAt: new Date(),
    isMatched: false,
    currentMatch: null,
    interests: [],
    mode: 'text'
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
    console.log(`✅ User ${socket.id} joined with data:`, userData);
  });

  // Handle joining matching queue
  socket.on('join-queue', (queueData) => {
    console.log(`🔍 User ${socket.id} joined queue:`, queueData);
    
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.set(socket.id, {
        ...user,
        interests: queueData.interests || [],
        mode: queueData.mode || 'text',
        inQueue: true
      });
    }
    
    // Send queue status
    socket.emit('queue-status', { 
      position: Math.floor(Math.random() * 20) + 1,
      estimatedWait: Math.floor(Math.random() * 60) + 30, // 30-90 seconds
      message: 'Looking for someone with similar interests...'
    });
    
    // Simulate finding a match (for testing)
    const matchDelay = Math.random() * 5000 + 2000; // 2-7 seconds
    setTimeout(() => {
      // Check if user is still connected and in queue
      const currentUser = connectedUsers.get(socket.id);
      if (currentUser && currentUser.inQueue) {
        socket.emit('match-found', {
          partnerId: `partner_${Date.now()}`,
          commonInterests: queueData.interests?.slice(0, 2) || [],
          mode: queueData.mode || 'text',
          roomId: `room_${socket.id}_${Date.now()}`
        });
        
        // Update user status
        connectedUsers.set(socket.id, {
          ...currentUser,
          isMatched: true,
          inQueue: false,
          matchedAt: new Date()
        });
        
        console.log(`💑 Match found for user ${socket.id}`);
      }
    }, matchDelay);
  });

  // Handle leaving queue
  socket.on('leave-queue', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.set(socket.id, {
        ...user,
        inQueue: false,
        isMatched: false
      });
    }
    console.log(`❌ User ${socket.id} left queue`);
  });

  // Handle sending messages
  socket.on('send-message', (messageData) => {
    console.log(`💬 Message from ${socket.id}:`, messageData.content?.substring(0, 50));
    
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      content: messageData.content,
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    // Acknowledge message sent
    socket.emit('message-sent', message);
    
    // In a real app, you'd send this to the matched partner
    // For now, just echo it back as received (for testing)
    setTimeout(() => {
      socket.emit('message-received', {
        ...message,
        id: `msg_${Date.now()}_echo`,
        senderId: 'partner',
        content: `Echo: ${message.content}`
      });
    }, 500);
  });

  // Handle typing indicators
  socket.on('typing', () => {
    // In real app, send to matched partner
    console.log(`⌨️  User ${socket.id} is typing`);
  });

  socket.on('stop-typing', () => {
    console.log(`⌨️  User ${socket.id} stopped typing`);
  });

  // Handle user reports
  socket.on('report-user', (reportData) => {
    console.log(`🚨 Report from ${socket.id}:`, reportData);
    
    socket.emit('report-submitted', { 
      success: true,
      reportId: `report_${Date.now()}`,
      message: 'Thank you for your report. We will review it shortly.'
    });
  });

  // Handle skip user
  socket.on('skip-user', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.set(socket.id, {
        ...user,
        isMatched: false,
        currentMatch: null
      });
    }
    
    console.log(`⏭️  User ${socket.id} skipped partner`);
    socket.emit('partner-disconnected');
  });

  // Handle WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    console.log(`📹 WebRTC offer from ${socket.id}`);
    // In real app, forward to matched partner
  });

  socket.on('webrtc-answer', (data) => {
    console.log(`📹 WebRTC answer from ${socket.id}`);
    // In real app, forward to matched partner
  });

  socket.on('webrtc-ice-candidate', (data) => {
    console.log(`🧊 ICE candidate from ${socket.id}`);
    // In real app, forward to matched partner
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`👋 User disconnected: ${socket.id} (${reason})`);
    connectedUsers.delete(socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
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
  console.log('🛑 SIGTERM received, shutting down gracefully');
  
  try {
    if (redisClient) {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    }
    
    if (mongoConnected) {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
    }
    
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Initialize services
    await initializeServices();
    
    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Anonverse server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health`);
      console.log(`👥 Online users: ${connectedUsers.size}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, io };