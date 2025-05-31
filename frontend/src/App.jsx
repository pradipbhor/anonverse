import React, { useState, useEffect } from 'react';
import { Globe, MessageCircle, Video, Users, Shield, Phone, PhoneOff, Mic, MicOff, VideoOff as VideoOffIcon, SkipForward, Home } from 'lucide-react';

// Mock Socket Service (you can replace with real socket.io later)
const mockSocket = {
  emit: (event, data) => {
    console.log('Socket emit:', event, data);
    // Simulate finding a match after 2 seconds
    if (event === 'join-queue') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('match-found', {
          detail: {
            partnerId: 'mock-partner-123',
            commonInterests: data.interests?.slice(0, 2) || [],
            mode: data.mode,
            roomId: 'mock-room-456'
          }
        }));
      }, 2000);
    }
  },
  on: (event, callback) => {
    window.addEventListener(event, (e) => callback(e.detail));
  },
  off: (event, callback) => {
    window.removeEventListener(event, callback);
  }
};

// Mock WebRTC Service
class MockWebRTCService {
  constructor() {
    this.localStream = null;
    this.remoteStream = null;
    this.isVideoEnabled = true;
    this.isAudioEnabled = true;
    this.connectionState = 'new';
  }

  async getUserMedia() {
    try {
      // Create a mock video stream
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      
      // Draw a simple pattern
      ctx.fillStyle = '#4F46E5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = '30px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Your Video', canvas.width/2, canvas.height/2 - 20);
      ctx.fillText('(Mock Stream)', canvas.width/2, canvas.height/2 + 20);
      
      this.localStream = canvas.captureStream(30);
      return this.localStream;
    } catch (error) {
      console.error('Error getting user media:', error);
      throw error;
    }
  }

  async startCall(partnerId) {
    await this.getUserMedia();
    this.connectionState = 'connected';
    
    // Simulate remote stream after 1 second
    setTimeout(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = '#7C3AED';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = '30px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Partner Video', canvas.width/2, canvas.height/2 - 20);
      ctx.fillText('(Mock Stream)', canvas.width/2, canvas.height/2 + 20);
      
      this.remoteStream = canvas.captureStream(30);
      window.dispatchEvent(new CustomEvent('remote-stream', { detail: this.remoteStream }));
    }, 1000);
  }

  toggleVideo() {
    this.isVideoEnabled = !this.isVideoEnabled;
    return this.isVideoEnabled;
  }

  toggleAudio() {
    this.isAudioEnabled = !this.isAudioEnabled;
    return this.isAudioEnabled;
  }

  endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }
    this.connectionState = 'closed';
  }
}

const webrtcService = new MockWebRTCService();

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
  const [callStatus, setCallStatus] = useState('idle'); // 'idle', 'calling', 'connected'

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

  const handleStartChat = async () => {
    setCurrentPage('matching');
    setMatchingStatus('Looking for someone to chat with...');
    setConnectionStatus('connecting');
    
    // Join queue
    mockSocket.emit('join-queue', {
      interests: selectedInterests,
      mode: chatMode,
      sessionId: Date.now().toString()
    });

    // If video mode, prepare video call
    if (chatMode === 'video') {
      try {
        const stream = await webrtcService.getUserMedia();
        setLocalStream(stream);
        setCallStatus('calling');
      } catch (error) {
        console.error('Failed to get user media:', error);
        alert('Unable to access camera/microphone. Please check permissions.');
      }
    }
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
      setMessageInput('');
      
      // Simulate partner response
      setTimeout(() => {
        const responses = [
          "That's interesting! Tell me more.",
          "I totally agree with you!",
          "What do you think about that?",
          "Haha, that's funny!",
          "Really? I had no idea!",
          "Cool! I like that too.",
          "What's your favorite part about it?"
        ];
        
        const response = {
          id: Date.now() + 1,
          content: responses[Math.floor(Math.random() * responses.length)],
          sender: 'partner',
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, response]);
      }, 1000 + Math.random() * 2000);
    }
  };

  const handleSkipUser = () => {
    setMessages([]);
    setPartner(null);
    setConnectionStatus('connecting');
    setMatchingStatus('Looking for someone else...');
    
    if (chatMode === 'video') {
      webrtcService.endCall();
      setRemoteStream(null);
      setCallStatus('calling');
    }
    
    // Simulate finding new match
    setTimeout(() => {
      const newPartner = {
        id: Date.now().toString(),
        commonInterests: selectedInterests.slice(0, Math.floor(Math.random() * 3) + 1)
      };
      setPartner(newPartner);
      setConnectionStatus('connected');
      setMatchingStatus('');
      
      if (chatMode === 'video') {
        webrtcService.startCall(newPartner.id);
        setCallStatus('connected');
      }
    }, 1500);
  };

  const handleEndChat = () => {
    setCurrentPage('home');
    setPartner(null);
    setMessages([]);
    setConnectionStatus('disconnected');
    setMatchingStatus('');
    
    if (chatMode === 'video') {
      webrtcService.endCall();
      setLocalStream(null);
      setRemoteStream(null);
      setCallStatus('idle');
    }
  };

  const toggleVideo = () => {
    const enabled = webrtcService.toggleVideo();
    setIsVideoEnabled(enabled);
  };

  const toggleAudio = () => {
    const enabled = webrtcService.toggleAudio();
    setIsAudioEnabled(enabled);
  };

  // Socket event listeners
  useEffect(() => {
    const handleMatchFound = (matchData) => {
      setPartner({
        id: matchData.partnerId,
        commonInterests: matchData.commonInterests
      });
      setConnectionStatus('connected');
      setCurrentPage('chat');
      setMatchingStatus('');
      
      if (chatMode === 'video') {
        webrtcService.startCall(matchData.partnerId);
        setCallStatus('connected');
      }
    };

    const handleRemoteStream = (stream) => {
      setRemoteStream(stream);
    };

    mockSocket.on('match-found', handleMatchFound);
    window.addEventListener('remote-stream', (e) => handleRemoteStream(e.detail));

    return () => {
      mockSocket.off('match-found', handleMatchFound);
      window.removeEventListener('remote-stream', handleRemoteStream);
    };
  }, [chatMode]);

  // Video stream effects
  useEffect(() => {
    if (localStream) {
      const localVideo = document.getElementById('localVideo');
      if (localVideo) {
        localVideo.srcObject = localStream;
      }
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream) {
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
      }
    }
  }, [remoteStream]);

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
              <video
                id="remoteVideo"
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Local Video (Picture in Picture) */}
              <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
                <video
                  id="localVideo"
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              </div>
              
              {/* Video Controls */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <div className="flex items-center space-x-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full">
                  <button onClick={toggleAudio} className="p-2 hover:bg-gray-700 rounded-full">
                    {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button onClick={toggleVideo} className="p-2 hover:bg-gray-700 rounded-full">
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
    </div>
  );
}

export default App;