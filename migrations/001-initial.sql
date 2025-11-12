-- Initial schema for Plunder Academy training system

-- Table to store wallet information and metadata
CREATE TABLE IF NOT EXISTS wallet_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON field for additional wallet metadata
);

-- Table to track training completions and voucher issuance
CREATE TABLE IF NOT EXISTS training_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    achievement_number TEXT NOT NULL, -- Achievement number like "0001", "0042", etc.
    task_code INTEGER NOT NULL,       -- Numeric task code for contract (derived from achievement_number)
    answer TEXT NOT NULL,             -- User's answer (multichoice string or tx id)
    voucher_signature TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_address) REFERENCES wallet_data(wallet_address),
    UNIQUE(wallet_address, achievement_number)
);

-- Table to store approved issuers (addresses that can sign vouchers)
CREATE TABLE IF NOT EXISTS approved_issuers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issuer_address TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table to track API requests and rate limiting
CREATE TABLE IF NOT EXISTS api_requests (
    wallet_address TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    last_request DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (wallet_address, ip_address, endpoint)
) WITHOUT ROWID;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_completions ON training_completions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_achievement_completions ON training_completions(achievement_number);
CREATE INDEX IF NOT EXISTS idx_task_completions ON training_completions(task_code);
CREATE INDEX IF NOT EXISTS idx_api_requests_rate_limit ON api_requests(last_request);
