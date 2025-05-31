import React, { useState, useEffect, useCallback } from 'react';
import { useChat } from '../hooks/useChat';
import { useWebRTC } from '../hooks/useWebRTC';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import VideoChat from './VideoChat';
import LoadingSpinner from '../UI/LoadingSpinner';
import Modal from '../UI/Modal';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  SkipForward, 
  Home, 
  Flag, 
  Volume2,
  VolumeX,
  Users,
  Clock
} from 'lucide-react';

const ChatRoom = ({ socket, userSession, interests, chatMode, onEndChat }) => {
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [partner, setPartner] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [connectionTime, setConnectionTime] = useState(0);
  
  // Chat functionality
  const {
    messages,
    isTyping,
    partnerTyping,
    sendMessage,
    clearMessages
  } = useChat(socket, userSession?.id);

  // WebRTC functionality for video chat
  const {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    toggleVideo,
    toggleAudio,
    initializeCall,
    endCall
  } = useWebRTC(socket, chatMode === 'video');

  // Connection timer
  useEffect(() => {
    let interval;
    if (connectionStatus === 'connected' && partner) {
      interval = setInterval(() => {
        setConnectionTime(prev => prev + 1);
      }, 1000);
    } else {
      setConnectionTime(0);
    }
    return () => clearInterval(interval);
  }, [connectionStatus, partner]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleMatchFound = (matchData) => {
      setPartner({
        id: matchData.partnerId,
        interests: matchData.commonInterests || [],
        mode: matchData.mode
      });
      setConnectionStatus('connected');
      clearMessages();
      
      // Initialize video call if in video mode
      if (chatMode === 'video') {
        initializeCall(matchData.partnerId);
      }
    };

    const handlePartnerDisconnected = () => {
      setPartner(null);
      setConnectionStatus('disconnected');
      if (chatMode === 'video') {
        endCall();
      }
    };

    const handleQueueStatus = (status) => {
      if (status.position !== undefined) {
        setConnectionStatus(`waiting`);
      }
    };

    const handleConnectionError = (error) => {
      console.error('Connection error:', error);
      setConnectionStatus('error');
    };

    // Register socket event listeners
    socket.on('match-found', handleMatchFound);
    socket.on('partner-disconnected', handlePartnerDisconnected);
    socket.on('queue-status', handleQueueStatus);
    socket.on('connection-error', handleConnectionError);

    // Cleanup
    return () => {
      socket.off('match-found', handleMatchFound);
      socket.off('partner-disconnected', handlePartnerDisconnected);
      socket.off('queue-status', handleQueueStatus);
      socket.off('connection-error', handleConnectionError);
    };
  }, [socket, chatMode, initializeCall, endCall, clearMessages]);

  const handleSendMessage = useCallback((message) => {
    if (partner && socket) {
      sendMessage(message, partner.id);
    }
  }, [partner, socket, sendMessage]);

  const handleSkipUser = useCallback(() => {
    if (socket) {
      socket.emit('skip-user');
      if (chatMode === 'video') {
        endCall();
      }
    }
    setPartner(null);
    setConnectionStatus('connecting');
    setConnectionTime(0);
  }, [socket, chatMode, endCall]);

  const handleReportUser = useCallback((reason) => {
    if (socket && partner) {
      socket.emit('report-user', {
        reportedUserId: partner.id,
        reason: reason,
        reporterId: userSession?.id
      });
      setShowReportModal(false);
      setReportReason('');
      // Optionally skip after reporting
      handleSkipUser();
    }
  }, [socket, partner, userSession, handleSkipUser]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderConnectionStatus = () => {
    switch (connectionStatus) {
      case 'connecting':
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <LoadingSpinner size="lg" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mt-4">
              Looking for someone to chat with...
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {interests.length > 0 
                ? `Matching based on: ${interests.join(', ')}` 
                : 'Connecting you with a random stranger'
              }
            </p>
          </div>
        );
      
      case 'waiting':
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <LoadingSpinner size="lg" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mt-4">
              You're in the queue
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Please wait while we find the perfect match for you...
            </p>
          </div>
        );
      
      case 'disconnected':
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <Users className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
              Stranger disconnected
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2 mb-4">
              Your chat partner has left the conversation
            </p>
            <button
              onClick={() => {
                setConnectionStatus('connecting');
                socket?.emit('join-queue', {
                  interests,
                  mode: chatMode,
                  sessionId: userSession?.id
                });
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Find New Stranger
            </button>
          </div>
        );
      
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-red-500 mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
              Connection Error
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2 mb-4">
              Unable to connect. Please try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (connectionStatus !== 'connected' || !partner) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Anonverse Chat
            </h2>
            <button
              onClick={onEndChat}
              className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </button>
          </div>
          
          {/* Connection Status */}
          {renderConnectionStatus()}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Connected to Stranger
              </h3>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4 mr-1" />
                {formatTime(connectionTime)}
                {partner.interests.length > 0 && (
                  <span className="ml-4">
                    Common interests: {partner.interests.join(', ')}
                  </span>
                )}
              </div>
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
                  {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
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
              onClick={() => setShowReportModal(true)}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Report user"
            >
              <Flag className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleSkipUser}
              className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 text-sm rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/30 transition-colors"
            >
              <SkipForward className="w-4 h-4 inline mr-1" />
              Next
            </button>
            
            <button
              onClick={onEndChat}
              className="px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-sm rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
            >
              Stop
            </button>
          </div>
        </div>

        {/* Video Chat Area */}
        {chatMode === 'video' && (
          <VideoChat
            localStream={localStream}
            remoteStream={remoteStream}
            isVideoEnabled={isVideoEnabled}
            isAudioEnabled={isAudioEnabled}
          />
        )}

        {/* Chat Messages */}
        <div className="h-96">
          <MessageList 
            messages={messages}
            partnerTyping={partnerTyping}
            userSession={userSession}
          />
        </div>

        {/* Message Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={!partner}
          placeholder={partner ? "Type a message..." : "Connecting..."}
        />
      </div>

      {/* Report Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Report User"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Why are you reporting this user?
          </p>
          
          <div className="space-y-2">
            {[
              'Inappropriate content',
              'Harassment or bullying',
              'Spam or advertisements',
              'Underage user',
              'Other inappropriate behavior'
            ].map((reason) => (
              <label key={reason} className="flex items-center">
                <input
                  type="radio"
                  name="reportReason"
                  value={reason}
                  checked={reportReason === reason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="mr-2"
                />
                {reason}
              </label>
            ))}
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <button
              onClick={() => setShowReportModal(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => handleReportUser(reportReason)}
              disabled={!reportReason}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Report
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ChatRoom;