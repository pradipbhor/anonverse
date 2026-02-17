import { io } from 'socket.io-client';
import { generateSessionId } from '../utils/helpers';
import { STORAGE_KEYS } from '../utils/constants';

/**
 * SocketService
 * Manages the socket connection lifecycle including:
 * - Session persistence across reconnections
 * - Pending action queue when temporarily disconnected
 * - Moderation event handling
 */
class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.pendingActions = [];

    // Stable session ID that survives socket reconnections
    this.sessionId = this._getOrCreateSessionId();
  }

  // ─── SESSION ─────────────────────────────────────────────────

  _getOrCreateSessionId() {
    let sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    if (!sessionId) {
      sessionId = generateSessionId();
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    }
    return sessionId;
  }

  getSessionId() {
    return this.sessionId;
  }

  // ─── CONNECT ─────────────────────────────────────────────────

  connect(selectedInterests = [], chatMode = 'text') {
    const socketURL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    this.socket = io(socketURL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      forceNew: true
    });

    this._setupCoreListeners(selectedInterests, chatMode);
    return this.socket;
  }

  // ─── CORE LISTENERS ──────────────────────────────────────────

  _setupCoreListeners(selectedInterests, chatMode) {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Send user-join with stable sessionId — server uses this
      // to detect if this is a fresh join or a reconnection
      setTimeout(() => {
        this.socket.emit('user-join', {
          sessionId: this.sessionId,
          interests: selectedInterests,
          mode: chatMode
        });

        // Join queue after server confirms session
        setTimeout(() => {
          this.socket.emit('join-queue', {
            interests: selectedInterests,
            mode: chatMode
          });
        }, 200);
      }, 300);

      this._processPendingActions();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      this.reconnectAttempts++;
    });

    // Server confirmed our session
    this.socket.on('session-confirmed', ({ sessionId }) => {
      console.log('Session confirmed:', sessionId);
    });

    // Server restored our match after reconnection
    this.socket.on('reconnect-success', (data) => {
      console.log('Reconnect success:', data);
    });

    // Heartbeat — must respond to keep connection alive
    this.socket.on('ping', () => {
      this.socket.emit('pong');
    });
  }

  // ─── PENDING ACTIONS ─────────────────────────────────────────

  _processPendingActions() {
    while (this.pendingActions.length > 0) {
      const action = this.pendingActions.shift();
      action();
    }
  }

  // ─── MESSAGING ───────────────────────────────────────────────

  sendMessage(data) {
    if (this.isConnected) {
      this.socket.emit('send-message', data);
    } else {
      this.pendingActions.push(() => this.sendMessage(data));
    }
  }

  // ─── QUEUE ───────────────────────────────────────────────────

  joinQueue(data) {
    if (this.isConnected) {
      this.socket.emit('join-queue', data);
    } else {
      this.pendingActions.push(() => this.joinQueue(data));
    }
  }

  leaveQueue() {
    if (this.isConnected) this.socket.emit('leave-queue');
  }

  skipUser() {
    if (this.isConnected) this.socket.emit('skip-user');
  }

  disconnectChat() {
    if (this.isConnected) this.socket.emit('disconnect-chat');
  }

  // ─── WEBRTC SIGNALING ────────────────────────────────────────

  sendWebRTCOffer(data) {
    if (this.isConnected) this.socket.emit('webrtc-offer', data);
  }

  sendWebRTCAnswer(data) {
    if (this.isConnected) this.socket.emit('webrtc-answer', data);
  }

  sendWebRTCIceCandidate(data) {
    if (this.isConnected) this.socket.emit('webrtc-ice-candidate', data);
  }

  // ─── TYPING ──────────────────────────────────────────────────

  sendTyping() {
    if (this.isConnected) this.socket.emit('typing');
  }

  stopTyping() {
    if (this.isConnected) this.socket.emit('stop-typing');
  }

  // ─── REPORTING ───────────────────────────────────────────────

  reportUser(data) {
    if (this.isConnected) this.socket.emit('report-user', data);
  }

  // ─── EVENT BUS ───────────────────────────────────────────────

  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
    const cbs = this.listeners.get(event) || [];
    const idx = cbs.indexOf(callback);
    if (idx > -1) cbs.splice(idx, 1);
  }

  // ─── DISCONNECT ──────────────────────────────────────────────

  disconnect() {
    if (this.socket) {
      this.listeners.clear();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.pendingActions = [];
    }
  }

  isReady() {
    return this.socket && this.isConnected;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id || null,
      sessionId: this.sessionId,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

const socketService = new SocketService();
export default socketService;