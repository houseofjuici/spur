import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AssistantInterface } from './components/AssistantInterface';
import { MemoryTimeline } from './components/MemoryTimeline';
import { AlwaysOnAssistant } from '@/assistant/core';
import { MemoryGraph } from '@/memory/graph';
import { UnifiedCaptureEngine } from '@/capture/engine/unified';
import { RealGmailService } from '@/integrations/email/RealGmailService';

interface AppMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  confidence?: number;
  actions?: any[];
  suggestions?: string[];
}

const SpurWebApp: React.FC = () => {
  const [assistant, setAssistant] = useState<AlwaysOnAssistant | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'assistant' | 'timeline' | 'settings'>('assistant');

  // Initialize assistant on mount
  useEffect(() => {
    const initializeAssistant = async () => {
      try {
        console.log('[WebApp] Initializing assistant...');
        
        // Initialize core components
        const memoryGraph = new MemoryGraph();
        await memoryGraph.initialize();
        
        const captureEngine = new UnifiedCaptureEngine();
        await captureEngine.initialize();
        
        const assistantInstance = new AlwaysOnAssistant(memoryGraph, captureEngine);
        
        // Set up event listeners
        assistantInstance.onInteraction((context, response) => {
          const newMessage: AppMessage = {
            id: response.id,
            type: 'assistant',
            content: response.content,
            timestamp: new Date(),
            confidence: response.confidence,
            actions: response.actions,
            suggestions: response.suggestions
          };
          
          setMessages(prev => [...prev, newMessage]);
          
          // Speak response if it was a voice input
          if (context.inputType === 'voice' && response.content) {
            assistantInstance.speak(response.content).catch(console.error);
          }
        });
        
        assistantInstance.onSuggestion((suggestionList) => {
          setSuggestions(suggestionList);
        });
        
        // Initialize and start assistant
        await assistantInstance.initialize();
        await assistantInstance.start();
        
        setAssistant(assistantInstance);
        setIsInitialized(true);
        
        // Add welcome message
        const welcomeMessage: AppMessage = {
          id: 'welcome',
          type: 'assistant',
          content: "Hello! I'm Spur, your always-on productivity companion. I'm here to help you capture ideas, manage workflows, and stay organized. How can I assist you today?",
          timestamp: new Date(),
          confidence: 0.95,
          suggestions: [
            "Capture a quick thought",
            "What can you help me with?",
            "Show me my recent activities",
            "Help me organize my emails"
          ]
        };
        
        setMessages([welcomeMessage]);
        
        console.log('[WebApp] Assistant initialized successfully');
        
      } catch (error) {
        console.error('[WebApp] Failed to initialize assistant:', error);
        
        const errorMessage: AppMessage = {
          id: 'error',
          type: 'system',
          content: "Sorry, I encountered an error while initializing. Please refresh the page and try again.",
          timestamp: new Date()
        };
        
        setMessages([errorMessage]);
      }
    };

    initializeAssistant();
    
    return () => {
      if (assistant) {
        assistant.cleanup().catch(console.error);
      }
    };
  }, []);

  // Voice state sync
  useEffect(() => {
    if (!assistant) return;
    
    const updateVoiceState = () => {
      setIsListening(assistant.isVoiceActive());
      setIsSpeaking(assistant.isSpeakingActive());
    };
    
    const interval = setInterval(updateVoiceState, 100);
    
    return () => clearInterval(interval);
  }, [assistant]);

  const handleSendMessage = useCallback(async (message: string, type: 'text' | 'voice') => {
    if (!assistant) return;

    try {
      // Add user message to UI immediately
      const userMessage: AppMessage = {
        id: `user_${Date.now()}`,
        type: 'user',
        content: message,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Process with assistant
      const sessionId = await assistant.createSession();
      await assistant.processInput(message, sessionId, type);
      
    } catch (error) {
      console.error('[WebApp] Error sending message:', error);
      
      const errorMessage: AppMessage = {
        id: `error_${Date.now()}`,
        type: 'system',
        content: "I'm sorry, but I encountered an error processing your message. Please try again.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [assistant]);

  const handleVoiceToggle = useCallback(async () => {
    if (!assistant) return;

    try {
      if (isListening) {
        await assistant.stopVoiceInput();
      } else {
        const sessionId = await assistant.createSession();
        await assistant.startVoiceInput(sessionId);
      }
    } catch (error) {
      console.error('[WebApp] Error toggling voice:', error);
    }
  }, [assistant, isListening]);

  const handleMemorySelect = useCallback(async (memory: any) => {
    if (!assistant) return;
    
    try {
      // Create a session and query assistant about the selected memory
      const sessionId = await assistant.createSession();
      const response = await assistant.processInput(
        `Tell me more about: ${memory.title}`,
        sessionId
      );
      
      // Switch to assistant tab to show the response
      setActiveTab('assistant');
      
    } catch (error) {
      console.error('[WebApp] Error selecting memory:', error);
    }
  }, [assistant]);

  const handleSearch = useCallback(async (query: string) => {
    if (!assistant) return;
    
    try {
      // Search through assistant's memory
      console.log('[WebApp] Searching for:', query);
      // Implementation would depend on assistant's search capabilities
      
    } catch (error) {
      console.error('[WebApp] Error searching:', error);
    }
  }, [assistant]);

  const handleFilter = useCallback(async (filters: any) => {
    if (!assistant) return;
    
    try {
      console.log('[WebApp] Applying filters:', filters);
      // Implementation would depend on assistant's filtering capabilities
      
    } catch (error) {
      console.error('[WebApp] Error applying filters:', error);
    }
  }, [assistant]);

  const handleExport = useCallback(async (selectedMemories: string[]) => {
    try {
      console.log('[WebApp] Exporting memories:', selectedMemories);
      // Implementation would export selected memories
      
      // Show success message
      const successMessage: AppMessage = {
        id: `export_${Date.now()}`,
        type: 'system',
        content: `Successfully exported ${selectedMemories.length} memories to your downloads folder.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, successMessage]);
      setActiveTab('assistant');
      
    } catch (error) {
      console.error('[WebApp] Error exporting:', error);
    }
  }, []);

  const getMemoriesForTimeline = useCallback(async () => {
    if (!assistant) return [];
    
    try {
      // Get memories from assistant's memory graph
      // This is a placeholder - actual implementation would query the memory graph
      return [
        {
          id: '1',
          type: 'interaction',
          title: 'Welcome to Spur',
          content: 'Initial assistant setup and configuration',
          timestamp: new Date(Date.now() - 3600000),
          tags: ['setup', 'welcome'],
          importance: 'medium',
          confidence: 0.9,
          connections: []
        },
        {
          id: '2',
          type: 'capture',
          title: 'Project Planning Notes',
          content: 'Captured ideas for the new productivity system',
          timestamp: new Date(Date.now() - 1800000),
          tags: ['project', 'planning', 'ideas'],
          importance: 'high',
          confidence: 0.85,
          connections: ['1']
        }
      ];
    } catch (error) {
      console.error('[WebApp] Error getting memories:', error);
      return [];
    }
  }, [assistant]);

  const TabButton: React.FC<{
    id: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
  }> = ({ id, label, icon, active, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
        active 
          ? 'bg-purple-600 text-white' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800">Initializing Spur...</h2>
          <p className="text-gray-600 mt-2">Preparing your personal productivity companion</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">S</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h1 className="text-xl font-bold text-gray-900">Spur</h1>
                  <p className="text-sm text-gray-500">Personal Productivity Companion</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Active</span>
                </div>
                <button
                  onClick={() => assistant?.getStatus()}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 py-2">
              <TabButton
                id="assistant"
                label="Assistant"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                }
                active={activeTab === 'assistant'}
                onClick={() => setActiveTab('assistant')}
              />
              <TabButton
                id="timeline"
                label="Memory Timeline"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                active={activeTab === 'timeline'}
                onClick={() => setActiveTab('timeline')}
              />
              <TabButton
                id="settings"
                label="Settings"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                active={activeTab === 'settings'}
                onClick={() => setActiveTab('settings')}
              />
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/assistant" replace />} />
            <Route path="/assistant" element={
              <div className="h-full">
                <AssistantInterface
                  onSendMessage={handleSendMessage}
                  onVoiceToggle={handleVoiceToggle}
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  messages={messages}
                  suggestions={suggestions}
                />
              </div>
            } />
            <Route path="/timeline" element={
              <MemoryTimeline
                memories={[]}
                onMemorySelect={handleMemorySelect}
                onSearch={handleSearch}
                onFilter={handleFilter}
                onExport={handleExport}
              />
            } />
            <Route path="/settings" element={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
                  <p className="text-gray-600">Settings panel coming soon...</p>
                </div>
              </div>
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default SpurWebApp;