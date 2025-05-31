export const generateSessionId = () => {
    return Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
  };
  
  export const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  export const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  export const sanitizeMessage = (message) => {
    return message.trim().replace(/\s+/g, ' ').substring(0, 1000);
  };
  
  export const validateInterest = (interest) => {
    return typeof interest === 'string' && 
           interest.length >= 1 && 
           interest.length <= 50 &&
           /^[a-zA-Z0-9\s-_]+$/.test(interest);
  };
  
  export const findCommonInterests = (interests1, interests2) => {
    if (!interests1 || !interests2) return [];
    
    const set1 = new Set(interests1.map(i => i.toLowerCase().trim()));
    const set2 = new Set(interests2.map(i => i.toLowerCase().trim()));
    
    return [...set1].filter(interest => set2.has(interest));
  };
  
  export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };
  
  export const throttle = (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };
  
  export const getErrorMessage = (error) => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  };
  
  export const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (fallbackErr) {
        document.body.removeChild(textArea);
        return false;
      }
    }
  };
  
  export const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };
  
  export const getRandomElement = (array) => {
    return array[Math.floor(Math.random() * array.length)];
  };
  
  export const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };