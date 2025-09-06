import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.pendingActions = [];
  }

  connect(selectedInterests, chatMode) {
    // Use window.location for dynamic URL or fallback to localhost
    const socketURL = window.REACT_APP_SOCKET_URL || 'ws://localhost:5000';
    
    this.socket = io(socketURL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
      forceNew: true
    });

    this.setupEventListeners(selectedInterests, chatMode);
    return this.socket;
  }

  setupEventListeners(selectedInterests, chatMode) {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Add a delay before joining to ensure all listeners are set up
      setTimeout(() => {
        // Send user-join event first
        this.socket.emit('user-join', {
          interests: selectedInterests || [],
          mode: chatMode || 'text',
          sessionId: Date.now().toString()
        });

        // Then join the queue after another small delay
        setTimeout(() => {
          this.socket.emit('join-queue', {
            interests: selectedInterests || [],
            mode: chatMode || 'text',
            sessionId: Date.now().toString()
          });
        }, 200);
      }, 500); // Wait 500ms before joining to ensure all listeners are ready

      // Process any pending actions
      this.processPendingActions();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.reconnectAttempts++;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
    });
  }

  processPendingActions() {
    while (this.pendingActions.length > 0) {
      const action = this.pendingActions.shift();
      action();
    }
  }

  // Send message with proper error handling
  sendMessage(messageData) {
    if (this.socket && this.isConnected) {
      console.log('📤 Sending message:', messageData);
      this.socket.emit('send-message', messageData);
    } else {
      console.warn('⚠️ Socket not connected, queuing message');
      this.pendingActions.push(() => this.sendMessage(messageData));
    }
  }

  // Join queue with proper timing
  joinQueue(userData) {
    if (this.socket && this.isConnected) {
      console.log('🎯 Joining queue:', userData);
      this.socket.emit('join-queue', userData);
    } else {
      this.pendingActions.push(() => this.joinQueue(userData));
    }
  }

  // Leave queue
  leaveQueue() {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-queue');
    }
  }

  // Skip user
  skipUser() {
    if (this.socket && this.isConnected) {
      console.log('⏭️ Skipping user');
      this.socket.emit('skip-user');
    }
  }

  // Report user
  reportUser(reportData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('report-user', reportData);
    }
  }

  // Disconnect from chat
  disconnectChat() {
    if (this.socket && this.isConnected) {
      console.log('👋 Disconnecting from chat');
      this.socket.emit('disconnect-chat');
    }
  }

  // WebRTC signaling methods
  sendWebRTCOffer(offerData) {
    if (this.socket && this.isConnected) {
      console.log('📹 Sending WebRTC offer');
      this.socket.emit('webrtc-offer', offerData);
    }
  }

  sendWebRTCAnswer(answerData) {
    if (this.socket && this.isConnected) {
      console.log('📹 Sending WebRTC answer');
      this.socket.emit('webrtc-answer', answerData);
    }
  }

  sendWebRTCIceCandidate(candidateData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('webrtc-ice-candidate', candidateData);
    }
  }

  // Typing indicators
  sendTyping() {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing');
    }
  }

  stopTyping() {
    if (this.socket && this.isConnected) {
      this.socket.emit('stop-typing');
    }
  }

  // Event listener management
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      
      // Store for cleanup
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
      
      console.log(`📡 Listener added for event: ${event}`);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
      
      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  removeAllListeners(event) {
    if (this.socket) {
      this.socket.removeAllListeners(event);
      this.listeners.delete(event);
    }
  }

  // Get socket instance
  getSocket() {
    return this.socket;
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
      console.log('🔌 Disconnecting socket');
      
      // Clear all listeners
      this.listeners.clear();
      
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.pendingActions = [];
    }
  }

  // Force reconnect
  forceReconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }
  }

  // Check if ready
  isSocketReady() {
    return this.socket && this.isConnected;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;