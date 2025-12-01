import { Hono } from 'hono';
import type { Bindings, AIInteraction, AIFeedback, ModuleFeedback, GeneralFeedbackRequest } from '../types';
import { 
  validateAIInteractionRequest,
  validateAIFeedbackRequest,
  validateModuleFeedbackRequest,
  validateGeneralFeedbackRequest
} from '../utils/validation';
import { AnalyticsQueries } from '../utils/queries';

export const feedbackRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/v1/feedback/ai-interaction
 * Store AI interaction tracking data
 */
feedbackRoutes.post('/ai-interaction', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate request
    const validation = validateAIInteractionRequest(body);
    if (!validation.valid) {
      return c.json(
        {
          success: false,
          error: validation.error,
          code: validation.error?.includes('wallet') ? 'INVALID_WALLET' : 'INVALID_REQUEST'
        },
        400
      );
    }

    const data = validation.data!;
    const queries = new AnalyticsQueries(c.env.DB);

    // Create interaction record
    const interaction: AIInteraction = {
      id: data.id,
      wallet_address: data.walletAddress,
      tool_type: data.toolType,
      input_length: data.inputLength,
      output_length: data.outputLength,
      model_used: data.modelUsed,
      duration_ms: data.durationMs,
      vulnerabilities_found: data.vulnerabilitiesFound,
      query_category: data.queryCategory,
      current_module: data.currentModule,
      session_id: data.sessionId,
    };

    await queries.createAIInteraction(interaction);

    return c.json({
      success: true,
      interactionId: data.id,
    });
  } catch (error) {
    console.error('Error storing AI interaction:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to store interaction data',
        message: c.env.ENVIRONMENT === 'development' ? (error as Error).message : undefined,
      },
      500
    );
  }
});

/**
 * POST /api/v1/feedback/ai-response
 * Submit feedback on AI response (thumbs up/down, rating, text)
 */
feedbackRoutes.post('/ai-response', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate request
    const validation = validateAIFeedbackRequest(body);
    if (!validation.valid) {
      return c.json(
        {
          success: false,
          error: validation.error,
          code: validation.code,
        },
        400
      );
    }

    const data = validation.data!;
    const queries = new AnalyticsQueries(c.env.DB);

    // Check if interaction exists
    const interactionExists = await queries.interactionExists(data.interactionId);
    if (!interactionExists) {
      return c.json(
        {
          success: false,
          error: 'Interaction not found',
          code: 'INTERACTION_NOT_FOUND',
        },
        404
      );
    }

    // Create feedback record
    const feedback: AIFeedback = {
      interaction_id: data.interactionId,
      wallet_address: data.walletAddress,
      tool_type: data.toolType,
      feedback_type: data.feedbackType,
      feedback_value: data.feedbackValue,
      response_quality_rating: data.qualityRating,
    };

    const feedbackId = await queries.createAIFeedback(feedback);

    return c.json({
      success: true,
      feedbackId,
    });
  } catch (error) {
    console.error('Error storing AI feedback:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to store feedback',
        message: c.env.ENVIRONMENT === 'development' ? (error as Error).message : undefined,
      },
      500
    );
  }
});

/**
 * POST /api/v1/feedback/module-completion
 * Submit module completion feedback
 */
feedbackRoutes.post('/module-completion', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate request
    const validation = validateModuleFeedbackRequest(body);
    if (!validation.valid) {
      return c.json(
        {
          success: false,
          error: validation.error,
          code: validation.code,
        },
        400
      );
    }

    const data = validation.data!;
    const queries = new AnalyticsQueries(c.env.DB);

    // Create module feedback record
    const feedback: ModuleFeedback = {
      wallet_address: data.walletAddress,
      module_slug: data.moduleSlug,
      achievement_codes: data.achievementCodes ? JSON.stringify(data.achievementCodes) : undefined,
      content_difficulty: data.contentDifficulty,
      content_clarity: data.contentClarity,
      practical_value: data.practicalValue,
      pace_appropriateness: data.paceAppropriateness,
      what_worked_well: data.whatWorkedWell,
      suggestions_for_improvement: data.suggestionsForImprovement,
      additional_topics_wanted: data.additionalTopicsWanted,
      time_spent_minutes: data.timeSpentMinutes,
      external_resources_used: data.externalResourcesUsed,
      ai_tools_helpful: data.aiToolsHelpful,
    };

    const feedbackId = await queries.createModuleFeedback(feedback);

    return c.json({
      success: true,
      feedbackId,
    });
  } catch (error) {
    console.error('Error storing module feedback:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to store module feedback',
        message: c.env.ENVIRONMENT === 'development' ? (error as Error).message : undefined,
      },
      500
    );
  }
});

/**
 * POST /api/v1/feedback/general
 * Submit general platform feedback (bugs, feature requests, UI feedback, etc.)
 * Uses module_feedback table with module_slug pattern "general::{category}"
 */
feedbackRoutes.post('/general', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate request
    const validation = validateGeneralFeedbackRequest(body);
    if (!validation.valid) {
      return c.json(
        {
          success: false,
          error: validation.error,
          code: validation.code,
        },
        400
      );
    }

    const data = validation.data!;
    const queries = new AnalyticsQueries(c.env.DB);

    // Map general feedback to module_feedback table structure
    // Using "general::{category}" as module_slug to distinguish from actual module feedback
    const feedback: ModuleFeedback = {
      wallet_address: data.walletAddress,
      module_slug: `general::${data.category}`,
      // Store title in what_worked_well (repurposed)
      what_worked_well: data.title,
      // Store main feedback in suggestions_for_improvement
      suggestions_for_improvement: data.feedback,
      // Store metadata (pageUrl + custom metadata) as JSON in additional_topics_wanted
      additional_topics_wanted: data.pageUrl || data.metadata 
        ? JSON.stringify({ pageUrl: data.pageUrl, ...data.metadata })
        : undefined,
      // Store rating in content_clarity (repurposed as satisfaction rating)
      content_clarity: data.rating,
    };

    const feedbackId = await queries.createModuleFeedback(feedback);

    return c.json({
      success: true,
      feedbackId,
    });
  } catch (error) {
    console.error('Error storing general feedback:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to store feedback',
        message: c.env.ENVIRONMENT === 'development' ? (error as Error).message : undefined,
      },
      500
    );
  }
});

