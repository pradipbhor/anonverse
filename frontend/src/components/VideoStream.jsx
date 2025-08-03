import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, VideoOff } from 'lucide-react';

const VideoStream = ({ 
  stream, 
  muted = false, 
  mirrored = false, 
  placeholder = "No video", 
  className = "",
  onVideoLoad,
  onVideoError,
  autoPlay = true,
  playsInline = true,
  controls = false
}) => {
  const videoRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Force video update when stream changes
  const updateVideoStream = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      console.log('🔄 Updating video stream:', stream ? 'new stream' : 'no stream');
      
      // Reset state
      setHasError(false);
      setIsLoaded(false);

      if (stream) {
        // Set srcObject
        video.srcObject = stream;
        
        // Ensure video properties are set
        video.muted = muted;
        video.autoplay = autoPlay;
        video.playsInline = playsInline;
        video.controls = controls;

        // Try to play the video
        if (autoPlay) {
          try {
            await video.play();
            console.log('✅ Video playing successfully');
            setIsLoaded(true);
            if (onVideoLoad) onVideoLoad();
          } catch (playError) {
            console.warn('⚠️ Autoplay failed, user interaction may be required:', playError);
            // Don't treat autoplay failure as a fatal error
            setIsLoaded(true);
          }
        } else {
          setIsLoaded(true);
        }
      } else {
        // No stream, clear the video
        video.srcObject = null;
        console.log('🧹 Video stream cleared');
      }
    } catch (error) {
      console.error('❌ Error updating video stream:', error);
      setHasError(true);
      if (onVideoError) onVideoError(error);
      
      // Retry logic
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying video update (${retryCount + 1}/${maxRetries})...`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 1000);
      }
    }
  }, [stream, muted, autoPlay, playsInline, controls, onVideoLoad, onVideoError, retryCount, maxRetries]);

  // Update video when stream changes
  useEffect(() => {
    updateVideoStream();
  }, [updateVideoStream]);

  // Reset retry count when stream changes
  useEffect(() => {
    setRetryCount(0);
  }, [stream]);

  // Video event handlers
  const handleLoadedMetadata = () => {
    console.log('📺 Video metadata loaded');
    setIsLoaded(true);
    if (onVideoLoad) onVideoLoad();
  };

  const handleError = (event) => {
    console.error('❌ Video error:', event);
    setHasError(true);
    if (onVideoError) onVideoError(event);
  };

  const handleCanPlay = () => {
    console.log('✅ Video can play');
    setIsLoaded(true);
  };

  // Manual play function for user interaction
  const handleManualPlay = async () => {
    const video = videoRef.current;
    if (video) {
      try {
        await video.play();
        console.log('✅ Manual play successful');
      } catch (error) {
        console.error('❌ Manual play failed:', error);
      }
    }
  };

  // Render placeholder content
  const renderPlaceholder = () => (
    <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white">
      {hasError ? (
        <>
          <VideoOff className="w-12 h-12 mb-2 text-red-400" />
          <p className="text-sm text-red-300">Video Error</p>
          <button 
            onClick={() => {
              setHasError(false);
              setRetryCount(0);
            }}
            className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
          >
            Retry
          </button>
        </>
      ) : (
        <>
          <Video className="w-12 h-12 mb-2 text-gray-400" />
          <p className="text-sm text-gray-300">{placeholder}</p>
          {stream && !isLoaded && (
            <button 
              onClick={handleManualPlay}
              className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
            >
              Click to Play
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        className={`w-full h-full object-cover ${mirrored ? 'transform scale-x-[-1]' : ''} ${
          (!stream || !isLoaded) ? 'hidden' : 'block'
        }`}
        muted={muted}
        autoPlay={autoPlay}
        playsInline={playsInline}
        controls={controls}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onError={handleError}
        style={{ backgroundColor: '#000' }}
      />
      
      {/* Placeholder overlay */}
      {(!stream || !isLoaded || hasError) && (
        <div className="absolute inset-0">
          {renderPlaceholder()}
        </div>
      )}

      {/* Debug info overlay (development only) */}
      {process.env.NODE_ENV === 'development' && stream && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded">
          Stream: {stream.active ? '🟢' : '🔴'} | 
          Tracks: V:{stream.getVideoTracks().length} A:{stream.getAudioTracks().length} |
          Loaded: {isLoaded ? '✅' : '❌'}
        </div>
      )}
    </div>
  );
};

export default VideoStream;