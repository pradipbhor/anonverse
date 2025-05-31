export const CHAT_MODES = {
    TEXT: 'text',
    VIDEO: 'video'
  };
  
  export const CONNECTION_STATES = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error',
    WAITING: 'waiting'
  };
  
  export const MESSAGE_TYPES = {
    TEXT: 'text',
    SYSTEM: 'system',
    SENT: 'sent',
    RECEIVED: 'received'
  };
  
  export const REPORT_REASONS = [
    { value: 'inappropriate-content', label: 'Inappropriate content' },
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'spam', label: 'Spam or advertisements' },
    { value: 'underage', label: 'Underage user' },
    { value: 'other', label: 'Other inappropriate behavior' }
  ];
  
  export const POPULAR_INTERESTS = [
    'Music', 'Movies', 'Gaming', 'Technology', 'Sports', 'Art', 'Books',
    'Travel', 'Food', 'Photography', 'Science', 'Nature', 'Fitness',
    'Anime', 'Programming', 'Fashion', 'Cooking', 'Dancing', 'Writing',
    'Memes', 'Politics', 'History', 'Philosophy', 'Languages', 'Pets',
    'Cars', 'Business', 'Health', 'Education', 'Comedy'
  ];
  
  export const MAX_MESSAGE_LENGTH = 1000;
  export const MAX_INTERESTS = 10;
  export const TYPING_TIMEOUT = 3000;
  export const CONNECTION_TIMEOUT = 30000;
  
  export const THEME_MODES = {
    LIGHT: 'light',
    DARK: 'dark'
  };
  
  export const STORAGE_KEYS = {
    THEME: 'anonverse-theme',
    SESSION_ID: 'anonverse-session-id',
    USER_PREFERENCES: 'anonverse-preferences'
  };