const POPULAR_INTERESTS = [
  'Music', 'Movies', 'Gaming', 'Technology', 'Sports', 'Art', 'Books',
  'Travel', 'Food', 'Photography', 'Science', 'Nature', 'Fitness',
  'Anime', 'Programming', 'Fashion', 'Cooking', 'Dancing', 'Writing',
  'Memes', 'Politics', 'History', 'Philosophy', 'Languages', 'Pets'
];

const CHAT_MODES = { TEXT: 'text', VIDEO: 'video' };

const MATCH_STATES = {
  IDLE: 'idle',
  WAITING: 'WAITING',
  MATCHED: 'MATCHED',
  CHATTING: 'CHATTING',
  GRACE: 'GRACE',
  CLEANED_UP: 'CLEANED_UP'
};

const REPORT_REASONS = [
  'inappropriate-content', 'harassment', 'spam', 'underage', 'other'
];

module.exports = { POPULAR_INTERESTS, CHAT_MODES, MATCH_STATES, REPORT_REASONS };