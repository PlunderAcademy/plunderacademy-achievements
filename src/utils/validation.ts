import type { 
  AIInteractionRequest, 
  AIFeedbackRequest, 
  ModuleFeedbackRequest,
  GeneralFeedbackRequest
} from '../types';

/**
 * Validates a wallet address format
 * Must be 42 characters, start with 0x
 */
export function isValidWalletAddress(address: string): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates a UUID v4 format
 */
export function isValidUUID(id: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validates a rating value (1-5 scale)
 */
export function isValidRating(rating: number | undefined): boolean {
  if (rating === undefined) return true; // Optional
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

/**
 * Validates tool type
 */
export function isValidToolType(toolType: string): boolean {
  return toolType === 'auditor' || toolType === 'chat';
}

/**
 * Validates feedback type
 */
export function isValidFeedbackType(feedbackType: string): boolean {
  return ['thumbs_up', 'thumbs_down', 'rating', 'text'].includes(feedbackType);
}

/**
 * Sanitizes text input to prevent injection attacks
 */
export function sanitizeText(text: string | undefined, maxLength: number = 5000): string | undefined {
  if (!text) return undefined;
  
  // Trim and limit length
  let sanitized = text.trim().substring(0, maxLength);
  
  // Remove any control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

/**
 * Validates AI interaction request
 */
export function validateAIInteractionRequest(data: any): { valid: boolean; error?: string; data?: AIInteractionRequest } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { id, walletAddress, toolType } = data;

  // Required fields
  if (!id || !isValidUUID(id)) {
    return { valid: false, error: 'Invalid or missing interaction ID (must be UUID v4)', code: 'INVALID_ID' };
  }

  if (!walletAddress || !isValidWalletAddress(walletAddress)) {
    return { valid: false, error: 'Invalid wallet address format', code: 'INVALID_WALLET' };
  }

  if (!toolType || !isValidToolType(toolType)) {
    return { valid: false, error: 'Invalid tool type (must be "auditor" or "chat")', code: 'INVALID_TOOL_TYPE' };
  }

  // Optional numeric fields validation
  const numericFields = ['inputLength', 'outputLength', 'durationMs', 'vulnerabilitiesFound', 'timeSpentMinutes'];
  for (const field of numericFields) {
    if (data[field] !== undefined && (!Number.isInteger(data[field]) || data[field] < 0)) {
      return { valid: false, error: `Invalid ${field} (must be non-negative integer)` };
    }
  }

  // Optional string fields - sanitize
  const textFields = ['modelUsed', 'queryCategory', 'currentModule', 'sessionId'];
  const sanitized: any = { ...data };
  for (const field of textFields) {
    if (data[field]) {
      sanitized[field] = sanitizeText(data[field], 200);
    }
  }

  return { 
    valid: true, 
    data: sanitized as AIInteractionRequest 
  };
}

/**
 * Validates AI feedback request
 */
export function validateAIFeedbackRequest(data: any): { valid: boolean; error?: string; code?: string; data?: AIFeedbackRequest } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { interactionId, walletAddress, toolType, feedbackType, feedbackValue, qualityRating } = data;

  // Required fields
  if (!interactionId || !isValidUUID(interactionId)) {
    return { valid: false, error: 'Invalid or missing interaction ID', code: 'INVALID_INTERACTION_ID' };
  }

  if (!walletAddress || !isValidWalletAddress(walletAddress)) {
    return { valid: false, error: 'Invalid wallet address format', code: 'INVALID_WALLET' };
  }

  if (!toolType || !isValidToolType(toolType)) {
    return { valid: false, error: 'Invalid tool type', code: 'INVALID_TOOL_TYPE' };
  }

  if (!feedbackType || !isValidFeedbackType(feedbackType)) {
    return { valid: false, error: 'Invalid feedback type', code: 'INVALID_FEEDBACK_TYPE' };
  }

  if (!feedbackValue || typeof feedbackValue !== 'string') {
    return { valid: false, error: 'Missing feedback value', code: 'MISSING_FEEDBACK_VALUE' };
  }

  // Validate quality rating if provided
  if (qualityRating !== undefined && !isValidRating(qualityRating)) {
    return { valid: false, error: 'Invalid quality rating (must be 1-5)', code: 'INVALID_RATING' };
  }

  // Sanitize feedback value
  const sanitized = {
    ...data,
    feedbackValue: sanitizeText(feedbackValue, 2000)
  };

  return { 
    valid: true, 
    data: sanitized as AIFeedbackRequest 
  };
}

/**
 * Validates module feedback request
 */
export function validateModuleFeedbackRequest(data: any): { valid: boolean; error?: string; code?: string; data?: ModuleFeedbackRequest } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { 
    walletAddress, 
    moduleSlug,
    contentDifficulty,
    contentClarity,
    practicalValue,
    paceAppropriateness,
    timeSpentMinutes
  } = data;

  // Required fields
  if (!walletAddress || !isValidWalletAddress(walletAddress)) {
    return { valid: false, error: 'Invalid wallet address format', code: 'INVALID_WALLET' };
  }

  if (!moduleSlug || typeof moduleSlug !== 'string' || moduleSlug.length === 0) {
    return { valid: false, error: 'Missing or invalid module slug', code: 'INVALID_MODULE_SLUG' };
  }

  // Validate ratings
  const ratings = { contentDifficulty, contentClarity, practicalValue, paceAppropriateness };
  for (const [key, value] of Object.entries(ratings)) {
    if (value !== undefined && !isValidRating(value)) {
      return { valid: false, error: `Invalid ${key} rating (must be 1-5)`, code: 'INVALID_RATING' };
    }
  }

  // Validate time spent
  if (timeSpentMinutes !== undefined && (!Number.isInteger(timeSpentMinutes) || timeSpentMinutes < 0)) {
    return { valid: false, error: 'Invalid time spent (must be non-negative integer)', code: 'INVALID_TIME' };
  }

  // Validate achievement codes if provided
  if (data.achievementCodes !== undefined) {
    if (!Array.isArray(data.achievementCodes)) {
      return { valid: false, error: 'Achievement codes must be an array', code: 'INVALID_ACHIEVEMENTS' };
    }
    // Validate each code is a string
    for (const code of data.achievementCodes) {
      if (typeof code !== 'string') {
        return { valid: false, error: 'Achievement codes must be strings', code: 'INVALID_ACHIEVEMENTS' };
      }
    }
  }

  // Sanitize text fields
  const sanitized: any = { ...data };
  const textFields = ['whatWorkedWell', 'suggestionsForImprovement', 'additionalTopicsWanted'];
  for (const field of textFields) {
    if (data[field]) {
      sanitized[field] = sanitizeText(data[field], 5000);
    }
  }

  return { 
    valid: true, 
    data: sanitized as ModuleFeedbackRequest 
  };
}

