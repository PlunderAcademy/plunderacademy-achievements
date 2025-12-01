export interface CompletionVoucher {
  taskCode: number;
  wallet: string;
}

export interface VoucherRequest {
  walletAddress: string;
  achievementNumber: string; // "0001"-"0005", "1001"+
  submissionType: "quiz" | "transaction" | "contract" | "custom" | "secret";
  submissionData: any; // Flexible based on type
  metadata?: {
    timestamp: string;
    timeSpent?: number;
  };
}

export interface VoucherResponse {
  success: boolean;
  voucher?: CompletionVoucher;
  signature?: string;
  contractAddress?: string;
  chainId?: number;
  results?: {
    passed: boolean;
    score?: number;
    maxScore?: number;
    passingScore?: number;
    // Quiz fields (DON'T return correct answers)
    totalQuestions?: number;
    correctAnswers?: number;
    timeSpent?: number;
    accuracy?: number;
    // Transaction fields
    transactionValid?: boolean;
    blockNumber?: number;
    // Feedback
    feedback?: string;
    nextSteps?: string[];
    retryAllowed?: boolean;
  };
  error?: string;
}

export interface WalletData {
  id?: number;
  wallet_address: string;
  created_at?: string;
  updated_at?: string;
  metadata?: string; // JSON string
}

export interface TrainingCompletion {
  id?: number;
  wallet_address: string;
  achievement_number: string;
  task_code: number;
  submission_type: string;
  submission_data: string; // JSON string
  score?: number;
  max_score?: number;
  passed: boolean;
  voucher_signature?: string;
  created_at?: string;
  metadata?: string; // JSON string for additional data like timeSpent
}

export interface WalletAchievement {
  achievementNumber: string;
  tokenId: number;
  hasVoucher: boolean;
  isClaimed: boolean;
  voucherSignature?: string;
  metadataUri?: string;
  createdAt?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  code?: string;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface EIP712Types {
  CompletionVoucher: Array<{
    name: string;
    type: string;
  }>;
  [key: string]: Array<{
    name: string;
    type: string;
  }>;
}

// Rate limiting
export interface RateLimit {
  windowMs: number;
  maxRequests: number;
}

export const RATE_LIMITS: Record<string, RateLimit> = {
  '/api/v1/vouchers/issue': { windowMs: 60000, maxRequests: 10 }, // 10 per minute
  '/api/v1/wallets': { windowMs: 60000, maxRequests: 30 }, // 30 per minute
  '/api/v1/feedback/ai-interaction': { windowMs: 3600000, maxRequests: 100 }, // 100 per hour
  '/api/v1/feedback/ai-response': { windowMs: 3600000, maxRequests: 100 }, // 100 per hour
  '/api/v1/feedback/module-completion': { windowMs: 3600000, maxRequests: 100 }, // 100 per hour
  '/api/v1/feedback/general': { windowMs: 3600000, maxRequests: 50 }, // 50 per hour
};

// Submission validation
export interface ValidationResult {
  passed: boolean;
  score?: number;
  maxScore?: number;
  passingScore?: number;
  totalQuestions?: number;
  correctAnswers?: number;
  timeSpent?: number;
  accuracy?: number;
  transactionValid?: boolean;
  blockNumber?: number;
  feedback?: string;
  nextSteps?: string[];
  retryAllowed?: boolean;
  
  // Token creation specific fields (achievement 0005)
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  
  // Generic contract deployment fields (achievements 0025, 0033, 0043, 0046)
  contractAddress?: string;
  method?: "factory" | "deployment";
  
  // Debug information (included in development/error responses)
  debug?: any;
  
  error?: string;
}

export interface ValidationContext {
  achievementNumber: string;
  walletAddress: string;
  rpcUrl: string;
  submissionType: "quiz" | "transaction" | "contract" | "custom" | "secret";
  submissionData: any;
  metadata?: {
    timestamp: string;
    timeSpent?: number;
  };
}

// Quiz-specific types
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string | InteractiveElementCorrectAnswer;
  points: number;
  explanation?: string;
  type?: 'traditional' | 'word-jumble' | 'concept-matching' | 'timeline-builder' | 'true-false-statements' | 'drag-drop-puzzle';
}

export interface QuizSubmission {
  answers: { [questionId: string]: string };
}

// Interactive element types for quiz questions
export interface InteractiveElementCorrectAnswer {
  type: 'word-jumble' | 'concept-matching' | 'timeline-builder' | 'true-false-statements' | 'drag-drop-puzzle';
  data: WordJumbleAnswer | ConceptMatchingAnswer | TimelineBuilderAnswer | TrueFalseAnswer | DragDropPuzzleAnswer;
}

