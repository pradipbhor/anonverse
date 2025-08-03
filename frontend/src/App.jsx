import React, { useState, useEffect, useRef } from 'react';
import { Globe, MessageCircle, Video, Users, Shield, Mic, MicOff, VideoOff as VideoOffIcon, SkipForward, Home } from 'lucide-react';
import socketService from './services/socketService';
import webrtcService from './services/webrtcService';
import VideoStream from './components/VideoStream';
import DebugPanel from './components/DebugPanel';
import { CHAT_MODES, CONNECTION_STATES } from './utils/constants';

function App() {
  const [theme, setTheme] = useState('light');
  const [currentPage, setCurrentPage] = useState('home'); // 'home', 'matching', 'chat'
  const [chatMode, setChatMode] = useState('text');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [showInterests, setShowInterests] = useState(false);
  
  // Chat state
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [matchingStatus, setMatchingStatus] = useState('');
  
  // Video call state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState('idle');
  const [webrtcError, setWebrtcError] = useState(null);

  // Video refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Popular interests
  const popularInterests = [
    'Music', 'Movies', 'Gaming', 'Technology', 'Sports', 'Art', 'Books',
    'Travel', 'Food', 'Photography', 'Science', 'Nature', 'Fitness',
    'Anime', 'Programming', 'Fashion', 'Cooking', 'Dancing', 'Writing'
  ];

  const toggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else if (selectedInterests.length < 5) {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  // Initialize services
  useEffect(() => {
    console.log('🚀 Initializing services...');
    
    // Connect socket
    socketService.connect();

    // Initialize WebRTC service
    webrtcService.initialize(socketService);

    // Setup WebRTC callbacks
    webrtcService.onLocalStream = (stream) => {
      console.log('📹 Local stream received:', stream);
      setLocalStream(stream);
      
      // Directly set the video element source
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('✅ Local video element updated');
      }
    };

    webrtcService.onRemoteStream = (stream) => {
      console.log('📺 Remote stream received:', stream);
      setRemoteStream(stream);
      
      // Directly set the video element source
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        console.log('✅ Remote video element updated');
      }
    };

    webrtcService.onConnectionStateChange = (state) => {
      console.log('🔗 WebRTC connection state:', state);
      if (state === 'connected') {
        setCallStatus('connected');
      } else if (state === 'failed' || state === 'disconnected') {
        setCallStatus('idle');
      }
    };

    webrtcService.onError = (error) => {
      console.error('❌ WebRTC error:', error);
      setWebrtcError(error);
      setCallStatus('idle');
    };

    // Setup socket listeners
    socketService.on('match-found', handleMatchFound);
    socketService.on('message-received', handleMessageReceived);
    socketService.on('partner-disconnected', handlePartnerDisconnected);

    return () => {
      console.log('🧹 Cleaning up services...');
      webrtcService.cleanup();
      socketService.disconnect();
    };
  }, []);

  // Update video elements when streams change
  useEffect(() => {
    console.log('🔄 Local stream effect triggered:', !!localStream);
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      // Ensure autoplay works
      localVideoRef.current.play().catch(e => console.log('Local video autoplay failed:', e));
      console.log('✅ Local video updated in effect');
    }
  }, [localStream]);

  useEffect(() => {
    console.log('🔄 Remote stream effect triggered:', !!remoteStream);
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      // Ensure autoplay works
      remoteVideoRef.current.play().catch(e => console.log('Remote video autoplay failed:', e));
      console.log('✅ Remote video updated in effect');
    }
  }, [remoteStream]);

  // Socket event handlers
  const handleMatchFound = (matchData) => {
    console.log('🎯 Match found:', matchData);
    setPartner({
      id: matchData.partnerId,
      commonInterests: matchData.commonInterests || []
    });
    setConnectionStatus('connected');
    setCurrentPage('chat');
    setMatchingStatus('');
    
    // Start video call if in video mode
    if (chatMode === 'video') {
      console.log('📞 Starting video call...');
      webrtcService.startCall(matchData.partnerId);
      setCallStatus('calling');
    }
  };

  const handleMessageReceived = (messageData) => {
    const newMessage = {
      id: Date.now(),
      content: messageData.content,
      sender: 'partner',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handlePartnerDisconnected = () => {
    console.log('👋 Partner disconnected');
    handleEndChat();
  };

  const handleStartChat = async () => {
    console.log('🚀 Starting chat...', { chatMode, selectedInterests });
    setCurrentPage('matching');
    setMatchingStatus('Looking for someone to chat with...');
    setConnectionStatus('connecting');
    setWebrtcError(null);
    
    // If video mode, request camera/microphone permissions first
    if (chatMode === 'video') {
      try {
        console.log('🎥 Requesting camera/microphone access...');
        setCallStatus('calling');
        
        // Pre-initialize user media to request permissions
        const stream = await webrtcService.getUserMedia({ video: true, audio: true });
        console.log('✅ Camera and microphone access granted:', stream);
        
        // Set the local stream immediately
        setLocalStream(stream);
        
        // Update video element immediately
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.log('Video play failed:', e));
        }
        
      } catch (error) {
        console.error('❌ Failed to get user media:', error);
        setWebrtcError('Unable to access camera/microphone. Please check permissions and try again.');
        setCurrentPage('home');
        setCallStatus('idle');
        return;
      }
    }
    
    // Join matching queue
    socketService.joinQueue({
      interests: selectedInterests,
      mode: chatMode,
      sessionId: Date.now().toString()
    });
  };

  const handleSendMessage = () => {
    if (messageInput.trim() && partner) {
      const newMessage = {
        id: Date.now(),
        content: messageInput.trim(),
        sender: 'you',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      // Send message via socket
      socketService.sendMessage({
        content: messageInput.trim(),
        to: partner.id,
        timestamp: new Date().toISOString()
      });
      
      setMessageInput('');
    }
  };

  const handleSkipUser = () => {
    setMessages([]);
    setPartner(null);
    setConnectionStatus('connecting');
    setMatchingStatus('Looking for someone else...');
    
    // End current call and start new matching
    if (chatMode === 'video') {
      webrtcService.endCall();
      setRemoteStream(null);
      setCallStatus('calling');
    }
    
    // Skip current user and find new match
    socketService.skipUser();
  };

  const handleEndChat = () => {
    console.log('🛑 Ending chat...');
    setCurrentPage('home');
    setPartner(null);
    setMessages([]);
    setConnectionStatus('disconnected');
    setMatchingStatus('');
    setWebrtcError(null);
    
    // End WebRTC call
    if (chatMode === 'video') {
      webrtcService.endCall();
      setLocalStream(null);
      setRemoteStream(null);
      setCallStatus('idle');
    }
    
    // Disconnect from current chat
    socketService.disconnectChat();
  };

  const toggleVideo = () => {
    const enabled = webrtcService.toggleVideo();
    setIsVideoEnabled(enabled);
  };

  const toggleAudio = () => {
    const enabled = webrtcService.toggleAudio();
    setIsAudioEnabled(enabled);
  };

  // Update video/audio status based on WebRTC service
  useEffect(() => {
    const interval = setInterval(() => {
      if (webrtcService.localStream) {
        setIsVideoEnabled(webrtcService.isVideoEnabled());
        setIsAudioEnabled(webrtcService.isAudioEnabled());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const renderHomePage = () => (
    <main className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Welcome to Anonverse
        </h2>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
          Connect with strangers worldwide through anonymous text chat or video calls. 
          Safe, secure, and completely anonymous.
        </p>
        
        {/* Age Warning */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-center text-red-800 dark:text-red-300">
            <Shield className="w-5 h-5 mr-2" />
            <span className="font-semibold">YOU MUST BE 18 OR OLDER TO USE ANONVERSE</span>
          </div>
        </div>

        {/* Error Display */}
        {webrtcError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
            <div className="text-red-800 dark:text-red-300">
              <p className="font-semibold">Camera/Microphone Error:</p>
              <p>{webrtcError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="text-xl font-semibold mb-2">Meet New People</h3>
          <p className="text-gray-600 dark:text-gray-300">
            Connect with strangers from around the world who share your interests
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow">
          <div className="text-4xl mb-4">🛡️</div>
          <h3 className="text-xl font-semibold mb-2">Stay Anonymous</h3>
          <p className="text-gray-600 dark:text-gray-300">
            Chat safely without revealing your identity unless you choose to
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow">
          <div className="text-4xl mb-4">⚡</div>
          <h3 className="text-xl font-semibold mb-2">Instant Connection</h3>
          <p className="text-gray-600 dark:text-gray-300">
            Get matched instantly with someone new. Skip anytime to find your perfect chat partner
          </p>
        </div>
      </div>

      {/* Chat Mode Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
        <h3 className="text-3xl font-bold text-center mb-8">Choose Your Experience</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setChatMode('text')}
            className={`p-8 border-2 rounded-xl transition-all transform hover:scale-105 ${
              chatMode === 'text'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 scale-105'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
            }`}
          >
            <MessageCircle className="w-16 h-16 mx-auto mb-4" />
            <h4 className="text-2xl font-semibold mb-3">Text Chat</h4>
            <p className="text-sm opacity-75">
              Connect through messages. Perfect for casual conversations and getting to know someone.
            </p>
          </button>

          <button
            onClick={() => setChatMode('video')}
            className={`p-8 border-2 rounded-xl transition-all transform hover:scale-105 ${
              chatMode === 'video'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 scale-105'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Video className="w-16 h-16 mx-auto mb-4" />
            <h4 className="text-2xl font-semibold mb-3">Video Call & Chat</h4>
            <p className="text-sm opacity-75">
              Face-to-face conversations with voice and video. More personal and engaging experience.
            </p>
          </button>
        </div>
      </div>

      {/* Interest Selection */}
      {showInterests && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
          <h3 className="text-2xl font-bold text-center mb-6">What are you interested in?</h3>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
            Select up to 5 topics you'd like to discuss (optional)
          </p>
          
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {popularInterests.map((interest) => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  selectedInterests.includes(interest)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
          
          {selectedInterests.length > 0 && (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Selected: {selectedInterests.join(', ')} ({selectedInterests.length}/5)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="text-center">
        {!showInterests ? (
          <div className="space-y-4">
            <button
              onClick={handleStartChat}
              className="group inline-flex items-center px-12 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xl font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              {chatMode === 'text' ? (
                <MessageCircle className="w-6 h-6 mr-3" />
              ) : (
                <Video className="w-6 h-6 mr-3" />
              )}
              Start {chatMode === 'text' ? 'Text Chat' : 'Video Call & Chat'}
              <span className="ml-3 group-hover:translate-x-1 transition-transform">→</span>
            </button>
            
            <div className="text-sm text-gray-500 dark:text-gray-400">
              or{' '}
              <button
                onClick={() => setShowInterests(true)}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                add your interests first
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleStartChat}
              className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              {chatMode === 'text' ? (
                <MessageCircle className="w-5 h-5 mr-2" />
              ) : (
                <Video className="w-5 h-5 mr-2" />
              )}
              Start {chatMode === 'text' ? 'Chat' : 'Video Call'} 
              {selectedInterests.length > 0 && ` (${selectedInterests.length} interests)`}
            </button>
            
            <button
              onClick={() => {
                setSelectedInterests([]);
                handleStartChat();
              }}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Start Random Chat
            </button>
          </div>
        )}
      </div>
    </main>
  );

  const renderMatchingPage = () => (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 text-center">
        <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6"></div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {matchingStatus}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {selectedInterests.length > 0
            ? `Looking for someone interested in: ${selectedInterests.join(', ')}`
            : 'Connecting you with a random stranger'
          }
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Mode: {chatMode === 'text' ? 'Text Chat' : 'Video Call & Chat'}
        </p>
        
        {callStatus === 'calling' && chatMode === 'video' && (
          <div className="mb-6">
            <div className="w-48 h-36 bg-gray-800 rounded-lg overflow-hidden mx-auto mb-4 border-2 border-blue-500">
              <VideoStream
                stream={localStream}
                muted={true}
                mirrored={true}
                placeholder="Loading camera..."
                className="w-full h-full"
                onVideoLoad={() => console.log('✅ Local video loaded in matching')}
                onVideoError={(error) => console.error('❌ Local video error in matching:', error)}
              />
            </div>
            <p className="text-sm text-green-600 dark:text-green-400">
              {localStream ? '✓ Camera and microphone ready' : '📹 Requesting camera access...'}
            </p>
          </div>
        )}
        
        <button
          onClick={handleEndChat}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </main>
  );

  const renderChatPage = () => (
    <main className="max-w-6xl mx-auto px-4 py-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden h-[calc(100vh-120px)]">
        {/* Chat Header */}
        <div className="bg-green-50 dark:bg-green-900/20 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Connected to Stranger
                </h3>
                {partner?.commonInterests?.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Common interests: {partner.commonInterests.join(', ')}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {chatMode === 'video' && (
                <>
                  <button
                    onClick={toggleVideo}
                    className={`p-2 rounded-lg transition-colors ${
                      isVideoEnabled 
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
                        : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                    }`}
                    title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOffIcon className="w-4 h-4" />}
                  </button>
                  
                  <button
                    onClick={toggleAudio}
                    className={`p-2 rounded-lg transition-colors ${
                      isAudioEnabled 
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
                        : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                    }`}
                    title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                </>
              )}
              
              <button
                onClick={handleSkipUser}
                className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 text-sm rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/30 transition-colors"
              >
                <SkipForward className="w-4 h-4 inline mr-1" />
                Next
              </button>
              
              <button
                onClick={handleEndChat}
                className="px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-sm rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
              >
                <Home className="w-4 h-4 inline mr-1" />
                Home
              </button>
            </div>
          </div>
        </div>

        <div className="flex h-full">
          {/* Video Section (if video mode) */}
          {chatMode === 'video' && (
            <div className="w-1/2 bg-black relative">
              {/* Remote Video */}
              <VideoStream
                stream={remoteStream}
                muted={false}
                mirrored={false}
                placeholder="Waiting for partner's video..."
                className="w-full h-full"
                onVideoLoad={() => console.log('✅ Remote video loaded')}
                onVideoError={(error) => console.error('❌ Remote video error:', error)}
              />
              
              {/* Local Video (Picture in Picture) */}
              <div className="absolute bottom-20 right-4 w-40 h-32 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg">
                <VideoStream
                  stream={localStream}
                  muted={true}
                  mirrored={true}
                  placeholder="Your Video"
                  className="w-full h-full"
                  onVideoLoad={() => console.log('✅ Local PIP video loaded')}
                  onVideoError={(error) => console.error('❌ Local PIP video error:', error)}
                />
              </div>
              
              {/* Video Controls */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <div className="flex items-center space-x-4 bg-black bg-opacity-70 text-white px-6 py-3 rounded-full backdrop-blur-sm">
                  <button 
                    onClick={toggleAudio} 
                    className={`p-3 rounded-full transition-colors ${
                      isAudioEnabled 
                        ? 'hover:bg-gray-600' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                    title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={toggleVideo} 
                    className={`p-3 rounded-full transition-colors ${
                      isVideoEnabled 
                        ? 'hover:bg-gray-600' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                    title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOffIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Chat Section */}
          <div className={`${chatMode === 'video' ? 'w-1/2' : 'w-full'} flex flex-col`}>
            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Start a conversation
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Say hello to your new chat partner!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'you' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          message.sender === 'you'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold">
                Anon<span className="text-blue-200">verse</span>
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {currentPage === 'chat' && (
                <div className="text-sm">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    {chatMode === 'text' ? '💬 Text Chat' : '📹 Video Call'}
                  </span>
                </div>
              )}
              
              <button
                onClick={toggleTheme}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
              >
                {theme === 'light' ? '🌙' : '☀️'} {theme === 'light' ? 'Dark' : 'Light'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {currentPage === 'home' && renderHomePage()}
      {currentPage === 'matching' && renderMatchingPage()}
      {currentPage === 'chat' && renderChatPage()}

      {/* Footer */}
      {currentPage === 'home' && (
        <footer className="bg-gray-800 dark:bg-gray-900 text-white py-8 mt-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-lg font-semibold mb-2">Anonverse - Anonymous Universe</p>
            <p className="text-sm text-gray-400">
              Connect anonymously, chat safely, explore the universe of conversations
            </p>
            <p className="text-xs text-gray-500 mt-4">
              You must be 18 or older to use this service
            </p>
          </div>
        </footer>
      )}
      {/* Debug Panel (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <DebugPanel 
          localStream={localStream} 
          remoteStream={remoteStream}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
        />
      )}
    </div>
  );
}

export default App;