import io from 'socket.io-client';
import webrtcService from './webrtcService';


class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.webrtcService = null;
  }

  connect(selectedInterests , chatMode) {
    const socketURL = 'ws://localhost:5000'; //process.env.REACT_APP_SOCKET_URL || 
    
    this.socket = io(socketURL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
      maxReconnectionAttempts: this.maxReconnectAttempts,
      forceNew: true
    });
    this.setupEventListeners(selectedInterests , chatMode);
    return this.socket;
  }

  setupEventListeners(selectedInterests , chatMode) {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connection-status', { connected: true, socketId: this.socket.id });
      this.userJoined({ interests: selectedInterests, mode: chatMode, sessionId: Date.now().toString() });
      this.joinQueue({ interests: selectedInterests, mode: chatMode, sessionId: Date.now().toString() });
     // this.webrtcService = webrtcService.initialize(this.socket);

    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
      this.emit('connection-status', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      this.emit('connection-error', { error, attempts: this.reconnectAttempts });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
      this.emit('reconnected', { attempts: attemptNumber });
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket reconnection attempt:', attemptNumber);
      this.emit('reconnecting', { attempt: attemptNumber });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      this.emit('reconnect-failed');
    });
  }

  // Join matching queue
  joinQueue(userData) {
    console.log("We are calling join-queueue............",this.socket ,"===",this.isConnected);
    if (this.socket && this.isConnected) {
      console.log("We are calling join-queueue............");
      this.socket.emit('join-queue', userData);
    }
  }
  userJoined(userData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('user-join', userData);
    }
  }

  // Leave matching queue
  leaveQueue() {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-queue');
    }
  }

  // Send chat message
  sendMessage(messageData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('send-message', messageData);
    }
  }

  // Send typing indicator
  sendTyping() {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing');
    }
  }

  // Stop typing indicator
  stopTyping() {
    if (this.socket && this.isConnected) {
      this.socket.emit('stop-typing');
    }
  }

  // Skip current user
  skipUser() {
    if (this.socket && this.isConnected) {
      this.socket.emit('skip-user');
    }
  }

  // Report user
  reportUser(reportData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('report-user', reportData);
    }
  }

  // Disconnect from current chat
  disconnectChat() {
    if (this.socket && this.isConnected) {
      this.socket.emit('disconnect-chat');
    }
  }

  // WebRTC signaling
  sendWebRTCOffer(offerData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('webrtc-offer', offerData);
    }
  }

  sendWebRTCAnswer(answerData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('webrtc-answer', answerData);
    }
  }

  sendWebRTCIceCandidate(candidateData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('webrtc-ice-candidate', candidateData);
    }
  }

  // Generic event emission
  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    }
  }

  // Event listening with automatic cleanup
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      
      // Store listener for cleanup
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
  }

  // Remove specific event listener
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
      
      // Remove from stored listeners
      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  // Remove all listeners for an event
  removeAllListeners(event) {
    if (this.socket) {
      this.socket.removeAllListeners(event);
      this.listeners.delete(event);
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id || null,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      // Clean up all listeners
      this.listeners.clear();
      
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
    }
  }

  // Force reconnection
  forceReconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }
  }

  // Check if socket exists and is connected
  isSocketReady() {
    return this.socket && this.isConnected;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;