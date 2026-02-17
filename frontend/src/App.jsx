import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, MessageCircle, Video, Shield,
  Mic, MicOff, VideoOff as VideoOffIcon, SkipForward, Home, AlertTriangle
} from 'lucide-react';
import socketService from './services/socketService';
import webrtcService from './services/webrtcService';
import VideoStream from './components/VideoStream';

function App() {
  const [theme, setTheme] = useState('light');
  const [currentPage, setCurrentPage] = useState('home');
  const [chatMode, setChatMode] = useState('video');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [showInterests, setShowInterests] = useState(false);

  // Chat state
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [matchingStatus, setMatchingStatus] = useState('');

  // Video state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState('idle');

  // Moderation state
  const [moderationAlert, setModerationAlert] = useState(null);
  // null | { type: 'blocked'|'warning'|'kicked', message: string, categories: [] }

  // Error state
  const [webrtcError, setWebrtcError] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);

  const popularInterests = [
    'Music', 'Movies', 'Gaming', 'Technology', 'Sports', 'Art', 'Books',
    'Travel', 'Food', 'Photography', 'Science', 'Nature', 'Fitness',
    'Anime', 'Programming', 'Fashion', 'Cooking', 'Dancing', 'Writing'
  ];

  // ─── AUTO SCROLL ───────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── MODERATION ALERT TIMEOUT ──────────────────────────────
  // Auto-clear blocked/warning alerts after 5s (not kick — that navigates away)
  useEffect(() => {
    if (moderationAlert && moderationAlert.type !== 'kicked') {
      const t = setTimeout(() => setModerationAlert(null), 5000);
      return () => clearTimeout(t);
    }
  }, [moderationAlert]);

  // ─── INTERESTS ─────────────────────────────────────────────
  const toggleInterest = (interest) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < 5 ? [...prev, interest] : prev
    );
  };

  // ─── SOCKET HANDLERS ───────────────────────────────────────

  const handleMatchFound = (matchData) => {
    setPartner({ id: matchData.partnerId, commonInterests: matchData.commonInterests || [] });
    setConnectionStatus('connected');
    setCurrentPage('chat');
    setMatchingStatus('');

    if (chatMode === 'video' && matchData.sendOffer) {
      webrtcService.startCall(matchData.partnerId);
      setCallStatus('calling');
    }
  };

  const handleMessageReceived = (msgData) => {
    setMessages(prev => [...prev, {
      id: msgData.id || Date.now(),
      content: msgData.content,
      sender: 'partner',
      timestamp: msgData.timestamp || new Date().toISOString()
    }]);
  };

  // ── Moderation: message blocked ────────────────────────────
  const handleMessageBlocked = ({ reason, categories, action }) => {
    setModerationAlert({
      type: 'blocked',
      message: reason || 'Your message was blocked by our content filter.',
      categories,
      action
    });
  };

  // ── Moderation: warning (repeat offender) ──────────────────
  const handleModerationWarning = ({ message, flagCount }) => {
    setModerationAlert({
      type: 'warning',
      message,
      flagCount
    });
  };

  // ── Moderation: kicked ─────────────────────────────────────
  const handleModerationKick = ({ message }) => {
    setModerationAlert({
      type: 'kicked',
      message
    });
    // Navigate home after short delay so user can read the message
    setTimeout(() => {
      handleEndChat();
      setModerationAlert(null);
    }, 3000);
  };

  const handlePartnerDisconnected = () => handleEndChat();

  // ─── START CHAT ────────────────────────────────────────────
  const handleStartChatAndVideo = async () => {
    try {
      socketService.connect(selectedInterests, chatMode);

      if (chatMode === 'video') {
        webrtcService.initialize(socketService);

        webrtcService.onLocalStream = (stream) => {
          setLocalStream(stream);
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        };
        webrtcService.onRemoteStream = (stream) => {
          setRemoteStream(stream);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        };
        webrtcService.onConnectionStateChange = (state) => {
          if (state === 'connected') setCallStatus('connected');
          else if (['failed', 'disconnected'].includes(state)) setCallStatus('idle');
        };
        webrtcService.onError = (err) => {
          setWebrtcError(err);
          setCallStatus('idle');
        };

        await webrtcService.getUserMedia();
        setCallStatus('calling');
      }

      // Register all socket event listeners
      socketService.on('match-found', handleMatchFound);
      socketService.on('message-received', handleMessageReceived);
      socketService.on('partner-disconnected', handlePartnerDisconnected);

      // ── Moderation events ───────────────────────────────────
      socketService.on('message-blocked', handleMessageBlocked);
      socketService.on('moderation-warning', handleModerationWarning);
      socketService.on('moderation-kick', handleModerationKick);

      setCurrentPage('matching');
      setMatchingStatus('Looking for someone to chat with...');
      setConnectionStatus('connecting');
      setWebrtcError(null);
      setModerationAlert(null);

    } catch (err) {
      console.error('Failed to start chat:', err);
      setWebrtcError('Unable to start chat. Please check your connection and try again.');
      setCurrentPage('home');
      setCallStatus('idle');
    }
  };

  // ─── SEND MESSAGE ──────────────────────────────────────────
  const handleSendMessage = () => {
    if (!messageInput.trim() || !partner) return;

    const optimistic = {
      id: `msg_${Date.now()}`,
      content: messageInput.trim(),
      sender: 'you',
      timestamp: new Date().toISOString(),
      pending: true   // will be confirmed or replaced by message-blocked
    };

    setMessages(prev => [...prev, optimistic]);
    socketService.sendMessage({ content: messageInput.trim() });
    setMessageInput('');
  };

  // ─── SKIP ──────────────────────────────────────────────────
  const handleSkipUser = () => {
    setMessages([]);
    setPartner(null);
    setConnectionStatus('connecting');
    setMatchingStatus('Looking for someone else...');
    setModerationAlert(null);

    if (chatMode === 'video') {
      webrtcService.endCall();
      setRemoteStream(null);
      setCallStatus('calling');
    }

    socketService.skipUser();
    socketService.joinQueue({ interests: selectedInterests, mode: chatMode });
  };

  // ─── END CHAT ──────────────────────────────────────────────
  const handleEndChat = () => {
    setCurrentPage('home');
    setPartner(null);
    setMessages([]);
    setConnectionStatus('disconnected');
    setMatchingStatus('');
    setWebrtcError(null);
    setModerationAlert(null);

    if (chatMode === 'video') {
      webrtcService.endCall();
      setLocalStream(null);
      setRemoteStream(null);
      setCallStatus('idle');
    }

    socketService.disconnectChat();
    socketService.disconnect();
  };

  const toggleVideo = () => setIsVideoEnabled(webrtcService.toggleVideo());
  const toggleAudio = () => setIsAudioEnabled(webrtcService.toggleAudio());

  useEffect(() => {
    return () => {
      if (chatMode === 'video') webrtcService.cleanup();
      socketService.disconnect();
    };
  }, []);

  // ─── MODERATION ALERT BANNER ───────────────────────────────
  const renderModerationAlert = () => {
    if (!moderationAlert) return null;

    const styles = {
      blocked: 'bg-red-50 border-red-300 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      warning: 'bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      kicked:  'bg-red-100 border-red-400 text-red-900 dark:bg-red-900/50 dark:text-red-200'
    };

    const icons = {
      blocked: '🚫',
      warning: '⚠️',
      kicked:  '🔴'
    };

    return (
      <div className={`border rounded-lg px-4 py-3 mb-2 flex items-start gap-2 text-sm ${styles[moderationAlert.type]}`}>
        <span className="text-base">{icons[moderationAlert.type]}</span>
        <div>
          <p className="font-semibold">
            {moderationAlert.type === 'blocked' && 'Message blocked'}
            {moderationAlert.type === 'warning' && 'Content warning'}
            {moderationAlert.type === 'kicked' && 'Removed from chat'}
          </p>
          <p>{moderationAlert.message}</p>
          {moderationAlert.categories?.length > 0 && (
            <p className="text-xs mt-1 opacity-75">
              Categories: {moderationAlert.categories.join(', ')}
            </p>
          )}
        </div>
      </div>
    );
  };

  // ─── PAGES ─────────────────────────────────────────────────

  const renderHomePage = () => (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Welcome to Anonverse
        </h2>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
          Connect with strangers worldwide through anonymous text chat or video calls.
        </p>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-center text-red-800 dark:text-red-300">
            <Shield className="w-5 h-5 mr-2" />
            <span className="font-semibold">YOU MUST BE 18 OR OLDER TO USE ANONVERSE</span>
          </div>
        </div>
        {webrtcError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 max-w-2xl mx-auto text-red-800">
            <p className="font-semibold">Error:</p>
            <p>{webrtcError}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {[
          { icon: '👥', title: 'Meet New People', desc: 'Connect with strangers from around the world who share your interests' },
          { icon: '🛡️', title: 'Stay Anonymous', desc: 'Chat safely without revealing your identity unless you choose to' },
          { icon: '⚡', title: 'Instant Connection', desc: 'Get matched instantly. Skip anytime to find your perfect chat partner' }
        ].map(f => (
          <div key={f.title} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="text-4xl mb-4">{f.icon}</div>
            <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
            <p className="text-gray-600 dark:text-gray-300">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Mode selector */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
        <h3 className="text-3xl font-bold text-center mb-8">Choose Your Experience</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {['text', 'video'].map(mode => (
            <button
              key={mode}
              onClick={() => setChatMode(mode)}
              className={`p-8 border-2 rounded-xl transition-all transform hover:scale-105 ${
                chatMode === mode
                  ? mode === 'text'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {mode === 'text'
                ? <MessageCircle className="w-16 h-16 mx-auto mb-4" />
                : <Video className="w-16 h-16 mx-auto mb-4" />
              }
              <h4 className="text-2xl font-semibold mb-3">
                {mode === 'text' ? 'Text Chat' : 'Video Call & Chat'}
              </h4>
            </button>
          ))}
        </div>
      </div>

      {/* Interest selector */}
      {showInterests && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
          <h3 className="text-2xl font-bold text-center mb-6">What are you interested in?</h3>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">Select up to 5 topics (optional)</p>
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {popularInterests.map(interest => (
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
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              Selected: {selectedInterests.join(', ')} ({selectedInterests.length}/5)
            </p>
          )}
        </div>
      )}

      <div className="text-center space-y-4">
        <button
          onClick={handleStartChatAndVideo}
          className="inline-flex items-center px-12 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xl font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
        >
          {chatMode === 'text' ? <MessageCircle className="w-6 h-6 mr-3" /> : <Video className="w-6 h-6 mr-3" />}
          Start {chatMode === 'text' ? 'Text Chat' : 'Video Call'}
        </button>
        {!showInterests && (
          <div className="text-sm text-gray-500">
            or{' '}
            <button onClick={() => setShowInterests(true)} className="text-blue-600 hover:underline">
              add your interests first
            </button>
          </div>
        )}
      </div>
    </main>
  );

  const renderMatchingPage = () => (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border text-center">
        <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6" />
        <h2 className="text-2xl font-bold mb-4">{matchingStatus}</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-8">Mode: {chatMode === 'text' ? 'Text Chat' : 'Video Call'}</p>
        <button onClick={handleEndChat} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Cancel
        </button>
      </div>
    </main>
  );

  const renderChatPage = () => (
    <main className="max-w-6xl mx-auto px-4 py-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>

        {/* Header */}
        <div className="bg-green-50 dark:bg-green-900/20 border-b p-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Connected to Stranger</h3>
              {partner?.commonInterests?.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Common: {partner.commonInterests.join(', ')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {chatMode === 'video' && (
              <>
                <button onClick={toggleVideo} className={`p-2 rounded-lg ${isVideoEnabled ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                  {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOffIcon className="w-4 h-4" />}
                </button>
                <button onClick={toggleAudio} className={`p-2 rounded-lg ${isAudioEnabled ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                  {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
              </>
            )}
            <button onClick={handleSkipUser} className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-lg hover:bg-yellow-200">
              <SkipForward className="w-4 h-4 inline mr-1" />Next
            </button>
            <button onClick={handleEndChat} className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-lg hover:bg-red-200">
              <Home className="w-4 h-4 inline mr-1" />Home
            </button>
          </div>
        </div>

        <div className="flex" style={{ height: 'calc(100% - 73px)' }}>
          {/* Video */}
          {chatMode === 'video' && (
            <div className="w-1/2 bg-black relative">
              <VideoStream stream={remoteStream} muted={false} mirrored={false} placeholder="Waiting for partner's video..." className="w-full h-full" videoRef={remoteVideoRef} />
              <div className="absolute bottom-20 right-4 w-40 h-32 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg">
                <VideoStream stream={localStream} muted mirrored placeholder="Your Video" className="w-full h-full" videoRef={localVideoRef} />
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 bg-black/70 px-6 py-3 rounded-full">
                <button onClick={toggleAudio} className={`p-3 rounded-full ${isAudioEnabled ? 'hover:bg-gray-600' : 'bg-red-600'}`}>
                  {isAudioEnabled ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
                </button>
                <button onClick={toggleVideo} className={`p-3 rounded-full ${isVideoEnabled ? 'hover:bg-gray-600' : 'bg-red-600'}`}>
                  {isVideoEnabled ? <Video className="w-5 h-5 text-white" /> : <VideoOffIcon className="w-5 h-5 text-white" />}
                </button>
              </div>
            </div>
          )}

          {/* Chat */}
          <div className={`${chatMode === 'video' ? 'w-1/2' : 'w-full'} flex flex-col`}>
            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Say hello to your new chat partner!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'you' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                        msg.sender === 'you'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'
                      }`}>
                        <p>{msg.content}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Moderation alert banner — above input */}
            <div className="px-4">
              {renderModerationAlert()}
            </div>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Anon<span className="text-blue-200">verse</span></h1>
          </div>
          <button
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
          >
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </header>

      {currentPage === 'home' && renderHomePage()}
      {currentPage === 'matching' && renderMatchingPage()}
      {currentPage === 'chat' && renderChatPage()}

      {currentPage === 'home' && (
        <footer className="bg-gray-800 text-white py-8 mt-16 text-center">
          <p className="text-lg font-semibold mb-2">Anonverse — Anonymous Universe</p>
          <p className="text-xs text-gray-500 mt-2">You must be 18 or older to use this service</p>
        </footer>
      )}
    </div>
  );
}

export default App;