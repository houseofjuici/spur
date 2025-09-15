-- SQLite Database Schema for Spur Memory Graph
-- This schema supports a sophisticated graph database with nodes, edges, and metadata

-- Enable foreign key constraints and WAL mode for better performance
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -10000; -- 10MB cache
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB memory mapping

-- Nodes table - stores all graph nodes
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('activity', 'pattern', 'resource', 'concept', 'project', 'workflow', 'email', 'code', 'github', 'learning')),
    timestamp INTEGER NOT NULL,
    content TEXT NOT NULL, -- JSON stored as TEXT
    metadata TEXT NOT NULL, -- JSON stored as TEXT
    relevance_score REAL NOT NULL DEFAULT 1.0,
    decay_factor REAL NOT NULL DEFAULT 0.1,
    degree INTEGER NOT NULL DEFAULT 0,
    clustering REAL NOT NULL DEFAULT 0.0,
    centrality REAL NOT NULL DEFAULT 0.0,
    community TEXT,
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array
    embeddings BLOB, -- Vector embeddings stored as BLOB
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed INTEGER NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    source_type TEXT NOT NULL DEFAULT 'event' CHECK (source_type IN ('event', 'pattern', 'user', 'system')),
    is_pruned BOOLEAN NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Indexes for performance
    INDEX idx_nodes_type (type),
    INDEX idx_nodes_timestamp (timestamp),
    INDEX idx_nodes_relevance (relevance_score),
    INDEX idx_nodes_created (created_at),
    INDEX idx_nodes_updated (updated_at),
    INDEX idx_nodes_accessed (last_accessed),
    INDEX idx_nodes_degree (degree),
    INDEX idx_nodes_centrality (centrality),
    INDEX idx_nodes_community (community),
    INDEX idx_nodes_source (source_type),
    INDEX idx_nodes_pruned (is_pruned)
);

-- Edges table - stores all graph relationships
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('temporal', 'semantic', 'causal', 'spatial', 'reference', 'dependency', 'association')),
    strength REAL NOT NULL DEFAULT 1.0,
    context TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    metadata TEXT, -- JSON stored as TEXT
    bidirectional BOOLEAN NOT NULL DEFAULT 0,
    weight REAL NOT NULL DEFAULT 1.0,
    probability REAL NOT NULL DEFAULT 1.0,
    decay_rate REAL NOT NULL DEFAULT 0.1,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    interaction_count INTEGER NOT NULL DEFAULT 0,
    last_interaction INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Foreign key constraints
    FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate edges
    UNIQUE(source_id, target_id, type),
    
    -- Indexes for performance
    INDEX idx_edges_source (source_id),
    INDEX idx_edges_target (target_id),
    INDEX idx_edges_type (type),
    INDEX idx_edges_strength (strength),
    INDEX idx_edges_timestamp (timestamp),
    INDEX idx_edges_weight (weight),
    INDEX idx_edges_active (is_active),
    INDEX idx_edges_interaction (interaction_count),
    INDEX idx_edges_last_interaction (last_interaction),
    -- Composite indexes for common queries
    INDEX idx_edges_source_type (source_id, type),
    INDEX idx_edges_target_type (target_id, type),
    INDEX idx_edges_source_target (source_id, target_id),
    INDEX idx_edges_type_strength (type, strength),
    INDEX idx_edges_timestamp_active (timestamp, is_active)
);

-- Node tags table for efficient tag-based queries
CREATE TABLE IF NOT EXISTS node_tags (
    node_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0,
    
    -- Foreign key constraint
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- Unique constraint
    UNIQUE(node_id, tag),
    
    -- Indexes for performance
    INDEX idx_node_tags_node (node_id),
    INDEX idx_node_tags_tag (tag),
    INDEX idx_node_tags_weight (weight)
);

-- Semantic embeddings table for vector similarity search
CREATE TABLE IF NOT EXISTS embeddings (
    node_id TEXT PRIMARY KEY,
    embedding BLOB NOT NULL, -- Stored as binary blob
    dimension INTEGER NOT NULL,
    model_version TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Foreign key constraint
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- Index for performance
    INDEX idx_embeddings_created (created_at)
);

