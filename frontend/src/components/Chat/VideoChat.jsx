import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, Settings } from 'lucide-react';

const VideoChat = ({ 
  localStream, 
  remoteStream, 
  isVideoEnabled, 
  isAudioEnabled,
  onToggleVideo,
  onToggleAudio 
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [videoSettings, setVideoSettings] = useState({
    resolution: '720p',
    frameRate: 30
  });

  // Set up video streams
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

  const toggleFullscreen = () => {
    const videoContainer = document.getElementById('video-container');
    
    if (!document.fullscreenElement) {
      videoContainer.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const VideoPlaceholder = ({ type, isEnabled }) => (
    <div className="flex items-center justify-center h-full bg-gray-900 text-white">
      <div className="text-center">
        {!isEnabled ? (
          <>
            <VideoOff className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-300">
              {type === 'local' ? 'Your camera is off' : "Stranger's camera is off"}
            </p>
          </>
        ) : (
          <>
            <Video className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-300">
              {type === 'local' ? 'Starting your camera...' : 'Waiting for stranger...'}
            </p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div 
      id="video-container" 
      className={`relative bg-black ${
        isFullscreen ? 'fixed inset-0 z-50' : 'h-96'
      }`}
    >
      {/* Remote video (main view) */}
      <div className="relative w-full h-full">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="w-full h-full object-cover"
          />
        ) : (
          <VideoPlaceholder type="remote" isEnabled={true} />
        )}
        
        {/* Connection status overlay */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center space-x-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Connected</span>
          </div>
        </div>

        {/* Local video (picture-in-picture) */}
        <div className={`absolute ${
          isFullscreen ? 'bottom-20 right-4 w-48 h-36' : 'bottom-4 right-4 w-32 h-24'
        } bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg z-10`}>
          {localStream && isVideoEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
            />
          ) : (
            <VideoPlaceholder type="local" isEnabled={isVideoEnabled} />
          )}
          
          {/* Local video controls overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
            <button
              onClick={onToggleVideo}
              className="p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70"
            >
              {isVideoEnabled ? (
                <Video className="w-4 h-4" />
              ) : (
                <VideoOff className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Video controls */}
      <div className={`absolute ${
        isFullscreen ? 'bottom-4' : 'bottom-4'
      } left-1/2 transform -translate-x-1/2 z-20`}>
        <div className="flex items-center space-x-4 bg-black bg-opacity-70 backdrop-blur-sm text-white px-6 py-3 rounded-full">
          
          {/* Audio toggle */}
          <button
            onClick={onToggleAudio}
            className={`p-3 rounded-full transition-colors ${
              isAudioEnabled 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
            title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isAudioEnabled ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </button>

          {/* Video toggle */}
          <button
            onClick={onToggleVideo}
            className={`p-3 rounded-full transition-colors ${
              isVideoEnabled 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
            title="Video settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg shadow-lg p-4 min-w-64">
            <h3 className="font-semibold mb-3">Video Settings</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Resolution
                </label>
                <select
                  value={videoSettings.resolution}
                  onChange={(e) => setVideoSettings(prev => ({
                    ...prev,
                    resolution: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="480p">480p</option>
                  <option value="720p">720p (HD)</option>
                  <option value="1080p">1080p (Full HD)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Frame Rate
                </label>
                <select
                  value={videoSettings.frameRate}
                  onChange={(e) => setVideoSettings(prev => ({
                    ...prev,
                    frameRate: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                >
                  <option value={15}>15 FPS</option>
                  <option value={24}>24 FPS</option>
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quality indicator */}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex items-center space-x-1 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>HD</span>
        </div>
      </div>

      {/* Keyboard shortcuts info */}
      {isFullscreen && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-black bg-opacity-50 text-white text-xs px-3 py-1 rounded">
            Press <kbd className="bg-gray-700 px-1 rounded">Esc</kbd> to exit fullscreen
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoChat;