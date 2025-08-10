// Start server
const PORT = process.env.PORT || 5000;
const logger = require("./Loaders/Logger");
const {initializeServices, server}=require("./server");

async function startServer() {
  try {
    // Initialize services
    await initializeServices();
    
    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Anonverse server running on port ${PORT}`);
      logger.info(`🚀 Anonverse server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health`);
     // console.log(`👥 Online users: ${connectedUsers.size}`);
     // console.log(`📋 Queue status: Text: ${matchingQueue.textQueue.length}, Video: ${matchingQueue.videoQueue.length}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();