-- Temporal clusters table for time-based grouping
CREATE TABLE IF NOT EXISTS temporal_clusters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    node_ids TEXT NOT NULL, -- JSON array of node IDs
    centroid_node_id TEXT,
    density REAL NOT NULL,
    confidence REAL NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Foreign key constraint for centroid
    FOREIGN KEY (centroid_node_id) REFERENCES nodes(id),
    
    -- Indexes for performance
    INDEX idx_temporal_clusters_time (start_time, end_time),
    INDEX idx_temporal_clusters_density (density),
    INDEX idx_temporal_clusters_confidence (confidence),
    INDEX idx_temporal_clusters_created (created_at)
);

-- Communities table for detected communities
CREATE TABLE IF NOT EXISTS communities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    node_ids TEXT NOT NULL, -- JSON array of node IDs
    density REAL NOT NULL,
    size INTEGER NOT NULL,
    central_nodes TEXT NOT NULL, -- JSON array of central node IDs
    dominant_type TEXT NOT NULL,
    detection_method TEXT NOT NULL,
    confidence REAL NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Indexes for performance
    INDEX idx_communities_size (size),
    INDEX idx_communities_density (density),
    INDEX idx_communities_type (dominant_type),
    INDEX idx_communities_confidence (confidence)
);

-- Patterns table for detected patterns
CREATE TABLE IF NOT EXISTS patterns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('temporal', 'semantic', 'structural', 'behavioral')),
    node_types TEXT NOT NULL, -- JSON array of node types
    edge_types TEXT NOT NULL, -- JSON array of edge types
    constraints TEXT NOT NULL, -- JSON object with pattern constraints
    confidence REAL NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 0,
    last_detected INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Indexes for performance
    INDEX idx_patterns_type (type),
    INDEX idx_patterns_confidence (confidence),
    INDEX idx_patterns_frequency (frequency),
    INDEX idx_patterns_active (is_active),
    INDEX idx_patterns_detected (last_detected)
);

-- Pattern instances table for specific pattern occurrences
CREATE TABLE IF NOT EXISTS pattern_instances (
    id TEXT PRIMARY KEY,
    pattern_id TEXT NOT NULL,
    node_ids TEXT NOT NULL, -- JSON array of node IDs
    edge_ids TEXT NOT NULL, -- JSON array of edge IDs
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    confidence REAL NOT NULL,
    metadata TEXT, -- JSON stored as TEXT
    created_at INTEGER NOT NULL,
    
    -- Foreign key constraint
    FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_pattern_instances_pattern (pattern_id),
    INDEX idx_pattern_instances_time (start_time, end_time),
    INDEX idx_pattern_instances_confidence (confidence),
    INDEX idx_pattern_instances_created (created_at)
);

-- Query cache table for performance optimization
CREATE TABLE IF NOT EXISTS query_cache (
    id TEXT PRIMARY KEY,
    query_hash TEXT NOT NULL UNIQUE,
    query_text TEXT NOT NULL,
    result TEXT NOT NULL, -- JSON stored as TEXT
    execution_time INTEGER NOT NULL,
    result_count INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 0,
    
    -- Indexes for performance
    INDEX idx_query_cache_hash (query_hash),
    INDEX idx_query_cache_expires (expires_at),
    INDEX idx_query_cache_hits (hit_count),
    INDEX idx_query_cache_created (created_at)
);

-- Graph statistics table for analytics
CREATE TABLE IF NOT EXISTS graph_stats (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Single row table
    total_nodes INTEGER NOT NULL,
    total_edges INTEGER NOT NULL,
    active_nodes INTEGER NOT NULL,
    active_edges INTEGER NOT NULL,
    average_degree REAL NOT NULL,
    clustering_coefficient REAL NOT NULL,
    density REAL NOT NULL,
    diameter INTEGER,
    last_update INTEGER NOT NULL,
    memory_usage INTEGER NOT NULL,
    analytics TEXT -- JSON stored as TEXT
);

