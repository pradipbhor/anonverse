import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';

const POPULAR_INTERESTS = [
  'Music', 'Movies', 'Gaming', 'Technology', 'Sports', 'Art', 'Books',
  'Travel', 'Food', 'Photography', 'Science', 'Nature', 'Fitness',
  'Anime', 'Programming', 'Fashion', 'Cooking', 'Dancing', 'Writing',
  'Memes', 'Politics', 'History', 'Philosophy', 'Languages', 'Pets'
];

const InterestSelector = ({ selectedInterests, onInterestsChange }) => {
  const [customInterest, setCustomInterest] = useState('');

  const toggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      onInterestsChange(selectedInterests.filter(i => i !== interest));
    } else if (selectedInterests.length < 10) {
      onInterestsChange([...selectedInterests, interest]);
    }
  };

  const addCustomInterest = () => {
    const interest = customInterest.trim();
    if (interest && !selectedInterests.includes(interest) && selectedInterests.length < 10) {
      onInterestsChange([...selectedInterests, interest]);
      setCustomInterest('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addCustomInterest();
    }
  };

  return (
    <div className="space-y-6">
      {/* Selected Interests */}
      {selectedInterests.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Selected ({selectedInterests.length}/10)
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedInterests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm rounded-full"
              >
                {interest}
                <button
                  onClick={() => toggleInterest(interest)}
                  className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Popular Interests */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Popular Interests
        </h4>
        <div className="flex flex-wrap gap-2">
          {POPULAR_INTERESTS.map((interest) => (
            <button
              key={interest}
              onClick={() => toggleInterest(interest)}
              disabled={selectedInterests.length >= 10 && !selectedInterests.includes(interest)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedInterests.includes(interest)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${
                selectedInterests.length >= 10 && !selectedInterests.includes(interest)
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer'
              }`}
            >
              {interest}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Interest Input */}
      {selectedInterests.length < 10 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Add Custom Interest
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your interest..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={30}
            />
            <button
              onClick={addCustomInterest}
              disabled={!customInterest.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Select up to 10 interests to find people who share similar hobbies and topics.
      </p>
    </div>
  );
};

export default InterestSelector;