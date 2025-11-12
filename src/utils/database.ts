import type { WalletData, TrainingCompletion } from '../types';

export class DatabaseService {
  constructor(private db: D1Database) {}

  // Wallet operations
  async createWalletData(walletAddress: string): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR IGNORE INTO wallet_data (wallet_address, created_at, updated_at)
        VALUES (?, datetime('now'), datetime('now'))
      `)
      .bind(walletAddress)
      .run();
  }

  async getWalletData(walletAddress: string): Promise<WalletData | null> {
    return await this.db
      .prepare('SELECT * FROM wallet_data WHERE wallet_address = ?')
      .bind(walletAddress)
      .first<WalletData>();
  }

  async updateWalletMetadata(walletAddress: string, metadata: string): Promise<void> {
    await this.db
      .prepare(`
        UPDATE wallet_data 
        SET metadata = ?, updated_at = datetime('now')
        WHERE wallet_address = ?
      `)
      .bind(metadata, walletAddress)
      .run();
  }

  // Training completion operations
  async createTrainingCompletion(completion: Omit<TrainingCompletion, 'id' | 'created_at'>): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO training_completions 
        (wallet_address, achievement_number, task_code, submission_type, submission_data, score, max_score, passed, voucher_signature, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(
        completion.wallet_address,
        completion.achievement_number,
        completion.task_code,
        completion.submission_type,
        completion.submission_data,
        completion.score || null,
        completion.max_score || null,
        completion.passed,
        completion.voucher_signature || null,
        completion.metadata || null
      )
      .run();
  }

  async getTrainingCompletion(walletAddress: string, achievementNumber: string): Promise<TrainingCompletion | null> {
    // Get the most recent successful completion
    return await this.db
      .prepare('SELECT * FROM training_completions WHERE wallet_address = ? AND achievement_number = ? AND passed = true ORDER BY created_at DESC LIMIT 1')
      .bind(walletAddress, achievementNumber)
      .first<TrainingCompletion>();
  }

  async getTrainingCompletionByTaskCode(walletAddress: string, taskCode: number): Promise<TrainingCompletion | null> {
    return await this.db
      .prepare('SELECT * FROM training_completions WHERE wallet_address = ? AND task_code = ?')
      .bind(walletAddress, taskCode)
      .first<TrainingCompletion>();
  }

  async getWalletCompletions(walletAddress: string): Promise<TrainingCompletion[]> {
    // Only return successful completions that have vouchers
    const result = await this.db
      .prepare('SELECT * FROM training_completions WHERE wallet_address = ? AND passed = true ORDER BY created_at DESC')
      .bind(walletAddress)
      .all<TrainingCompletion>();
    
    return result.results || [];
  }

  // Remove the update submitted method since we read from contract instead

  // Rate limiting operations
  async checkRateLimit(
    walletAddress: string, 
    ipAddress: string, 
    endpoint: string, 
    maxRequests: number, 
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const windowStart = new Date(Date.now() - windowMs).toISOString();
    
    // Get current count
    const current = await this.db
      .prepare(`
        SELECT request_count 
        FROM api_requests 
        WHERE wallet_address = ? AND ip_address = ? AND endpoint = ? AND last_request > ?
      `)
      .bind(walletAddress, ipAddress, endpoint, windowStart)
      .first<{ request_count: number }>();

    const currentCount = current?.request_count || 0;

    if (currentCount >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    // Update or insert request record
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO api_requests 
        (wallet_address, ip_address, endpoint, request_count, last_request)
        VALUES (?, ?, ?, COALESCE((SELECT request_count FROM api_requests WHERE wallet_address = ? AND ip_address = ? AND endpoint = ? AND last_request > ?), 0) + 1, datetime('now'))
      `)
      .bind(walletAddress, ipAddress, endpoint, walletAddress, ipAddress, endpoint, windowStart)
      .run();

    return { allowed: true, remaining: maxRequests - currentCount - 1 };
  }

  // Admin operations
  async addApprovedIssuer(issuerAddress: string): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO approved_issuers (issuer_address, is_active, created_at)
        VALUES (?, true, datetime('now'))
      `)
      .bind(issuerAddress)
      .run();
  }

  async removeApprovedIssuer(issuerAddress: string): Promise<void> {
    await this.db
      .prepare('UPDATE approved_issuers SET is_active = false WHERE issuer_address = ?')
      .bind(issuerAddress)
      .run();
  }

  async isApprovedIssuer(issuerAddress: string): Promise<boolean> {
    const result = await this.db
      .prepare('SELECT is_active FROM approved_issuers WHERE issuer_address = ? AND is_active = true')
      .bind(issuerAddress)
      .first<{ is_active: boolean }>();
    
    return !!result?.is_active;
  }
}
