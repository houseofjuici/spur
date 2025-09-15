import React, { useState, useEffect, useRef } from 'react';
import { VoiceCapture } from '../components/VoiceCapture';
import { MemoryList } from '../components/MemoryList';
import { StatusIndicator } from '../components/StatusIndicator';
import { SettingsPanel } from '../components/SettingsPanel';
import { useSpurContext } from '../context/SpurContext';
import { useChromeStorage } from '../hooks/useChromeStorage';

const Popup: React.FC = () => {
  const { isRecording, startRecording, stopRecording, processTranscript } = useSpurContext();
  const [activeTab, setActiveTab] = useState<'capture' | 'memories' | 'settings'>('capture');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentMemories, setRecentMemories] = useState<any[]>([]);
  const [settings, setSettings, settingsLoaded] = useChromeStorage({
    enableNotifications: true,
    autoSync: true,
    darkMode: false,
    maxHistorySize: 100
  });

  const popupRef = useRef<HTMLDivElement>(null);

  // Load recent memories on mount
  useEffect(() => {
    loadRecentMemories();
    
    // Set up message listeners
    const messageListener = (message: any) => {
      if (message.type === 'SYNC_COMPLETE') {
        loadRecentMemories();
      }
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  // Handle voice recording completion
  const handleRecordingComplete = async (transcript: string) => {
    if (!transcript.trim()) return;
    
    setIsProcessing(true);
    try {
      await processTranscript(transcript);
      await loadRecentMemories();
    } catch (error) {
      console.error('Error processing transcript:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Load recent memories from storage
  const loadRecentMemories = async () => {
    try {
      const result = await chrome.storage.local.get(['memories']);
      const memories = result.memories || [];
      setRecentMemories(memories.slice(0, 5)); // Show last 5 memories
    } catch (error) {
      console.error('Error loading memories:', error);
    }
  };

  // Handle settings changes
  const handleSettingsChange = async (newSettings: any) => {
    try {
      await setSettings(newSettings);
      // Notify background script of settings change
      chrome.runtime.sendMessage({
        type: 'SETTINGS_UPDATED',
        settings: newSettings
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  if (!settingsLoaded) {
    return (
      <div className="popup-container loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div ref={popupRef} className={`popup-container ${settings.darkMode ? 'dark' : ''}`}>
      <div className="popup-header">
        <div className="app-title">
          <img src="icons/icon-32.png" alt="Spur" className="app-icon" />
          <h1>Spur</h1>
        </div>
        <StatusIndicator />
      </div>

      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'capture' ? 'active' : ''}`}
          onClick={() => setActiveTab('capture')}
          title="Voice Capture"
        >
          🎤
        </button>
        <button
          className={`tab-button ${activeTab === 'memories' ? 'active' : ''}`}
          onClick={() => setActiveTab('memories')}
          title="Recent Memories"
        >
          📝
        </button>
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'capture' && (
          <div className="capture-tab">
            <VoiceCapture
              isRecording={isRecording}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onTranscriptionComplete={handleRecordingComplete}
              isProcessing={isProcessing}
            />
            
            {recentMemories.length > 0 && (
              <div className="recent-memories">
                <h3>Recent Memories</h3>
                <div className="memories-list compact">
                  {recentMemories.slice(0, 3).map((memory) => (
                    <div key={memory.id} className="memory-item compact">
                      <div className="memory-content">{memory.content}</div>
                      <div className="memory-meta">
                        <span className="memory-type">{memory.type}</span>
                        <span className="memory-time">
                          {new Date(memory.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'memories' && (
          <div className="memories-tab">
            <MemoryList memories={recentMemories} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <SettingsPanel
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          </div>
        )}
      </div>

      <div className="popup-footer">
        <button
          className="footer-button"
          onClick={() => chrome.runtime.openOptionsPage()}
          title="Open full options"
        >
          Advanced Settings
        </button>
      </div>
    </div>
  );
};

export default Popup;