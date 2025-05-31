import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Add TURN servers for production
  // {
  //   urls: 'turn:your-turn-server.com:3478',
  //   username: 'username',
  //   credential: 'password'
  // }
];

export const useWebRTC = (socket, enabled = false) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState('new');
  const [error, setError] = useState(null);

  const peerConnection = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const isInitiator = useRef(false);

  // Initialize peer connection
  const initializePeerConnection = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          candidate: event.candidate
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote stream');
      setRemoteStream(event.streams[0]);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      
      if (pc.connectionState === 'failed') {
        setError('Connection failed');
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'disconnected' || 
          pc.iceConnectionState === 'failed') {
        setError('Connection lost');
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [socket]);

  // Get user media
  const getUserMedia = useCallback(async (constraints = { video: true, audio: true }) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setError(null);
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Failed to access camera/microphone');
      throw err;
    }
  }, []);

  // Initialize call (called by initiator)
  const initializeCall = useCallback(async (partnerId) => {
    if (!enabled || !socket) return;

    try {
      isInitiator.current = true;
      const pc = initializePeerConnection();
      
      // Get user media
      const stream = await getUserMedia();
      
      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      
      await pc.setLocalDescription(offer);
      
      socket.emit('webrtc-offer', {
        offer: offer,
        to: partnerId
      });

      console.log('Call initiated');
    } catch (error) {
      console.error('Error initializing call:', error);
      setError('Failed to initialize call');
    }
  }, [enabled, socket, initializePeerConnection, getUserMedia]);

  // Handle incoming call
  const handleIncomingCall = useCallback(async (offer, partnerId) => {
    if (!enabled || !socket) return;

    try {
      isInitiator.current = false;
      const pc = initializePeerConnection();
      
      // Get user media
      const stream = await getUserMedia();
      
      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Set remote description and create answer
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('webrtc-answer', {
        answer: answer,
        to: partnerId
      });

      console.log('Call answered');
    } catch (error) {
      console.error('Error handling incoming call:', error);
      setError('Failed to answer call');
    }
  }, [enabled, socket, initializePeerConnection, getUserMedia]);

  // Handle answer
  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnection.current) return;

    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Answer handled');
    } catch (error) {
      console.error('Error handling answer:', error);
      setError('Failed to handle answer');
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate) => {
    if (!peerConnection.current) return;

    try {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('ICE candidate added');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  // End call
  const endCall = useCallback(() => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Stop remote stream
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }

    // Close peer connection
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    setConnectionState('closed');
    setError(null);
    console.log('Call ended');
  }, [localStream, remoteStream]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !enabled) return;

    const handleOffer = (data) => {
      handleIncomingCall(data.offer, data.from);
    };

    const handleAnswerReceived = (data) => {
      handleAnswer(data.answer);
    };

    const handleIceCandidateReceived = (data) => {
      handleIceCandidate(data.candidate);
    };

    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswerReceived);
    socket.on('webrtc-ice-candidate', handleIceCandidateReceived);

    return () => {
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswerReceived);
      socket.off('webrtc-ice-candidate', handleIceCandidateReceived);
    };
  }, [socket, enabled, handleIncomingCall, handleAnswer, handleIceCandidate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  // Update video refs when streams change
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    error,
    localVideoRef,
    remoteVideoRef,
    initializeCall,
    toggleVideo,
    toggleAudio,
    endCall,
    getUserMedia
  };
};