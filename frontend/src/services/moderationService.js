import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class ModerationService {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor to add session ID
    this.api.interceptors.request.use((config) => {
      const sessionId = localStorage.getItem('anonverse-session-id');
      if (sessionId) {
        config.headers['X-Session-ID'] = sessionId;
      }
      return config;
    });
  }

  // Check content for moderation
  async checkContent(content) {
    try {
      const response = await this.api.post('/moderation/check-content', {
        content
      });
      return response.data;
    } catch (error) {
      console.error('Error checking content:', error);
      return { flagged: false, categories: [] };
    }
  }

  // Report user
  async reportUser(reportData) {
    try {
      const response = await this.api.post('/moderation/report-user', reportData);
      return response.data;
    } catch (error) {
      console.error('Error reporting user:', error);
      throw error;
    }
  }

  // Check if user is banned
  async checkBanStatus(userId) {
    try {
      const response = await this.api.get(`/moderation/banned/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking ban status:', error);
      return { banned: false };
    }
  }

  // Get moderation statistics
  async getModerationStats() {
    try {
      const response = await this.api.get('/moderation/stats');
      return response.data;
    } catch (error) {
      console.error('Error getting moderation stats:', error);
      return { stats: {} };
    }
  }
}

export default new ModerationService();