import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Mic, MicOff, Send, Bot, User, Brain, Clock, Settings } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  confidence?: number;
  actions?: AssistantAction[];
  suggestions?: string[];
}

interface AssistantAction {
  id: string;
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiresConfirmation: boolean;
}

interface AssistantInterfaceProps {
  onSendMessage: (message: string, type: 'text' | 'voice') => Promise<void>;
  onVoiceToggle: () => void;
  isListening: boolean;
  isSpeaking: boolean;
  messages: Message[];
  suggestions: string[];
}

export const AssistantInterface: React.FC<AssistantInterfaceProps> = ({
  onSendMessage,
  onVoiceToggle,
  isListening,
  isSpeaking,
  messages,
  suggestions
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;

    const message = inputMessage.trim();
    setInputMessage('');
    setIsProcessing(true);

    try {
      await onSendMessage(message, 'text');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="w-5 h-5 text-blue-500" />;
      case 'assistant':
        return <Bot className="w-5 h-5 text-purple-500" />;
      case 'system':
        return <Settings className="w-5 h-5 text-gray-500" />;
      default:
        return <MessageCircle className="w-5 h-5" />;
    }
  };

  const getMessageClass = (type: string) => {
    switch (type) {
      case 'user':
        return 'bg-blue-50 border-blue-200';
      case 'assistant':
        return 'bg-purple-50 border-purple-200';
      case 'system':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-400';
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Brain className="w-8 h-8 text-purple-600" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Spur Assistant</h1>
            <p className="text-sm text-gray-500">Always-on productivity companion</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Active</span>
          </div>
          <button
            onClick={onVoiceToggle}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isListening 
                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isListening ? 'Stop listening' : 'Start voice input'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageCircle className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Welcome to Spur</p>
            <p className="text-sm text-center max-w-md">
              I'm your always-on assistant. Type a message or use voice input to get started.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 p-4 rounded-lg border ${getMessageClass(message.type)}`}
            >
              <div className="flex-shrink-0 mt-1">
                {getMessageIcon(message.type)}
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {message.type}
                  </span>
                  <div className="flex items-center space-x-2">
                    {message.confidence && (
                      <span className={`text-xs ${getConfidenceColor(message.confidence)}`}>
                        {Math.round(message.confidence * 100)}% confidence
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                </div>
                
                <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
                
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Suggested Actions:</p>
                    <div className="flex flex-wrap gap-2">
                      {message.actions.map((action) => (
                        <button
                          key={action.id}
                          className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                            action.priority === 'critical' 
                              ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                              : action.priority === 'high'
                              ? 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200'
                              : action.priority === 'medium'
                              ? 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200'
                              : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {action.description}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">You might also want to:</p>
                    <div className="space-y-1">
                      {message.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          className="block w-full text-left text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
                          onClick={() => setInputMessage(suggestion)}
                        >
                          • {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Active Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-purple-800 mb-2">💡 Proactive Suggestions</h3>
            <div className="space-y-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="block w-full text-left text-sm text-purple-700 hover:text-purple-900 hover:bg-purple-100/50 px-2 py-1 rounded transition-colors"
                  onClick={() => setInputMessage(suggestion)}
                >
                  • {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Voice Listening Indicator */}
      {isListening && (
        <div className="flex items-center justify-center p-4 bg-red-50 border-t border-red-200">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-red-700">Listening...</span>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="p-4">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isListening ? "Listening... (or type here)" : "Type your message..."}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={1}
                disabled={isProcessing}
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isProcessing}
                className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
              
              <button
                onClick={onVoiceToggle}
                disabled={isProcessing}
                className={`p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  isListening 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="mt-2 text-xs text-gray-500 text-center">
            Press Enter to send • Shift+Enter for new line • Click microphone for voice input
          </div>
        </div>
      </div>
    </div>
  );
};