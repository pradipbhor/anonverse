import React from 'react';
import { MessageCircle, Video } from 'lucide-react';

const ChatModeSelector = ({ selectedMode, onModeChange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Text Chat */}
      <button
        onClick={() => onModeChange('text')}
        className={`p-6 border-2 rounded-lg transition-all ${
          selectedMode === 'text'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
        }`}
      >
        <MessageCircle className="w-12 h-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Text Chat</h3>
        <p className="text-sm opacity-75">
          Connect through messages. Perfect for casual conversations and getting to know someone.
        </p>
      </button>

      {/* Video Chat */}
      <button
        onClick={() => onModeChange('video')}
        className={`p-6 border-2 rounded-lg transition-all ${
          selectedMode === 'video'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
        }`}
      >
        <Video className="w-12 h-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Video Chat</h3>
        <p className="text-sm opacity-75">
          Face-to-face conversations with strangers. More personal and engaging experience.
        </p>
      </button>
    </div>
  );
};

export default ChatModeSelector;