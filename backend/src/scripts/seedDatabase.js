const mongoose = require('mongoose');
const User = require('../src/models/User');
const Analytics = require('../src/models/Analytics');
require('dotenv').config();

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create sample analytics for past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const analytics = new Analytics({
        date,
        metrics: {
          dailyActiveUsers: Math.floor(Math.random() * 1000) + 100,
          newUsers: Math.floor(Math.random() * 200) + 20,
          totalSessions: Math.floor(Math.random() * 500) + 50,
          textSessions: Math.floor(Math.random() * 300) + 30,
          videoSessions: Math.floor(Math.random() * 200) + 20,
          averageSessionDuration: Math.floor(Math.random() * 600) + 120,
          totalMessages: Math.floor(Math.random() * 5000) + 500,
          successfulMatches: Math.floor(Math.random() * 400) + 40,
          skippedConnections: Math.floor(Math.random() * 100) + 10,
          reportedUsers: Math.floor(Math.random() * 10) + 1
        }
      });

      await analytics.save();
    }

    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();