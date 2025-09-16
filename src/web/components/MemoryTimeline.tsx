import React, { useState, useEffect } from 'react';
import { Timeline, Brain, Search, Filter, Calendar, Tag, Star, Trash2, Download, Share2 } from 'lucide-react';

interface MemoryNode {
  id: string;
  type: 'interaction' | 'capture' | 'email' | 'document' | 'event' | 'task';
  title: string;
  content: string;
  timestamp: Date;
  tags: string[];
  importance: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  connections: string[];
  metadata?: any;
}

interface MemoryTimelineProps {
  memories: MemoryNode[];
  onMemorySelect: (memory: MemoryNode) => void;
  onSearch: (query: string) => void;
  onFilter: (filters: MemoryFilters) => void;
  onExport: (selectedMemories: string[]) => void;
}

interface MemoryFilters {
  type?: string[];
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  importance?: string[];
  searchQuery?: string;
}

export const MemoryTimeline: React.FC<MemoryTimelineProps> = ({
  memories,
  onMemorySelect,
  onSearch,
  onFilter,
  onExport
}) => {
  const [selectedMemories, setSelectedMemories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<MemoryFilters>({});
  const [sortBy, setSortBy] = useState<'timestamp' | 'importance' | 'confidence'>('timestamp');

  const filteredMemories = React.useMemo(() => {
    return memories
      .filter(memory => {
        // Search filter
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          const matchesSearch = 
            memory.title.toLowerCase().includes(query) ||
            memory.content.toLowerCase().includes(query) ||
            memory.tags.some(tag => tag.toLowerCase().includes(query));
          if (!matchesSearch) return false;
        }

        // Type filter
        if (filters.type && filters.type.length > 0) {
          if (!filters.type.includes(memory.type)) return false;
        }

        // Tags filter
        if (filters.tags && filters.tags.length > 0) {
          if (!filters.tags.some(tag => memory.tags.includes(tag))) return false;
        }

        // Importance filter
        if (filters.importance && filters.importance.length > 0) {
          if (!filters.importance.includes(memory.importance)) return false;
        }

        // Date range filter
        if (filters.dateRange) {
          const memoryDate = new Date(memory.timestamp);
          if (memoryDate < filters.dateRange.start || memoryDate > filters.dateRange.end) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'importance':
            const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return importanceOrder[b.importance] - importanceOrder[a.importance];
          case 'confidence':
            return b.confidence - a.confidence;
          default:
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        }
      });
  }, [memories, filters, sortBy]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setFilters(prev => ({ ...prev, searchQuery: query }));
    onSearch(query);
  };

  const handleFilterChange = (newFilters: Partial<MemoryFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilter(updatedFilters);
  };

  const handleMemoryToggle = (memoryId: string) => {
    const newSelected = new Set(selectedMemories);
    if (newSelected.has(memoryId)) {
      newSelected.delete(memoryId);
    } else {
      newSelected.add(memoryId);
    }
    setSelectedMemories(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMemories.size === filteredMemories.length) {
      setSelectedMemories(new Set());
    } else {
      setSelectedMemories(new Set(filteredMemories.map(m => m.id)));
    }
  };

  const handleExportSelected = () => {
    onExport(Array.from(selectedMemories));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'interaction':
        return <MessageSquare className="w-4 h-4" />;
      case 'capture':
        return <Brain className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      case 'event':
        return <Calendar className="w-4 h-4" />;
      case 'task':
        return <CheckSquare className="w-4 h-4" />;
      default:
        return <Circle className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'interaction':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'capture':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'email':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'document':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'event':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'task':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffInDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getUniqueTags = () => {
    const tagSet = new Set<string>();
    memories.forEach(memory => {
      memory.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Brain className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Memory Timeline</h1>
              <p className="text-gray-600">Explore and manage your captured memories</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {selectedMemories.size > 0 && (
              <>
                <span className="text-sm text-gray-600">
                  {selectedMemories.size} selected
                </span>
                <button
                  onClick={handleExportSelected}
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  title="Export selected"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => onExport([])}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Export all"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search memories, tags, or content..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="timestamp">Sort by Time</option>
            <option value="importance">Sort by Importance</option>
            <option value="confidence">Sort by Confidence</option>
          </select>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="space-y-1">
                {['interaction', 'capture', 'email', 'document', 'event', 'task'].map(type => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.type?.includes(type) || false}
                      onChange={(e) => {
                        const currentTypes = filters.type || [];
                        const newTypes = e.target.checked
                          ? [...currentTypes, type]
                          : currentTypes.filter(t => t !== type);
                        handleFilterChange({ type: newTypes });
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Importance Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Importance</label>
              <div className="space-y-1">
                {['critical', 'high', 'medium', 'low'].map(importance => (
                  <label key={importance} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.importance?.includes(importance) || false}
                      onChange={(e) => {
                        const currentImportance = filters.importance || [];
                        const newImportance = e.target.checked
                          ? [...currentImportance, importance]
                          : currentImportance.filter(i => i !== importance);
                        handleFilterChange({ importance: newImportance });
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm capitalize">{importance}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tags Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {getUniqueTags().slice(0, 10).map(tag => (
                  <label key={tag} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.tags?.includes(tag) || false}
                      onChange={(e) => {
                        const currentTags = filters.tags || [];
                        const newTags = e.target.checked
                          ? [...currentTags, tag]
                          : currentTags.filter(t => t !== tag);
                        handleFilterChange({ tags: newTags });
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm">{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={selectedMemories.size === filteredMemories.length && filteredMemories.length > 0}
              onChange={handleSelectAll}
              className="rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-600">
              {filteredMemories.length} memories
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {filteredMemories.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No memories found matching your criteria.</p>
            </div>
          ) : (
            filteredMemories.map((memory) => (
              <div
                key={memory.id}
                className={`relative pl-8 pb-8 border-l-2 border-gray-200 hover:border-purple-400 transition-colors cursor-pointer group ${
                  selectedMemories.has(memory.id) ? 'bg-purple-50 rounded-lg -ml-4 pl-4' : ''
                }`}
                onClick={() => onMemorySelect(memory)}
              >
                {/* Timeline dot */}
                <div className="absolute left-[-11px] top-0 w-5 h-5 bg-white border-4 border-purple-500 rounded-full flex items-center justify-center">
                  {getTypeIcon(memory.type)}
                </div>

                {/* Importance indicator */}
                <div className={`absolute left-[-15px] top-6 w-2 h-2 rounded-full ${getImportanceColor(memory.importance)}`} />

                {/* Memory card */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedMemories.has(memory.id)}
                        onChange={() => handleMemoryToggle(memory.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getTypeColor(memory.type)}`}>
                        {memory.type}
                      </span>
                      
                      <span className="text-sm text-gray-500">
                        {formatDate(memory.timestamp)}
                      </span>
                      
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${getImportanceColor(memory.importance)}`} />
                        <span className="text-xs text-gray-600 capitalize">
                          {memory.importance}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {Math.round(memory.confidence * 100)}%
                      </span>
                      <Star className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-2">{memory.title}</h3>
                  <p className="text-gray-700 mb-3 line-clamp-3">{memory.content}</p>

                  {memory.tags.length > 0 && (
                    <div className="flex items-center space-x-2 flex-wrap">
                      <Tag className="w-4 h-4 text-gray-400" />
                      {memory.tags.slice(0, 5).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {memory.tags.length > 5 && (
                        <span className="text-xs text-gray-500">
                          +{memory.tags.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Import required Lucide icons
import { MessageSquare, Mail, FileText, CheckSquare, Circle } from 'lucide-react';