export interface WordJumbleAnswer {
  word: string;
}

export interface ConceptMatchingAnswer {
  pairs: Array<{ conceptId: string; definitionId: string }>;
}

export interface TimelineBuilderAnswer {
  sequence: string[];
}

export interface TrueFalseAnswer {
  classifications: Array<{ id: string; answer: boolean }>;
}

export interface DragDropPuzzleAnswer {
  sequence: string[];
}

export interface QuizResult {
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  maxScore: number;
  passingScore: number;
  accuracy: number;
  timeSpent?: number;
  passed: boolean;
}

// Transaction submission type
export interface TransactionSubmission {
  transactionHash: string;
  chainId?: number;
  claimantAddress?: string;
  method?: "factory" | "deployment"; // For achievement 0005: token creation method
}

// Secret submission type
export interface SecretSubmission {
  secretAnswer: string;
}

export type SubmissionValidator = (data: any, context: ValidationContext) => Promise<ValidationResult>;

// Cloudflare Workers environment bindings (shared across all routes)
export type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  ISSUER_PRIVATE_KEY: string;
  CONTRACT_ADDRESS: string;
  CHAIN_ID: string;
  RPC_URL: string;  // Default/fallback RPC URL
  RPC_URL_MAINNET?: string;  // Mainnet RPC (chainId 32769)
  RPC_URL_TESTNET?: string;  // Testnet RPC (chainId 33101)
  NEXT_PUBLIC_FACTORY_ADDRESS_TESTNET?: string;
  NEXT_PUBLIC_FACTORY_ADDRESS_MAINNET?: string;
  QUIZ_DATA_URL?: string;
  SECRET_ANSWERS_URL?: string;
};

// Feedback and Analytics Types

export interface AIInteraction {
  id: string;
  wallet_address: string;
  tool_type: 'auditor' | 'chat';
  input_length?: number;
  output_length?: number;
  model_used?: string;
  duration_ms?: number;
  created_at?: string;
  
  // Tool-specific metrics
  vulnerabilities_found?: number;
  query_category?: string;
  
  // Learning context
  current_module?: string;
  session_id?: string;
  
  // Quality indicators
  had_followup_questions?: boolean;
}

export interface AIFeedback {
  id?: number;
  interaction_id: string;
  wallet_address: string;
  tool_type: 'auditor' | 'chat';
  feedback_type: 'thumbs_up' | 'thumbs_down' | 'rating' | 'text';
  feedback_value: string;
  created_at?: string;
  response_quality_rating?: number;
}

export interface ModuleFeedback {
  id?: number;
  wallet_address: string;
  module_slug: string;
  achievement_codes?: string; // JSON array
  created_at?: string;
  
  // Learning experience ratings (1-5 scale)
  content_difficulty?: number;
  content_clarity?: number;
  practical_value?: number;
  pace_appropriateness?: number;
  
  // Text feedback
  what_worked_well?: string;
  suggestions_for_improvement?: string;
  additional_topics_wanted?: string;
  
  // Engagement indicators
  time_spent_minutes?: number;
  external_resources_used?: boolean;
  ai_tools_helpful?: boolean;
}

export interface AIInteractionRequest {
  id: string;
  walletAddress: string;
  toolType: 'auditor' | 'chat';
  inputLength?: number;
  outputLength?: number;
  modelUsed?: string;
  durationMs?: number;
  vulnerabilitiesFound?: number;
  queryCategory?: string;
  currentModule?: string;
  sessionId?: string;
}

export interface AIFeedbackRequest {
  interactionId: string;
  walletAddress: string;
  toolType: 'auditor' | 'chat';
  feedbackType: 'thumbs_up' | 'thumbs_down' | 'rating' | 'text';
  feedbackValue: string;
  qualityRating?: number;
}

export interface ModuleFeedbackRequest {
  walletAddress: string;
  moduleSlug: string;
  achievementCodes?: string[];
  contentDifficulty?: number;
  contentClarity?: number;
  practicalValue?: number;
  paceAppropriateness?: number;
  whatWorkedWell?: string;
  suggestionsForImprovement?: string;
  additionalTopicsWanted?: string;
  timeSpentMinutes?: number;
  externalResourcesUsed?: boolean;
  aiToolsHelpful?: boolean;
}

export interface GeneralFeedbackRequest {
  walletAddress: string;
  category: 'bug' | 'feature-request' | 'ui' | 'content' | 'other';
  feedback: string;
  title?: string;
  rating?: number; // 1-5 satisfaction rating
  pageUrl?: string;
  metadata?: Record<string, string>;
}

