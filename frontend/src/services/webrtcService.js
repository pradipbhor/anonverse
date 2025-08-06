const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
];

class WebRTCService {
  constructor() {
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.isInitiator = false;
    this.socketService = null;
    this.partnerId = null;
    this.connectionState = 'new';
    this.iceConnectionState = 'new';
    this.gatheringState = 'new';
    this.dataChannel = null;
    
    // Event callbacks
    this.onLocalStream = null;
    this.onRemoteStream = null;
    this.onConnectionStateChange = null;
    this.onDataChannelMessage = null;
    this.onError = null;

    // Binding methods to preserve 'this' context
    this.handleOffer = this.handleOffer.bind(this);
    this.handleAnswer = this.handleAnswer.bind(this);
    this.handleIceCandidate = this.handleIceCandidate.bind(this);
    this.handlePartnerDisconnected = this.handlePartnerDisconnected.bind(this);
  }

  // Initialize WebRTC service with socket
  initialize(socketService) {
    console.log('🚀 Initializing WebRTC service...');
    this.socketService = socketService;
    this.setupSocketListeners();
  }

  // Setup socket event listeners for WebRTC signaling
  setupSocketListeners() {
    if (!this.socketService) {
      console.error('❌ Socket service not available');
      return;
    }

    console.log('📡 Setting up WebRTC socket listeners...');
    this.socketService.on('webrtc-offer', this.handleOffer);
    this.socketService.on('webrtc-answer', this.handleAnswer);
    this.socketService.on('webrtc-ice-candidate', this.handleIceCandidate);
    this.socketService.on('partner-disconnected', this.handlePartnerDisconnected);
  }

  // Create peer connection
  createPeerConnection() {
    try {
      const config = {
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };

      this.peerConnection = new RTCPeerConnection(config);
      this.setupPeerConnectionListeners();
      
      console.log('✅ Peer connection created');
      return this.peerConnection;
    } catch (error) {
      console.error('❌ Error creating peer connection:', error);
      this.handleError('Failed to create peer connection');
      return null;
    }
  }

