import React, { useState, useEffect } from 'react';
import { Bug, Eye, EyeOff } from 'lucide-react';
import webrtcService from '../services/webrtcService';

const DebugPanel = ({ localStream, remoteStream, localVideoRef, remoteVideoRef }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});
  const [devices, setDevices] = useState({});

  useEffect(() => {
    const updateDebugInfo = () => {
      const info = {
        webrtcSupported: webrtcService.constructor.isSupported(),
        webrtcDebugInfo: webrtcService.getDebugInfo(),
        localStreamInfo: localStream ? {
          id: localStream.id,
          active: localStream.active,
          videoTracks: localStream.getVideoTracks().map(track => ({
            id: track.id,
            kind: track.kind,
            label: track.label,
            enabled: track.enabled,
            readyState: track.readyState,
            muted: track.muted
          })),
          audioTracks: localStream.getAudioTracks().map(track => ({
            id: track.id,
            kind: track.kind,
            label: track.label,
            enabled: track.enabled,
            readyState: track.readyState,
            muted: track.muted
          }))
        } : null,
        remoteStreamInfo: remoteStream ? {
          id: remoteStream.id,
          active: remoteStream.active,
          videoTracks: remoteStream.getVideoTracks().length,
          audioTracks: remoteStream.getAudioTracks().length
        } : null,
        videoElementInfo: {
          local: localVideoRef?.current ? {
            hasSrcObject: !!localVideoRef.current.srcObject,
            readyState: localVideoRef.current.readyState,
            videoWidth: localVideoRef.current.videoWidth,
            videoHeight: localVideoRef.current.videoHeight,
            paused: localVideoRef.current.paused,
            muted: localVideoRef.current.muted,
            autoplay: localVideoRef.current.autoplay,
            playsInline: localVideoRef.current.playsInline
          } : null,
          remote: remoteVideoRef?.current ? {
            hasSrcObject: !!remoteVideoRef.current.srcObject,
            readyState: remoteVideoRef.current.readyState,
            videoWidth: remoteVideoRef.current.videoWidth,
            videoHeight: remoteVideoRef.current.videoHeight,
            paused: remoteVideoRef.current.paused,
            muted: remoteVideoRef.current.muted,
            autoplay: remoteVideoRef.current.autoplay,
            playsInline: remoteVideoRef.current.playsInline
          } : null
        }
      };
      setDebugInfo(info);
    };

    const getDevices = async () => {
      const availableDevices = await webrtcService.constructor.getAvailableDevices();
      setDevices(availableDevices);
    };

    if (isVisible) {
      updateDebugInfo();
      getDevices();
      const interval = setInterval(updateDebugInfo, 1000);
      return () => clearInterval(interval);
    }
  }, [isVisible, localStream, remoteStream, localVideoRef, remoteVideoRef]);

  const testLocalVideo = async () => {
    try {
      console.log('🧪 Testing local video...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('✅ Test stream obtained:', stream);
      
      if (localVideoRef?.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
        console.log('✅ Test video playing');
        
        setTimeout(() => {
          stream.getTracks().forEach(track => track.stop());
          console.log('🛑 Test stream stopped');
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  };

  const forceVideoUpdate = () => {
    console.log('🔄 Forcing video update...');
    if (localVideoRef?.current && localStream) {
      localVideoRef.current.srcObject = null;
      setTimeout(() => {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(e => console.log('Play failed:', e));
      }, 100);
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 left-4 z-50 p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="Show Debug Panel"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-black bg-opacity-90 text-white p-4 rounded-lg max-w-md max-h-96 overflow-y-auto text-xs">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">WebRTC Debug Panel</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          <EyeOff className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {/* WebRTC Support */}
        <div>
          <strong>WebRTC Supported:</strong> {debugInfo.webrtcSupported ? '✅' : '❌'}
        </div>

        {/* Available Devices */}
        <div>
          <strong>Devices:</strong>
          <div className="ml-2">
            Video: {devices.videoInputs?.length || 0} |
            Audio: {devices.audioInputs?.length || 0}
          </div>
        </div>

        {/* WebRTC Service State */}
        {debugInfo.webrtcDebugInfo && (
          <div>
            <strong>WebRTC Service:</strong>
            <div className="ml-2">
              Local Stream: {debugInfo.webrtcDebugInfo.hasLocalStream ? '✅' : '❌'}<br/>
              Remote Stream: {debugInfo.webrtcDebugInfo.hasRemoteStream ? '✅' : '❌'}<br/>
              Peer Connection: {debugInfo.webrtcDebugInfo.hasPeerConnection ? '✅' : '❌'}<br/>
              Connection State: {debugInfo.webrtcDebugInfo.connectionState}<br/>
              ICE State: {debugInfo.webrtcDebugInfo.iceConnectionState}
            </div>
          </div>
        )}

        {/* Local Stream Info */}
        {debugInfo.localStreamInfo && (
          <div>
            <strong>Local Stream:</strong>
            <div className="ml-2">
              Active: {debugInfo.localStreamInfo.active ? '✅' : '❌'}<br/>
              Video Tracks: {debugInfo.localStreamInfo.videoTracks.length}<br/>
              Audio Tracks: {debugInfo.localStreamInfo.audioTracks.length}
              {debugInfo.localStreamInfo.videoTracks.map((track, i) => (
                <div key={i} className="ml-4 text-xs">
                  V{i}: {track.label} - {track.enabled ? 'ON' : 'OFF'} - {track.readyState}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Video Element Info */}
        {debugInfo.videoElementInfo?.local && (
          <div>
            <strong>Local Video Element:</strong>
            <div className="ml-2">
              Has srcObject: {debugInfo.videoElementInfo.local.hasSrcObject ? '✅' : '❌'}<br/>
              Ready State: {debugInfo.videoElementInfo.local.readyState}<br/>
              Dimensions: {debugInfo.videoElementInfo.local.videoWidth}x{debugInfo.videoElementInfo.local.videoHeight}<br/>
              Paused: {debugInfo.videoElementInfo.local.paused ? '❌' : '✅'}<br/>
              Autoplay: {debugInfo.videoElementInfo.local.autoplay ? '✅' : '❌'}
            </div>
          </div>
        )}

        {/* Test Buttons */}
        <div className="space-y-1 pt-2 border-t border-gray-600">
          <button
            onClick={testLocalVideo}
            className="w-full p-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
          >
            Test Local Video
          </button>
          <button
            onClick={forceVideoUpdate}
            className="w-full p-1 bg-green-600 hover:bg-green-700 rounded text-xs"
          >
            Force Video Update
          </button>
          <button
            onClick={() => {
              console.log('Full Debug Info:', debugInfo);
              console.log('WebRTC Service:', webrtcService);
              console.log('Local Video Ref:', localVideoRef?.current);
              console.log('Local Stream:', localStream);
            }}
            className="w-full p-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
          >
            Log to Console
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;