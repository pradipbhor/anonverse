import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Image, Paperclip } from 'lucide-react';

const MessageInput = ({ onSendMessage, disabled, placeholder = "Type a message..." }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      setIsTyping(false);
      
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Handle typing indicator
    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Focus on input when component mounts or becomes enabled
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const maxLength = 1000;
  const remainingChars = maxLength - message.length;
  const isNearLimit = remainingChars <= 50;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex items-end space-x-3">
          {/* Message input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={disabled ? "Connecting..." : placeholder}
              disabled={disabled}
              maxLength={maxLength}
              rows={1}
              className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{
                minHeight: '48px',
                maxHeight: '120px',
                overflowY: message.length > 100 ? 'auto' : 'hidden'
              }}
            />
            
            {/* Character count */}
            {isNearLimit && (
              <div className={`absolute bottom-1 right-12 text-xs ${
                remainingChars <= 10 ? 'text-red-500' : 'text-yellow-500'
              }`}>
                {remainingChars}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            {/* Emoji button (placeholder) */}
            <button
              type="button"
              disabled={disabled}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add emoji (coming soon)"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Send button */}
            <button
              type="submit"
              disabled={disabled || !message.trim()}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            {isTyping && !disabled && (
              <span className="text-blue-600 dark:text-blue-400">
                Typing...
              </span>
            )}
            
            {disabled && (
              <span className="text-yellow-600 dark:text-yellow-400">
                Connecting to stranger...
              </span>
            )}
          </div>
          
          <div className="text-right">
            <span className={remainingChars <= 10 ? 'text-red-500' : ''}>
              {message.length}/{maxLength}
            </span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Press Enter to send, Shift+Enter for new line</span>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* File attachment placeholder */}
            <button
              type="button"
              disabled={true}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="File attachments (coming soon)"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            
            {/* Image attachment placeholder */}
            <button
              type="button"
              disabled={true}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Image attachments (coming soon)"
            >
              <Image className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default MessageInput;