  // Setup peer connection event listeners
  setupPeerConnectionListeners() {
    if (!this.peerConnection) return;

    // ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socketService && this.partnerId) {
        console.log('📤 Sending ICE candidate');
        this.socketService.sendWebRTCIceCandidate({
          candidate: event.candidate,
          to: this.partnerId
        });
      }
    };

    // Remote stream handling
    this.peerConnection.ontrack = (event) => {
      console.log('📺 Received remote stream:', event.streams[0]);
      this.remoteStream = event.streams[0];
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      this.connectionState = this.peerConnection.connectionState;
      console.log('🔗 Connection state:', this.connectionState);
      
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.connectionState);
      }

      if (this.connectionState === 'failed') {
        this.handleError('Connection failed');
      }
    };

    // ICE connection state monitoring
    this.peerConnection.oniceconnectionstatechange = () => {
      this.iceConnectionState = this.peerConnection.iceConnectionState;
      console.log('🧊 ICE connection state:', this.iceConnectionState);

      if (this.iceConnectionState === 'disconnected' || 
          this.iceConnectionState === 'failed') {
        this.handleError('ICE connection failed');
      }
    };

    // ICE gathering state monitoring
    this.peerConnection.onicegatheringstatechange = () => {
      this.gatheringState = this.peerConnection.iceGatheringState;
      console.log('🎯 ICE gathering state:', this.gatheringState);
    };

    // Data channel handling
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannel(channel);
    };
  }

  // Get user media with better error handling
  async getUserMedia(constraints = { video: true, audio: true }) {
    try {
      console.log('🎥 Requesting user media with constraints:', constraints);
      
      // Try to get the stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Got user media stream:', stream);
      console.log('📹 Video tracks:', stream.getVideoTracks());
      console.log('🎤 Audio tracks:', stream.getAudioTracks());
      
      // Store the stream
      this.localStream = stream;
      
      // Call the callback immediately
      if (this.onLocalStream) {
        console.log('📞 Calling onLocalStream callback');
        this.onLocalStream(stream);
      }

      return stream;
    } catch (error) {
      console.error('❌ Error getting user media:', error);
      
      let errorMessage = 'Failed to access camera/microphone';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone access denied. Please allow access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera/microphone found. Please check your devices.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera/microphone is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera/microphone constraints cannot be satisfied.';
      }
      
      this.handleError(errorMessage);
      throw error;
    }
  }

  // Start call (initiator)
  async startCall(partnerId, constraints = { video: true, audio: true }) {
    try {
      console.log('📞 Starting call with partner:', partnerId);
      this.partnerId = partnerId;
      this.isInitiator = true;

      // Create peer connection first
      if (!this.createPeerConnection()) {
        throw new Error('Failed to create peer connection');
      }

      // Get user media if we don't have it already
      let stream = this.localStream;
      if (!stream) {
        stream = await this.getUserMedia(constraints);
      }

      // Add tracks to peer connection
      console.log('➕ Adding tracks to peer connection');
      stream.getTracks().forEach(track => {
        console.log('📎 Adding track:', track.kind, track.label);
        this.peerConnection.addTrack(track, stream);
      });

      // Create data channel
      this.dataChannel = this.peerConnection.createDataChannel('messages', {
        ordered: true
      });
      this.setupDataChannel(this.dataChannel);

      // Create and send offer
      console.log('📤 Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });

      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ Local description set');

      if (this.socketService) {
        this.socketService.sendWebRTCOffer({
          offer: offer,
          to: partnerId
        });
        console.log('📤 Offer sent');
      }

      return true;
    } catch (error) {
      console.error('❌ Error starting call:', error);
      this.handleError('Failed to start call: ' + error.message);
      return false;
    }
  }

  // Handle incoming call offer
  async handleOffer(data) {
    try {
      console.log('📥 Handling incoming offer from:', data.from);
      this.partnerId = data.from;
      this.isInitiator = false;

      // Create peer connection
      if (!this.createPeerConnection()) {
        throw new Error('Failed to create peer connection');
      }

      // Get user media if we don't have it already
      let stream = this.localStream;
      if (!stream) {
        stream = await this.getUserMedia();
      }

      // Add tracks to peer connection
      console.log('➕ Adding tracks to peer connection');
      stream.getTracks().forEach(track => {
        console.log('📎 Adding track:', track.kind, track.label);
        this.peerConnection.addTrack(track, stream);
      });

      // Set remote description
      console.log('📥 Setting remote description...');
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );

      // Create and send answer
      console.log('📤 Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      if (this.socketService) {
        this.socketService.sendWebRTCAnswer({
          answer: answer,
          to: this.partnerId
        });
        console.log('📤 Answer sent');
      }

    } catch (error) {
      console.error('❌ Error handling offer:', error);
      this.handleError('Failed to handle incoming call: ' + error.message);
    }
  }

  // Handle incoming answer
  async handleAnswer(data) {
    try {
      if (!this.peerConnection || this.peerConnection.signalingState !== 'have-local-offer') {
        console.warn('🛑 STOPPING: Wrong state for answer:', this.peerConnection?.signalingState);
        return; // STOP processing
      }
      console.log('📥 Handling answer from:', data.from);
      
      if (!this.peerConnection) {
        throw new Error('No peer connection available');
      }

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );

      console.log('✅ Answer handled successfully');
    } catch (error) {
      console.error('❌ Error handling answer:', error);
      this.handleError('Failed to handle answer: ' + error.message);
    }
  }

  // Handle incoming ICE candidate
  async handleIceCandidate(data) {
    try {
      if (!this.peerConnection) {
        console.warn('⚠️ No peer connection available for ICE candidate');
        return;
      }

      await this.peerConnection.addIceCandidate(
        new RTCIceCandidate(data.candidate)
      );

      console.log('✅ ICE candidate added');
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
      // Don't treat ICE candidate errors as fatal
    }
  }

  // Handle partner disconnection
  handlePartnerDisconnected() {
    console.log('👋 Partner disconnected, ending call');
    this.endCall();
  }

  // Setup data channel
  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log('📡 Data channel opened');
    };

    channel.onclose = () => {
      console.log('📡 Data channel closed');
    };

    channel.onmessage = (event) => {
      console.log('📨 Data channel message:', event.data);
      if (this.onDataChannelMessage) {
        this.onDataChannelMessage(event.data);
      }
    };

    channel.onerror = (error) => {
      console.error('❌ Data channel error:', error);
    };
  }

  // Send data channel message
  sendDataChannelMessage(message) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
      return true;
    }
    return false;
  }

  // Toggle video
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log('📹 Video toggled:', videoTrack.enabled);
        return videoTrack.enabled;
      }
    }
    return false;
  }

  // Toggle audio
  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log('🎤 Audio toggled:', audioTrack.enabled);
        return audioTrack.enabled;
      }
    }
    return false;
  }

  // Get video status
  isVideoEnabled() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      return videoTrack ? videoTrack.enabled : false;
    }
    return false;
  }

  // Get audio status
  isAudioEnabled() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      return audioTrack ? audioTrack.enabled : false;
    }
    return false;
  }

  // Get connection statistics
  async getConnectionStats() {
    if (!this.peerConnection) return null;

    try {
      const stats = await this.peerConnection.getStats();
      const result = {
        connection: this.connectionState,
        iceConnection: this.iceConnectionState,
        gathering: this.gatheringState,
        bytesReceived: 0,
        bytesSent: 0,
        packetsReceived: 0,
        packetsSent: 0
      };

      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          result.bytesReceived += report.bytesReceived || 0;
          result.packetsReceived += report.packetsReceived || 0;
        } else if (report.type === 'outbound-rtp') {
          result.bytesSent += report.bytesSent || 0;
          result.packetsSent += report.packetsSent || 0;
        }
      });

      return result;
    } catch (error) {
      console.error('❌ Error getting connection stats:', error);
      return null;
    }
  }

  // End call with thorough cleanup
  endCall() {
    console.log('🛑 Ending call...');

    // Stop local stream
    if (this.localStream) {
      console.log('🛑 Stopping local stream...');
      this.localStream.getTracks().forEach(track => {
        console.log('🛑 Stopping track:', track.kind, track.label);
        track.stop();
      });
      this.localStream = null;
    }

    // Stop remote stream
    if (this.remoteStream) {
      console.log('🛑 Stopping remote stream...');
      this.remoteStream.getTracks().forEach(track => {
        console.log('🛑 Stopping remote track:', track.kind);
        track.stop();
      });
      this.remoteStream = null;
    }

    // Close data channel
    if (this.dataChannel) {
      console.log('🛑 Closing data channel...');
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      console.log('🛑 Closing peer connection...');
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Reset state
    this.partnerId = null;
    this.isInitiator = false;
    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
    this.gatheringState = 'complete';
    
    console.log('✅ Call ended successfully');
  }

  // Handle errors
  handleError(message) {
    console.error('❌ WebRTC Error:', message);
    if (this.onError) {
      this.onError(message);
    }
  }

  // Cleanup with proper event listener removal
  cleanup() {
    console.log('🧹 Cleaning up WebRTC service...');
    
    this.endCall();
    
    // Remove socket listeners
    if (this.socketService) {
      this.socketService.off('webrtc-offer', this.handleOffer);
      this.socketService.off('webrtc-answer', this.handleAnswer);
      this.socketService.off('webrtc-ice-candidate', this.handleIceCandidate);
      this.socketService.off('partner-disconnected', this.handlePartnerDisconnected);
    }

    // Reset callbacks
    this.onLocalStream = null;
    this.onRemoteStream = null;
    this.onConnectionStateChange = null;
    this.onDataChannelMessage = null;
    this.onError = null;
    
    console.log('✅ WebRTC service cleaned up');
  }

  // Debug method to check current state
  getDebugInfo() {
    return {
      hasLocalStream: !!this.localStream,
      hasRemoteStream: !!this.remoteStream,
      hasPeerConnection: !!this.peerConnection,
      partnerId: this.partnerId,
      connectionState: this.connectionState,
      iceConnectionState: this.iceConnectionState,
      gatheringState: this.gatheringState,
      isInitiator: this.isInitiator,
      localStreamTracks: this.localStream ? {
        video: this.localStream.getVideoTracks().length,
        audio: this.localStream.getAudioTracks().length
      } : null,
      remoteStreamTracks: this.remoteStream ? {
        video: this.remoteStream.getVideoTracks().length,
        audio: this.remoteStream.getAudioTracks().length
      } : null
    };
  }

  // Helper method to check if WebRTC is supported
  static isSupported() {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.RTCPeerConnection &&
      window.RTCSessionDescription &&
      window.RTCIceCandidate
    );
  }

  // Helper method to get available devices
  static async getAvailableDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        videoInputs: devices.filter(device => device.kind === 'videoinput'),
        audioInputs: devices.filter(device => device.kind === 'audioinput'),
        audioOutputs: devices.filter(device => device.kind === 'audiooutput')
      };
    } catch (error) {
      console.error('❌ Error getting available devices:', error);
      return {
        videoInputs: [],
        audioInputs: [],
        audioOutputs: []
      };
    }
  }
}

// Create singleton instance
const webrtcService = new WebRTCService();

export default webrtcService;