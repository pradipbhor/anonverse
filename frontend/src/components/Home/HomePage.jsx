import React, { useState } from 'react';
import InterestSelector from './InterestSelector';
import ChatModeSelector from './ChatModeSelector';
import { MessageCircle, Video, Globe, Shield, Users, Zap } from 'lucide-react';

const HomePage = ({ onStartChat, userSession }) => {
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [chatMode, setChatMode] = useState('text');
  const [showInterests, setShowInterests] = useState(false);

  const handleStartClick = () => {
    if (selectedInterests.length === 0) {
      setShowInterests(true);
    } else {
      onStartChat(selectedInterests, chatMode);
    }
  };

  const handleSkipInterests = () => {
    onStartChat([], chatMode);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-6">
          <Globe className="w-12 h-12 text-blue-600 dark:text-blue-400 mr-3" />
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
            Anon<span className="text-blue-600 dark:text-blue-400">verse</span>
          </h1>
        </div>
        
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
          Step into the anonymous universe where strangers become friends. 
          Connect with people worldwide through text or video chat, completely anonymously.
        </p>
        
        {/* Age Warning */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-center text-red-800 dark:text-red-300">
            <Shield className="w-5 h-5 mr-2" />
            <span className="font-semibold">YOU MUST BE 18 OR OLDER TO USE ANONVERSE</span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            See our Terms of Service for more info. Parental controls are available at connectsafely.org
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <Users className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Meet New People
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Connect with strangers from around the world who share your interests
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <Shield className="w-8 h-8 text-green-600 dark:text-green-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Stay Anonymous
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Chat safely without revealing your identity unless you choose to
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <Zap className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Instant Connection
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Get matched instantly with someone new. Skip anytime to find your perfect chat partner
          </p>
        </div>
      </div>

      {/* Chat Mode Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          Choose Your Experience
        </h2>
        
        <ChatModeSelector 
          selectedMode={chatMode}
          onModeChange={setChatMode}
        />
        
        {chatMode === 'video' && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center text-yellow-800 dark:text-yellow-300">
              <Video className="w-5 h-5 mr-2" />
              <span className="font-semibold">Video Chat Guidelines</span>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-2">
              Video chats are monitored. Keep it clean and appropriate. 
              Visit an adult site instead if that's what you're looking for.
            </p>
          </div>
        )}
      </div>

      {/* Interest Selection */}
      {showInterests && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            What are you interested in?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
            Select topics you'd like to discuss. We'll match you with someone who shares similar interests.
          </p>
          
          <InterestSelector 
            selectedInterests={selectedInterests}
            onInterestsChange={setSelectedInterests}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="text-center">
        {!showInterests ? (
          <div className="space-y-4">
            <button
              onClick={handleStartClick}
              className="inline-flex items-center px-8 py-4 bg-blue-600 dark:bg-blue-500 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-lg"
            >
              {chatMode === 'text' ? (
                <MessageCircle className="w-6 h-6 mr-2" />
              ) : (
                <Video className="w-6 h-6 mr-2" />
              )}
              Start {chatMode === 'text' ? 'Text' : 'Video'} Chat
            </button>
            
            <div className="text-sm text-gray-500 dark:text-gray-400">
              or{' '}
              <button
                onClick={() => setShowInterests(true)}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                add your interests first
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => onStartChat(selectedInterests, chatMode)}
              disabled={selectedInterests.length === 0}
              className="inline-flex items-center px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {chatMode === 'text' ? (
                <MessageCircle className="w-5 h-5 mr-2" />
              ) : (
                <Video className="w-5 h-5 mr-2" />
              )}
              Start Chat ({selectedInterests.length} interests)
            </button>
            
            <button
              onClick={handleSkipInterests}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Skip & Chat Randomly
            </button>
          </div>
        )}
      </div>

      {/* Safety Notice */}
      <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
        <p className="mb-2">
          Chats are anonymous unless you choose to share personal information (not recommended). 
          You can end a chat at any time by clicking "Next" or "Stop".
        </p>
        <p>
          Users are solely responsible for their behavior. 
          See our Terms of Service and Community Guidelines for more information.
        </p>
      </div>
    </div>
  );
};

export default HomePage;