/**
 * Valid general feedback categories
 */
const GENERAL_FEEDBACK_CATEGORIES = ['bug', 'feature-request', 'ui', 'content', 'other'] as const;

/**
 * Validates general feedback request
 */
export function validateGeneralFeedbackRequest(data: any): { valid: boolean; error?: string; code?: string; data?: GeneralFeedbackRequest } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { walletAddress, category, feedback, title, rating, pageUrl, metadata } = data;

  // Required fields
  if (!walletAddress || !isValidWalletAddress(walletAddress)) {
    return { valid: false, error: 'Invalid wallet address format', code: 'INVALID_WALLET' };
  }

  if (!category || !GENERAL_FEEDBACK_CATEGORIES.includes(category)) {
    return { 
      valid: false, 
      error: `Invalid category (must be one of: ${GENERAL_FEEDBACK_CATEGORIES.join(', ')})`, 
      code: 'INVALID_CATEGORY' 
    };
  }

  if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
    return { valid: false, error: 'Feedback text is required', code: 'MISSING_FEEDBACK' };
  }

  if (feedback.length > 5000) {
    return { valid: false, error: 'Feedback text too long (max 5000 characters)', code: 'FEEDBACK_TOO_LONG' };
  }

  // Optional fields validation
  if (title !== undefined && (typeof title !== 'string' || title.length > 200)) {
    return { valid: false, error: 'Invalid title (max 200 characters)', code: 'INVALID_TITLE' };
  }

  if (rating !== undefined && !isValidRating(rating)) {
    return { valid: false, error: 'Invalid rating (must be 1-5)', code: 'INVALID_RATING' };
  }

  if (pageUrl !== undefined && (typeof pageUrl !== 'string' || pageUrl.length > 500)) {
    return { valid: false, error: 'Invalid page URL (max 500 characters)', code: 'INVALID_URL' };
  }

  if (metadata !== undefined && (typeof metadata !== 'object' || Array.isArray(metadata))) {
    return { valid: false, error: 'Metadata must be an object', code: 'INVALID_METADATA' };
  }

  // Sanitize text fields
  const sanitized: GeneralFeedbackRequest = {
    walletAddress,
    category,
    feedback: sanitizeText(feedback, 5000)!,
    title: title ? sanitizeText(title, 200) : undefined,
    rating,
    pageUrl: pageUrl ? sanitizeText(pageUrl, 500) : undefined,
    metadata
  };

  return { valid: true, data: sanitized };
}

/**
 * Validates query parameters for analytics endpoints
 */
export function validateAnalyticsParams(params: {
  limit?: string;
  timeframe?: string;
}): { valid: boolean; error?: string; limit?: number; timeframeDays?: number | null } {
  const result: any = { valid: true };

  // Validate limit
  if (params.limit !== undefined) {
    const limit = parseInt(params.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return { valid: false, error: 'Invalid limit (must be 1-100)' };
    }
    result.limit = limit;
  }

  // Validate timeframe (format: "30d", "7d", or "all")
  if (params.timeframe !== undefined) {
    // Special case: "all" means no time restriction
    if (params.timeframe === 'all') {
      result.timeframeDays = null; // null indicates all time
      return result;
    }
    
    const match = params.timeframe.match(/^(\d+)d$/);
    if (!match) {
      return { valid: false, error: 'Invalid timeframe format (use "30d", "7d", or "all")' };
    }
    const days = parseInt(match[1], 10);
    if (days < 1 || days > 365) {
      return { valid: false, error: 'Invalid timeframe (must be 1-365 days or "all")' };
    }
    result.timeframeDays = days;
  }

  return result;
}

