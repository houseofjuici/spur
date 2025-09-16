import { useState, useEffect, useCallback, createContext, useContext } from 'react';

interface MemoryNode {
  id: string;
  type: string;
  title: string;
  content: string;
  timestamp: string;
  tags?: string[];
  importance?: 'low' | 'medium' | 'high' | 'critical';
  confidence?: number;
  connections?: string[];
  metadata?: Record<string, any>;
}

interface SpurContextType {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  memories: MemoryNode[];
  
  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  processTranscript: (transcript: string) => Promise<void>;
  addMemory: (memory: Omit<MemoryNode, 'id' | 'timestamp'>) => Promise<void>;
  updateMemory: (id: string, updates: Partial<MemoryNode>) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  clearError: () => void;
}

const SpurContext = createContext<SpurContextType | undefined>(undefined);

export const useSpurContext = () => {
  const context = useContext(SpurContext);
  if (context === undefined) {
    throw new Error('useSpurContext must be used within a SpurProvider');
  }
  return context;
};

interface SpurProviderProps {
  children: React.ReactNode;
}

export const SpurProvider: React.FC<SpurProviderProps> = ({ children }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryNode[]>([]);

  // Load memories from storage on mount
  useEffect(() => {
    loadMemories();
    
    // Listen for storage changes
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.memories) {
        setMemories(changes.memories.newValue || []);
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Load memories from Chrome storage
  const loadMemories = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(['memories']);
      setMemories(result.memories || []);
    } catch (err) {
      setError('Failed to load memories');
      console.error('Error loading memories:', err);
    }
  }, []);

  // Save memories to Chrome storage
  const saveMemories = useCallback(async (newMemories: MemoryNode[]) => {
    try {
      await chrome.storage.local.set({ memories: newMemories });
      
      // Notify background script of data change
      chrome.runtime.sendMessage({
        type: 'MEMORIES_UPDATED',
        memories: newMemories
      });
    } catch (err) {
      setError('Failed to save memories');
      console.error('Error saving memories:', err);
    }
  }, []);

  // Start voice recording
  const startRecording = useCallback(async () => {
    try {
      if (isRecording) return;
      
      setIsRecording(true);
      setError(null);
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: 'RECORDING_STARTED'
      });
    } catch (err) {
      setError('Failed to start recording');
      setIsRecording(false);
      console.error('Error starting recording:', err);
    }
  }, [isRecording]);

  // Stop voice recording
  const stopRecording = useCallback(async () => {
    try {
      if (!isRecording) return;
      
      setIsRecording(false);
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: 'RECORDING_STOPPED'
      });
    } catch (err) {
      setError('Failed to stop recording');
      console.error('Error stopping recording:', err);
    }
  }, [isRecording]);

  // Process transcript and create memory
  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Send transcript to background script for processing
      const response = await chrome.runtime.sendMessage({
        type: 'PROCESS_TRANSCRIPT',
        transcript
      });
      
      if (response?.success) {
        // Create memory from processed transcript
        const memory: MemoryNode = {
          id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'capture',
          title: response.title || transcript.substring(0, 50) + (transcript.length > 50 ? '...' : ''),
          content: transcript,
          timestamp: new Date().toISOString(),
          tags: response.tags || [],
          importance: response.importance || 'medium',
          confidence: response.confidence || 0.8,
          connections: [],
          metadata: {
            processingTime: response.processingTime,
            source: 'voice',
            language: response.language || 'en'
          }
        };
        
        await addMemory(memory);
        
        // Show notification if enabled
        const settings = await chrome.storage.local.get(['settings']);
        if (settings.settings?.enableNotifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-48.png',
            title: 'Spur',
            message: 'Memory saved successfully!'
          });
        }
      } else {
        throw new Error(response?.error || 'Failed to process transcript');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process transcript');
      console.error('Error processing transcript:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Add a new memory
  const addMemory = useCallback(async (memoryData: Omit<MemoryNode, 'id' | 'timestamp'>) => {
    try {
      const newMemory: MemoryNode = {
        ...memoryData,
        id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString()
      };
      
      const newMemories = [...memories, newMemory];
      setMemories(newMemories);
      await saveMemories(newMemories);
    } catch (err) {
      setError('Failed to add memory');
      console.error('Error adding memory:', err);
    }
  }, [memories, saveMemories]);

  // Update an existing memory
  const updateMemory = useCallback(async (id: string, updates: Partial<MemoryNode>) => {
    try {
      const updatedMemories = memories.map(memory =>
        memory.id === id ? { ...memory, ...updates } : memory
      );
      setMemories(updatedMemories);
      await saveMemories(updatedMemories);
    } catch (err) {
      setError('Failed to update memory');
      console.error('Error updating memory:', err);
    }
  }, [memories, saveMemories]);

  // Delete a memory
  const deleteMemory = useCallback(async (id: string) => {
    try {
      const filteredMemories = memories.filter(memory => memory.id !== id);
      setMemories(filteredMemories);
      await saveMemories(filteredMemories);
    } catch (err) {
      setError('Failed to delete memory');
      console.error('Error deleting memory:', err);
    }
  }, [memories, saveMemories]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: SpurContextType = {
    isRecording,
    isProcessing,
    error,
    memories,
    startRecording,
    stopRecording,
    processTranscript,
    addMemory,
    updateMemory,
    deleteMemory,
    clearError
  };

  return (
    <SpurContext.Provider value={value}>
      {children}
    </SpurContext.Provider>
  );
};