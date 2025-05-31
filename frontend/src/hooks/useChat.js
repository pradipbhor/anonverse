import { useState, useEffect, useCallback } from 'react';

export const useChat = (socket, userId) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const sendMessage = useCallback((content, partnerId) => {
    if (socket && content.trim()) {
      socket.emit('send-message', {
        content: content.trim(),
        to: partnerId,
        timestamp: new Date()
      });
      
      // Start typing indicator
      socket.emit('typing');
      setTimeout(() => socket.emit('stop-typing'), 1000);
    }
  }, [socket]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (message) => {
      setMessages(prev => [...prev, { ...message, type: 'received' }]);
    };

    const handleMessageSent = (message) => {
      setMessages(prev => [...prev, { ...message, type: 'sent' }]);
    };

    const handlePartnerTyping = (typing) => {
      setPartnerTyping(typing);
    };

    socket.on('message-received', handleMessageReceived);
    socket.on('message-sent', handleMessageSent);
    socket.on('partner-typing', handlePartnerTyping);

    return () => {
      socket.off('message-received', handleMessageReceived);
      socket.off('message-sent', handleMessageSent);
      socket.off('partner-typing', handlePartnerTyping);
    };
  }, [socket]);

  return {
    messages,
    isTyping,
    partnerTyping,
    sendMessage,
    clearMessages
  };
};