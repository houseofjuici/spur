import React from 'react';

interface Memory {
  id: string;
  content: string;
  type: string;
  timestamp: string;
  tags?: string[];
  importance?: 'low' | 'medium' | 'high' | 'critical';
}

interface MemoryListProps {
  memories: Memory[];
}

export const MemoryList: React.FC<MemoryListProps> = ({ memories }) => {
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getImportanceColor = (importance?: string): string => {
    switch (importance) {
      case 'critical': return '#d32f2f';
      case 'high': return '#f57c00';
      case 'medium': return '#fbc02d';
      case 'low': return '#388e3c';
      default: return '#757575';
    }
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'capture': return '🎤';
      case 'interaction': return '💬';
      case 'document': return '📄';
      case 'note': return '📝';
      case 'task': return '✅';
      default: return '💭';
    }
  };

  if (memories.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📝</div>
        <h3>No memories yet</h3>
        <p>Start by capturing your first voice memo!</p>
      </div>
    );
  }

  return (
    <div className="memory-list">
      <div className="memory-list-header">
        <h3>Recent Memories</h3>
        <span className="memory-count">{memories.length} items</span>
      </div>
      
      <div className="memory-items">
        {memories.map((memory) => (
          <div key={memory.id} className="memory-item">
            <div className="memory-header">
              <div className="memory-type">
                <span className="type-icon">{getTypeIcon(memory.type)}</span>
                <span className="type-text">{memory.type}</span>
              </div>
              <div className="memory-meta">
                {memory.importance && (
                  <span 
                    className="importance-indicator"
                    style={{ backgroundColor: getImportanceColor(memory.importance) }}
                  ></span>
                )}
                <span className="memory-time">{formatTimestamp(memory.timestamp)}</span>
              </div>
            </div>
            
            <div className="memory-content">
              <p>{memory.content}</p>
            </div>
            
            {memory.tags && memory.tags.length > 0 && (
              <div className="memory-tags">
                {memory.tags.map((tag, index) => (
                  <span key={index} className="tag">#{tag}</span>
                ))}
              </div>
            )}
            
            <div className="memory-actions">
              <button 
                className="action-button edit"
                title="Edit memory"
                onClick={() => handleEditMemory(memory)}
              >
                ✏️
              </button>
              <button 
                className="action-button delete"
                title="Delete memory"
                onClick={() => handleDeleteMemory(memory.id)}
              >
                🗑️
              </button>
              <button 
                className="action-button share"
                title="Share memory"
                onClick={() => handleShareMemory(memory)}
              >
                📤
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .memory-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .memory-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 8px;
          border-bottom: 1px solid #e0e0e0;
        }

        .memory-list-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .memory-count {
          font-size: 12px;
          color: #666;
          background: #f0f0f0;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .memory-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .memory-item {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 12px;
          transition: all 0.2s ease;
        }

        .memory-item:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .memory-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .memory-type {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .type-icon {
          font-size: 14px;
        }

        .type-text {
          font-size: 12px;
          text-transform: uppercase;
          color: #666;
        }

        .memory-meta {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .importance-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .memory-time {
          font-size: 11px;
          color: #888;
        }

        .memory-content {
          margin-bottom: 8px;
        }

        .memory-content p {
          margin: 0;
          font-size: 14px;
          line-height: 1.4;
          color: #333;
        }

        .memory-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 8px;
        }

        .tag {
          font-size: 11px;
          color: #1976d2;
          background: #e3f2fd;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .memory-actions {
          display: flex;
          gap: 4px;
          justify-content: flex-end;
        }

        .action-button {
          background: transparent;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .action-button:hover {
          background: #f5f5f5;
        }

        .action-button.edit:hover {
          border-color: #2196f3;
          color: #2196f3;
        }

        .action-button.delete:hover {
          border-color: #f44336;
          color: #f44336;
        }

        .action-button.share:hover {
          border-color: #4caf50;
          color: #4caf50;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .empty-state p {
          margin: 0;
          font-size: 14px;
        }
      `}</style>
    </div>
  );

  // Action handlers (to be implemented with actual logic)
  const handleEditMemory = (memory: Memory) => {
    console.log('Edit memory:', memory);
    // TODO: Implement edit functionality
  };

  const handleDeleteMemory = (memoryId: string) => {
    console.log('Delete memory:', memoryId);
    // TODO: Implement delete functionality
  };

  const handleShareMemory = (memory: Memory) => {
    console.log('Share memory:', memory);
    // TODO: Implement share functionality
  };
};