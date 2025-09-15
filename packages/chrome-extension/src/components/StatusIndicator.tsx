import React, { useState, useEffect } from 'react';

interface StatusIndicatorProps {
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ className }) => {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'syncing'>('connected');
  const [syncProgress, setSyncProgress] = useState(100);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  useEffect(() => {
    // Simulate status updates
    const interval = setInterval(() => {
      const statuses: Array<'connected' | 'disconnected' | 'syncing'> = ['connected', 'disconnected', 'syncing'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      setConnectionStatus(randomStatus);
      
      if (randomStatus === 'syncing') {
        setSyncProgress(Math.floor(Math.random() * 100));
      } else {
        setSyncProgress(100);
      }
      
      // Update last sync time
      setLastSyncTime(new Date().toLocaleTimeString());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (): string => {
    switch (connectionStatus) {
      case 'connected': return '🟢';
      case 'disconnected': return '🔴';
      case 'syncing': return '🔄';
      default: return '⚪';
    }
  };

  const getStatusText = (): string => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Offline';
      case 'syncing': return 'Syncing...';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (): string => {
    switch (connectionStatus) {
      case 'connected': return '#4caf50';
      case 'disconnected': return '#f44336';
      case 'syncing': return '#ff9800';
      default: return '#9e9e9e';
    }
  };

  const formatLastSync = (time: string): string => {
    if (!time) return 'Never';
    
    const now = new Date();
    const syncTime = new Date(time);
    const diffInMinutes = Math.floor((now.getTime() - syncTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    return syncTime.toLocaleDateString();
  };

  return (
    <div className={`status-indicator ${className || ''}`}>
      <div className="status-main">
        <div 
          className="status-icon"
          style={{ color: getStatusColor() }}
        >
          {getStatusIcon()}
        </div>
        <div className="status-text">
          <span className="status-label">{getStatusText()}</span>
          {lastSyncTime && (
            <span className="sync-time">
              Last sync: {formatLastSync(lastSyncTime)}
            </span>
          )}
        </div>
      </div>
      
      {connectionStatus === 'syncing' && (
        <div className="sync-progress">
          <div 
            className="progress-bar"
            style={{ width: `${syncProgress}%` }}
          ></div>
        </div>
      )}

      <style jsx>{`
        .status-indicator {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 150px;
        }

        .status-main {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-icon {
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .status-text {
          display: flex;
          flex-direction: column;
          font-size: 11px;
        }

        .status-label {
          font-weight: 600;
          color: #333;
        }

        .sync-time {
          color: #666;
          font-size: 10px;
        }

        .sync-progress {
          height: 2px;
          background: #e0e0e0;
          border-radius: 1px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: #ff9800;
          transition: width 0.3s ease;
        }

        /* Dark mode support */
        .status-label {
          color: inherit;
        }
        
        .sync-time {
          color: inherit;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};