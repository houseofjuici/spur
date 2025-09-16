import React, { useState, useEffect, useRef } from 'react';

interface VoiceCaptureProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTranscriptionComplete: (transcript: string) => void;
  isProcessing: boolean;
}

export const VoiceCapture: React.FC<VoiceCaptureProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  onTranscriptionComplete,
  isProcessing
}) => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const animationRef = useRef<number>();
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript + interimTranscript);
        
        // Simulate audio level for visualization
        const level = Math.random() * 100;
        setAudioLevel(level);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
        if (isRecording) {
          onStopRecording();
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (isRecording) {
          // Auto-restart if still recording
          setTimeout(() => {
            if (isRecording && recognitionRef.current) {
              recognitionRef.current.start();
            }
          }, 100);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, onStopRecording]);

  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      if (recognitionRef.current && !isListening) {
        recognitionRef.current.start();
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isListening]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      onStopRecording();
      if (transcript.trim()) {
        onTranscriptionComplete(transcript);
        setTranscript('');
      }
    } else {
      onStartRecording();
    }
  };

  const handleSaveAndClear = () => {
    if (transcript.trim()) {
      onTranscriptionComplete(transcript);
      setTranscript('');
      setRecordingTime(0);
    }
  };

  const handleClear = () => {
    setTranscript('');
    setRecordingTime(0);
    setError(null);
  };

  return (
    <div className="voice-capture">
      <div className="visualizer-container">
        <div className={`audio-visualizer ${isRecording ? 'active' : ''}`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="audio-bar"
              style={{
                height: `${isRecording ? Math.random() * 40 + 10 : 5}px`,
                backgroundColor: isRecording ? '#4285f4' : '#e0e0e0'
              }}
            />
          ))}
        </div>
        
        <div className="recording-indicator">
          <div className={`recording-dot ${isRecording ? 'recording' : ''}`}></div>
          {isRecording && <span className="recording-time">{formatTime(recordingTime)}</span>}
        </div>
      </div>

      <div className="transcript-area">
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={isRecording ? "Listening... Speak now" : "Your transcript will appear here"}
          className="transcript-input"
          rows={4}
          disabled={isRecording}
        />
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="capture-controls">
        <button
          onClick={handleToggleRecording}
          className={`capture-button ${isRecording ? 'stop' : 'start'} ${isProcessing ? 'disabled' : ''}`}
          disabled={isProcessing}
          title={isRecording ? "Stop recording" : "Start voice recording"}
        >
          {isRecording ? '⏹️ Stop' : '🎤 Record'}
        </button>

        {transcript.trim() && !isRecording && (
          <>
            <button
              onClick={handleSaveAndClear}
              className="save-button"
              disabled={isProcessing}
              title="Save as memory"
            >
              💾 Save
            </button>
            <button
              onClick={handleClear}
              className="clear-button"
              disabled={isProcessing}
              title="Clear transcript"
            >
              🗑️ Clear
            </button>
          </>
        )}
      </div>

      <div className="capture-tips">
        <p className="tip-text">
          💡 Tip: Press Ctrl+Shift+S to quickly toggle recording
        </p>
      </div>

      <style jsx>{`
        .voice-capture {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .visualizer-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 12px;
          min-height: 80px;
        }

        .audio-visualizer {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 40px;
        }

        .audio-bar {
          width: 4px;
          background: #e0e0e0;
          border-radius: 2px;
          transition: height 0.1s ease;
        }

        .audio-visualizer.active .audio-bar {
          animation: pulse 0.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.2); }
        }

        .recording-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .recording-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #f44336;
          opacity: 0.3;
        }

        .recording-dot.recording {
          animation: blink 1s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .recording-time {
          font-family: monospace;
          font-size: 14px;
          color: #666;
        }

        .transcript-area {
          margin-bottom: 12px;
        }

        .transcript-input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.5;
          resize: vertical;
          background: white;
        }

        .transcript-input:focus {
          outline: none;
          border-color: #4285f4;
          box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
        }

        .transcript-input:disabled {
          background: #f5f5f5;
          color: #666;
        }

        .error-message {
          padding: 8px 12px;
          background: #ffebee;
          color: #c62828;
          border-radius: 6px;
          font-size: 13px;
        }

        .capture-controls {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .capture-button {
          flex: 1;
          min-width: 120px;
          padding: 12px 16px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .capture-button.start {
          background: #4caf50;
          color: white;
        }

        .capture-button.start:hover:not(:disabled) {
          background: #45a049;
        }

        .capture-button.stop {
          background: #f44336;
          color: white;
        }

        .capture-button.stop:hover:not(:disabled) {
          background: #da190b;
        }

        .capture-button.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .save-button, .clear-button {
          padding: 12px 16px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .save-button {
          background: #2196f3;
          color: white;
        }

        .save-button:hover:not(:disabled) {
          background: #1976d2;
        }

        .clear-button {
          background: #757575;
          color: white;
        }

        .clear-button:hover:not(:disabled) {
          background: #616161;
        }

        .capture-tips {
          text-align: center;
        }

        .tip-text {
          font-size: 12px;
          color: #666;
          margin: 0;
        }
      `}</style>
    </div>
  );
};