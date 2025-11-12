-- Migration to add feedback collection and analytics tables
-- This enables tracking AI tool usage and learning outcomes

-- Track all AI tool usage with user identity
CREATE TABLE IF NOT EXISTS ai_interactions (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  tool_type TEXT NOT NULL, -- 'auditor' or 'chat'
  input_length INTEGER,
  output_length INTEGER,
  model_used TEXT,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Tool-specific metrics
  vulnerabilities_found INTEGER, -- For auditor
  query_category TEXT, -- For chat ('setup', 'debugging', 'concepts', etc.)
  
  -- Learning context
  current_module TEXT,
  session_id TEXT,
  
  -- Quality indicators
  had_followup_questions BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_wallet ON ai_interactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_created ON ai_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_tool ON ai_interactions(tool_type);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_session ON ai_interactions(session_id);

-- Collect explicit feedback on AI responses
CREATE TABLE IF NOT EXISTS ai_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  interaction_id TEXT NOT NULL, -- Links to ai_interactions.id
  wallet_address TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  feedback_type TEXT NOT NULL, -- 'thumbs_up', 'thumbs_down', 'rating', 'text'
  feedback_value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Additional context
  response_quality_rating INTEGER, -- 1-5 scale
  
  FOREIGN KEY (interaction_id) REFERENCES ai_interactions(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_interaction ON ai_feedback(interaction_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_wallet ON ai_feedback(wallet_address);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created ON ai_feedback(created_at);

-- Collect feedback at end of learning modules
CREATE TABLE IF NOT EXISTS module_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT NOT NULL,
  module_slug TEXT NOT NULL,
  achievement_codes TEXT, -- JSON array of achievements earned
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Learning experience ratings (1-5 scale)
  content_difficulty INTEGER,
  content_clarity INTEGER,
  practical_value INTEGER,
  pace_appropriateness INTEGER,
  
  -- Text feedback
  what_worked_well TEXT,
  suggestions_for_improvement TEXT,
  additional_topics_wanted TEXT,
  
  -- Engagement indicators
  time_spent_minutes INTEGER,
  external_resources_used BOOLEAN,
  ai_tools_helpful BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_module_feedback_wallet ON module_feedback(wallet_address);
CREATE INDEX IF NOT EXISTS idx_module_feedback_module ON module_feedback(module_slug);
CREATE INDEX IF NOT EXISTS idx_module_feedback_created ON module_feedback(created_at);

