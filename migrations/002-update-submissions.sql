-- Migration to update training_completions table for new submission system
-- This adds support for different submission types, scoring, and retry tracking

-- Add new columns to support the updated submission system
ALTER TABLE training_completions ADD COLUMN submission_type TEXT;
ALTER TABLE training_completions ADD COLUMN submission_data TEXT; -- JSON string of submission data
ALTER TABLE training_completions ADD COLUMN score INTEGER;
ALTER TABLE training_completions ADD COLUMN max_score INTEGER;
ALTER TABLE training_completions ADD COLUMN passed BOOLEAN DEFAULT FALSE;
ALTER TABLE training_completions ADD COLUMN metadata TEXT; -- JSON string for additional metadata like timeSpent

-- Update existing data to work with new system
-- Set default values for existing records
UPDATE training_completions 
SET submission_type = 'quiz',
    submission_data = json_object('answers', json_object('legacy', answer)),
    passed = TRUE
WHERE submission_type IS NULL;

-- Remove the unique constraint on wallet_address + achievement_number 
-- since we now allow retries (multiple attempts, only successful ones get vouchers)
-- We'll create a new table with the updated schema and migrate data

-- Create new table with updated schema
CREATE TABLE IF NOT EXISTS training_completions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    achievement_number TEXT NOT NULL,
    task_code INTEGER NOT NULL,
    submission_type TEXT NOT NULL,
    submission_data TEXT NOT NULL, -- JSON string
    score INTEGER,
    max_score INTEGER,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    voucher_signature TEXT,
    metadata TEXT, -- JSON string for additional data like timeSpent
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_address) REFERENCES wallet_data(wallet_address)
);

-- Copy data from old table to new table
INSERT INTO training_completions_new (
    id, wallet_address, achievement_number, task_code, 
    submission_type, submission_data, score, max_score, passed, 
    voucher_signature, metadata, created_at
)
SELECT 
    id, wallet_address, achievement_number, task_code,
    COALESCE(submission_type, 'quiz'),
    COALESCE(submission_data, json_object('answers', json_object('legacy', answer))),
    score, max_score,
    COALESCE(passed, TRUE),
    voucher_signature, metadata, created_at
FROM training_completions;

-- Drop old table and rename new one
DROP TABLE training_completions;
ALTER TABLE training_completions_new RENAME TO training_completions;

-- Recreate indexes for the new table structure
CREATE INDEX IF NOT EXISTS idx_wallet_completions ON training_completions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_achievement_completions ON training_completions(achievement_number);
CREATE INDEX IF NOT EXISTS idx_task_completions ON training_completions(task_code);
CREATE INDEX IF NOT EXISTS idx_passed_completions ON training_completions(passed);
CREATE INDEX IF NOT EXISTS idx_wallet_achievement_passed ON training_completions(wallet_address, achievement_number, passed);