export interface UserAnalyticsStats {
  totalAIInteractions: number;
  auditorUsage: number;
  chatUsage: number;
  avgVulnerabilitiesPerScan: number;
  positiveFeedback: number;
  negativeFeedback: number;
  avgQualityRating: number;
  modulesCompleted: number;
  avgModuleDifficulty: number;
  avgModuleValue: number;
  aiToolsHelpfulRate: number;
}

export interface UserAnalyticsResponse {
  walletAddress: string;
  stats: UserAnalyticsStats;
  recentInteractions: Array<{
    id: string;
    toolType: string;
    createdAt: string;
    feedback?: string;
  }>;
  moduleProgress: Array<{
    moduleSlug: string;
    completedAt: string;
    avgRating: number;
  }>;
}

export interface PlatformAnalytics {
  totalUsers: number;
  totalInteractions: number;
  totalFeedbackSubmissions: number;
  averageSatisfaction: number;
  auditorSatisfaction: number;
  chatSatisfaction: number;
  totalModulesCompleted: number;
  avgInteractionsPerUser: number;
  avgModulesPerUser: number;
}

export interface ToolsAnalytics {
  auditorUsage: number;
  chatUsage: number;
  auditorAvgDuration: number;
  chatAvgDuration: number;
  auditorPositiveFeedback: number;
  auditorNegativeFeedback: number;
  chatPositiveFeedback: number;
  chatNegativeFeedback: number;
}

export interface ModuleStats {
  moduleSlug: string;
  completions: number;
  avgDifficulty: number;
  avgClarity: number;
  avgValue: number;
  avgPace: number;
  avgTimeSpent: number;
  aiToolsHelpfulRate: number;
}

export interface QueryCategoryStats {
  category: string;
  count: number;
  avgDuration: number;
  satisfactionRate: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  interactions: number;
  positiveFeedback: number;
  negativeFeedback: number;
}

export interface RecentActivityItem {
  id: string;
  walletAddress: string;
  toolType: string;
  createdAt: string;
  feedback?: string;
}

export interface AnalyticsSummaryResponse {
  platform: PlatformAnalytics;
  tools: ToolsAnalytics;
  modules: ModuleStats[];
  queryCategories: QueryCategoryStats[];
  timeSeries: TimeSeriesDataPoint[];
  recentActivity: RecentActivityItem[];
}

export interface LeaderboardEntry {
  walletAddress: string;
  achievementCount: number;
  aiInteractions: number;
  avgFeedbackRating: number;
  rank: number;
}

export interface LeaderboardResponse {
  timeframe: string;
  topLearners: LeaderboardEntry[];
}

export interface TextFeedbackItem {
  id: number;
  interactionId: string;
  walletAddress: string;
  toolType: string;
  feedbackType: string;
  feedbackValue: string;
  qualityRating: number | null;
  moduleSlug: string | null;
  createdAt: string;
}

export interface TextFeedbackResponse {
  timeframe: string;
  feedback: TextFeedbackItem[];
}

export interface ModuleFeedbackItem {
  id: number;
  walletAddress: string;
  moduleSlug: string;
  contentDifficulty: number | null;
  contentClarity: number | null;
  practicalValue: number | null;
  paceAppropriateness: number | null;
  whatWorkedWell: string | null;
  suggestionsForImprovement: string | null;
  additionalTopicsWanted: string | null;
  timeSpentMinutes: number | null;
  externalResourcesUsed: boolean | null;
  aiToolsHelpful: boolean | null;
  createdAt: string;
}

export interface ModuleFeedbackResponse {
  timeframe: string;
  feedback: ModuleFeedbackItem[];
}

export interface AICostByTool {
  toolType: string;
  totalInteractions: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgDurationMs: number;
  avgInputCost: number;
  avgOutputCost: number;
  avgTotalCost: number;
  totalInputCost: number;
  totalOutputCost: number;
  totalCost: number;
}

export interface AICostAnalyticsResponse {
  timeframe: string;
  period: {
    startDate: string;
    endDate: string;
  };
  pricing: {
    model: string;
    inputPer1M: number;
    outputPer1M: number;
    currency: string;
  };
  overall: {
    totalInteractions: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    avgInputTokens: number;
    avgOutputTokens: number;
    avgTotalTokens: number;
    avgDurationMs: number;
    totalInputCost: number;
    totalOutputCost: number;
    totalCost: number;
    avgCostPerInteraction: number;
  };
  byToolType: AICostByTool[];
}