-- System configuration table
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL, -- JSON stored as TEXT
    type TEXT NOT NULL CHECK (type IN ('string', 'number', 'boolean', 'object', 'array')),
    description TEXT,
    updated_at INTEGER NOT NULL,
    
    -- Index for performance
    INDEX idx_config_key (key)
);

-- Audit log for tracking changes
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'query', 'prune', 'analyze')),
    target_type TEXT NOT NULL CHECK (target_type IN ('node', 'edge', 'cluster', 'community', 'pattern', 'config')),
    target_id TEXT,
    user_id TEXT,
    session_id TEXT,
    details TEXT, -- JSON stored as TEXT
    timestamp INTEGER NOT NULL,
    
    -- Indexes for performance
    INDEX idx_audit_log_action (action),
    INDEX idx_audit_log_target (target_type, target_id),
    INDEX idx_audit_log_user (user_id),
    INDEX idx_audit_log_session (session_id),
    INDEX idx_audit_log_timestamp (timestamp)
);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS nodes_updated_at 
    AFTER UPDATE ON nodes
    BEGIN
        UPDATE nodes SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS edges_updated_at 
    AFTER UPDATE ON edges
    BEGIN
        UPDATE edges SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS embeddings_updated_at 
    AFTER UPDATE ON embeddings
    BEGIN
        UPDATE embeddings SET updated_at = strftime('%s', 'now') * 1000 WHERE node_id = NEW.node_id;
    END;

CREATE TRIGGER IF NOT EXISTS temporal_clusters_updated_at 
    AFTER UPDATE ON temporal_clusters
    BEGIN
        UPDATE temporal_clusters SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS communities_updated_at 
    AFTER UPDATE ON communities
    BEGIN
        UPDATE communities SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS patterns_updated_at 
    AFTER UPDATE ON patterns
    BEGIN
        UPDATE patterns SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

-- Trigger to maintain node degree count
CREATE TRIGGER IF NOT EXISTS update_node_degree_after_edge_insert
    AFTER INSERT ON edges
    BEGIN
        UPDATE nodes 
        SET degree = (
            SELECT COUNT(*) 
            FROM edges 
            WHERE source_id = NEW.source_id OR target_id = NEW.source_id
        )
        WHERE id = NEW.source_id;
        
        UPDATE nodes 
        SET degree = (
            SELECT COUNT(*) 
            FROM edges 
            WHERE source_id = NEW.target_id OR target_id = NEW.target_id
        )
        WHERE id = NEW.target_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_node_degree_after_edge_delete
    AFTER DELETE ON edges
    BEGIN
        UPDATE nodes 
        SET degree = (
            SELECT COUNT(*) 
            FROM edges 
            WHERE source_id = OLD.source_id OR target_id = OLD.source_id
        )
        WHERE id = OLD.source_id;
        
        UPDATE nodes 
        SET degree = (
            SELECT COUNT(*) 
            FROM edges 
            WHERE source_id = OLD.target_id OR target_id = OLD.target_id
        )
        WHERE id = OLD.target_id;
    END;

-- Initialize default configuration
INSERT OR IGNORE INTO config (key, value, type, description, updated_at) VALUES 
('schema_version', '1.0', 'string', 'Database schema version', strftime('%s', 'now') * 1000),
('last_prune', '0', 'number', 'Timestamp of last pruning operation', strftime('%s', 'now') * 1000),
('last_analytics', '0', 'number', 'Timestamp of last analytics update', strftime('%s', 'now') * 1000),
('query_cache_enabled', 'true', 'boolean', 'Whether query caching is enabled', strftime('%s', 'now') * 1000),
('analytics_enabled', 'true', 'boolean', 'Whether analytics collection is enabled', strftime('%s', 'now') * 1000),
('audit_logging', 'true', 'boolean', 'Whether audit logging is enabled', strftime('%s', 'now') * 1000);

-- Initialize graph statistics
INSERT OR IGNORE INTO graph_stats (
    id, total_nodes, total_edges, active_nodes, active_edges, 
    average_degree, clustering_coefficient, density, diameter, 
    last_update, memory_usage, analytics
) VALUES (
    1, 0, 0, 0, 0, 0.0, 0.0, 0.0, NULL, strftime('%s', 'now') * 1000, 0, '{}'
);