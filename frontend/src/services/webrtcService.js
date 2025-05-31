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
    }
  
    // Initialize WebRTC service with socket
    initialize(socketService) {
      this.socketService = socketService;
      this.setupSocketListeners();
    }
  
    // Setup socket event listeners for WebRTC signaling
    setupSocketListeners() {
      if (!this.socketService) return;
  
      this.socketService.on('webrtc-offer', this.handleOffer.bind(this));
      this.socketService.on('webrtc-answer', this.handleAnswer.bind(this));
      this.socketService.on('webrtc-ice-candidate', this.handleIceCandidate.bind(this));
      this.socketService.on('partner-disconnected', this.handlePartnerDisconnected.bind(this));
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
        
        console.log('Peer connection created');
        return this.peerConnection;
      } catch (error) {
        console.error('Error creating peer connection:', error);
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
          console.log('Sending ICE candidate');
          this.socketService.sendWebRTCIceCandidate({
            candidate: event.candidate,
            to: this.partnerId
          });
        }
      };
  
      // Remote stream handling
      this.peerConnection.ontrack = (event) => {
        console.log('Received remote stream');
        this.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      };
  
      // Connection state monitoring
      this.peerConnection.onconnectionstatechange = () => {
        this.connectionState = this.peerConnection.connectionState;
        console.log('Connection state:', this.connectionState);
        
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
        console.log('ICE connection state:', this.iceConnectionState);
  
        if (this.iceConnectionState === 'disconnected' || 
            this.iceConnectionState === 'failed') {
          this.handleError('ICE connection failed');
        }
      };
  
      // ICE gathering state monitoring
      this.peerConnection.onicegatheringstatechange = () => {
        this.gatheringState = this.peerConnection.iceGatheringState;
        console.log('ICE gathering state:', this.gatheringState);
      };
  
      // Data channel handling
      this.peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        this.setupDataChannel(channel);
      };
    }
  
    // Get user media
    async getUserMedia(constraints = { video: true, audio: true }) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.localStream = stream;
        
        if (this.onLocalStream) {
          this.onLocalStream(stream);
        }
  
        console.log('Got user media');
        return stream;
      } catch (error) {
        console.error('Error getting user media:', error);
        
        let errorMessage = 'Failed to access camera/microphone';
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera/microphone access denied. Please allow access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera/microphone found. Please check your devices.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera/microphone is already in use by another application.';
        }
        
        this.handleError(errorMessage);
        throw error;
      }
    }
  
    // Start call (initiator)
    async startCall(partnerId, constraints = { video: true, audio: true }) {
      try {
        this.partnerId = partnerId;
        this.isInitiator = true;
  
        // Create peer connection
        if (!this.createPeerConnection()) {
          throw new Error('Failed to create peer connection');
        }
  
        // Get user media
        const stream = await this.getUserMedia(constraints);
  
        // Add tracks to peer connection
        stream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, stream);
        });
  
        // Create data channel
        this.dataChannel = this.peerConnection.createDataChannel('messages', {
          ordered: true
        });
        this.setupDataChannel(this.dataChannel);
  
        // Create and send offer
        const offer = await this.peerConnection.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: true
        });
  
        await this.peerConnection.setLocalDescription(offer);
  
        if (this.socketService) {
          this.socketService.sendWebRTCOffer({
            offer: offer,
            to: partnerId
          });
        }
  
        console.log('Call started');
        return true;
      } catch (error) {
        console.error('Error starting call:', error);
        this.handleError('Failed to start call');
        return false;
      }
    }
  
    // Handle incoming call offer
    async handleOffer(data) {
      try {
        this.partnerId = data.from;
        this.isInitiator = false;
  
        // Create peer connection
        if (!this.createPeerConnection()) {
          throw new Error('Failed to create peer connection');
        }
  
        // Get user media
        const stream = await this.getUserMedia();
  
        // Add tracks to peer connection
        stream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, stream);
        });
  
        // Set remote description
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );
  
        // Create and send answer
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
  
        if (this.socketService) {
          this.socketService.sendWebRTCAnswer({
            answer: answer,
            to: this.partnerId
          });
        }
  
        console.log('Offer handled, answer sent');
      } catch (error) {
        console.error('Error handling offer:', error);
        this.handleError('Failed to handle incoming call');
      }
    }
  
    // Handle incoming answer
    async handleAnswer(data) {
      try {
        if (!this.peerConnection) {
          throw new Error('No peer connection available');
        }
  
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
  
        console.log('Answer handled');
      } catch (error) {
        console.error('Error handling answer:', error);
        this.handleError('Failed to handle answer');
      }
    }
  
    // Handle incoming ICE candidate
    async handleIceCandidate(data) {
      try {
        if (!this.peerConnection) {
          throw new Error('No peer connection available');
        }
  
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
  
        console.log('ICE candidate added');
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
        // Don't treat ICE candidate errors as fatal
      }
    }
  
    // Handle partner disconnection
    handlePartnerDisconnected() {
      console.log('Partner disconnected, ending call');
      this.endCall();
    }
  
    // Setup data channel
    setupDataChannel(channel) {
      channel.onopen = () => {
        console.log('Data channel opened');
      };
  
      channel.onclose = () => {
        console.log('Data channel closed');
      };
  
      channel.onmessage = (event) => {
        console.log('Data channel message:', event.data);
        if (this.onDataChannelMessage) {
          this.onDataChannelMessage(event.data);
        }
      };
  
      channel.onerror = (error) => {
        console.error('Data channel error:', error);
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
        console.error('Error getting connection stats:', error);
        return null;
      }
    }
  
    // End call
    endCall() {
      console.log('Ending call');
  
      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          track.stop();
        });
        this.localStream = null;
      }
  
      // Stop remote stream
      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach(track => {
          track.stop();
        });
        this.remoteStream = null;
      }
  
      // Close data channel
      if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
      }
  
      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
  
      // Reset state
      this.partnerId = null;
      this.isInitiator = false;
      this.connectionState = 'closed';
      this.iceConnectionState = 'closed';
      this.gatheringState = 'complete';
    }
  
    // Handle errors
    handleError(message) {
      console.error('WebRTC Error:', message);
      if (this.onError) {
        this.onError(message);
      }
    }
  
    // Cleanup
    cleanup() {
      this.endCall();
      
      // Remove socket listeners
      if (this.socketService) {
        this.socketService.off('webrtc-offer', this.handleOffer.bind(this));
        this.socketService.off('webrtc-answer', this.handleAnswer.bind(this));
        this.socketService.off('webrtc-ice-candidate', this.handleIceCandidate.bind(this));
        this.socketService.off('partner-disconnected', this.handlePartnerDisconnected.bind(this));
      }
  
      // Reset callbacks
      this.onLocalStream = null;
      this.onRemoteStream = null;
      this.onConnectionStateChange = null;
      this.onDataChannelMessage = null;
      this.onError = null;
    }
  }
  
  // Create singleton instance
  const webrtcService = new WebRTCService();
  
  export default webrtcService;