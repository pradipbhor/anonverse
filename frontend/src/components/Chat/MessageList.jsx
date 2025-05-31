import React, { useEffect, useRef } from 'react';
import { Clock, User } from 'lucide-react';

const MessageList = ({ messages, partnerTyping, userSession }) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, partnerTyping]);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMessage = (message, index) => {
    const isOwnMessage = message.type === 'sent' || message.senderId === userSession?.id;
    const isSystemMessage = message.type === 'system';

    if (isSystemMessage) {
      return (
        <div key={index} className="flex justify-center my-4">
          <div className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-full text-sm">
            {message.content}
          </div>
        </div>
      );
    }

    return (
      <div
        key={index}
        className={`flex mb-4 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? 'order-2' : 'order-1'}`}>
          {/* Message bubble */}
          <div
            className={`px-4 py-2 rounded-lg ${
              isOwnMessage
                ? 'bg-blue-600 text-white rounded-br-none'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'
            }`}
          >
            <p className="text-sm leading-relaxed break-words">
              {message.content}
            </p>
          </div>
          
          {/* Timestamp */}
          <div className={`flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400 ${
            isOwnMessage ? 'justify-end' : 'justify-start'
          }`}>
            <Clock className="w-3 h-3 mr-1" />
            {formatTime(message.timestamp)}
          </div>
        </div>

        {/* Avatar */}
        <div className={`flex-shrink-0 ${isOwnMessage ? 'order-1 mr-2' : 'order-2 ml-2'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            isOwnMessage 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
          }`}>
            {isOwnMessage ? 'Y' : 'S'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-1"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <User className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Start a conversation
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm">
              Say hello to your new chat partner! Remember to be respectful and follow our community guidelines.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => renderMessage(message, index))}
            
            {/* Typing indicator */}
            {partnerTyping && (
              <div className="flex justify-start mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300">
                    S
                  </div>
                  <div className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg rounded-bl-none">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;