import { Hono } from 'hono';
import type { Bindings } from '../types';
import { isValidWalletAddress, validateAnalyticsParams } from '../utils/validation';
import { AnalyticsQueries } from '../utils/queries';

export const analyticsRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/v1/analytics/user/:walletAddress
 * Get analytics for a specific user
 */
analyticsRoutes.get('/user/:walletAddress', async (c) => {
  try {
    const walletAddress = c.req.param('walletAddress');

    // Validate wallet address
    if (!isValidWalletAddress(walletAddress)) {
      return c.json(
        {
          success: false,
          error: 'Invalid wallet address format',
          code: 'INVALID_WALLET',
        },
        400
      );
    }

    const queries = new AnalyticsQueries(c.env.DB);
    const analytics = await queries.getUserAnalytics(walletAddress);

    return c.json(analytics);
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch analytics',
        message: c.env.ENVIRONMENT === 'development' ? (error as Error).message : undefined,
      },
      500
    );
  }
});

/**
 * GET /api/v1/analytics/summary
 * Get platform-wide analytics summary
 * Query params: ?timeframe=30d (optional: 7d, 30d, 90d, all)
 */
analyticsRoutes.get('/summary', async (c) => {
  try {
    const timeframe = c.req.query('timeframe');

    // Validate and parse timeframe
    let timeframeDays: number | null = 30; // default
    if (timeframe) {
      const validation = validateAnalyticsParams({ timeframe });
      if (!validation.valid) {
        return c.json(
          {
            success: false,
            error: validation.error,
            code: 'INVALID_PARAMS',
          },
          400
        );
      }
      // validation.timeframeDays will be null for "all", or a number for specific days
      timeframeDays = validation.timeframeDays !== undefined ? validation.timeframeDays : 30;
    }

    const queries = new AnalyticsQueries(c.env.DB);
    const summary = await queries.getAnalyticsSummary(timeframeDays);

    return c.json(summary);
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch analytics summary',
        message: c.env.ENVIRONMENT === 'development' ? (error as Error).message : undefined,
      },
      500
    );
  }
});

/**
 * GET /api/v1/analytics/text-feedback
 * Get detailed text feedback and ratings from users
 * Query params: ?limit=50&timeframe=30d
 */
analyticsRoutes.get('/text-feedback', async (c) => {
  try {
    const limit = c.req.query('limit');
    const timeframe = c.req.query('timeframe');

    // Validate query parameters
    const validation = validateAnalyticsParams({ limit, timeframe });
    if (!validation.valid) {
      return c.json(
        {
          success: false,
          error: validation.error,
          code: 'INVALID_PARAMS',
        },
        400
      );
    }

    const queries = new AnalyticsQueries(c.env.DB);
    const textFeedback = await queries.getTextFeedback(
      validation.limit || 50,
      validation.timeframeDays !== undefined ? validation.timeframeDays : 30
    );

    return c.json(textFeedback);
  } catch (error) {
    console.error('Error fetching text feedback:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch text feedback',
        message: c.env.ENVIRONMENT === 'development' ? (error as Error).message : undefined,
      },
      500
    );
  }
});

/**
 * GET /api/v1/analytics/module-feedback
 * Get module completion survey feedback with text comments
 * Query params: ?limit=50&timeframe=30d
 */
analyticsRoutes.get('/module-feedback', async (c) => {
  try {
    const limit = c.req.query('limit');
    const timeframe = c.req.query('timeframe');

    // Validate query parameters
    const validation = validateAnalyticsParams({ limit, timeframe });
    if (!validation.valid) {
      return c.json(
        {
          success: false,
          error: validation.error,
          code: 'INVALID_PARAMS',
        },
        400
      );
    }

    const queries = new AnalyticsQueries(c.env.DB);
    const moduleFeedback = await queries.getModuleFeedback(
      validation.limit || 50,
      validation.timeframeDays !== undefined ? validation.timeframeDays : 30
    );

    return c.json(moduleFeedback);
  } catch (error) {
    console.error('Error fetching module feedback:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch module feedback',
        message: c.env.ENVIRONMENT === 'development' ? (error as Error).message : undefined,
      },
      500
    );
  }
});

/**
 * GET /api/v1/analytics/leaderboard
 * Get top learners (for gamification)
 * Query params: ?limit=10&timeframe=30d
 */
analyticsRoutes.get('/leaderboard', async (c) => {
  try {
    const limit = c.req.query('limit');
    const timeframe = c.req.query('timeframe');

    // Validate query parameters
    const validation = validateAnalyticsParams({ limit, timeframe });
    if (!validation.valid) {
      return c.json(
        {
          success: false,
          error: validation.error,
          code: 'INVALID_PARAMS',
        },
        400
      );
    }

    const queries = new AnalyticsQueries(c.env.DB);
    const leaderboard = await queries.getLeaderboard(
      validation.limit || 10,
      validation.timeframeDays !== undefined ? validation.timeframeDays : 30
    );

    return c.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch leaderboard',
        message: c.env.ENVIRONMENT === 'development' ? (error as Error).message : undefined,
      },
      500
    );
  }
});

/**
 * GET /api/v1/analytics/ai-costs
 * Get AI tool cost analytics with token usage and cost breakdowns
 * Query params: ?timeframe=7d (optional: 1d, 7d, 30d, 90d - defaults to 7d)
 * Pricing: openai/gpt-oss-120b - $0.25 per 1M input tokens, $0.69 per 1M output tokens
 */
analyticsRoutes.get('/ai-costs', async (c) => {
  try {
    const timeframe = c.req.query('timeframe') || '7d';

    // Validate timeframe
    const validation = validateAnalyticsParams({ timeframe });
    if (!validation.valid) {
      return c.json(
        {
          success: false,
          error: validation.error,
          code: 'INVALID_PARAMS',
        },
        400
      );
    }

    // Default to 7 days if timeframeDays is null or undefined
    const timeframeDays = validation.timeframeDays !== undefined && validation.timeframeDays !== null 
      ? validation.timeframeDays 
      : 7;

    const queries = new AnalyticsQueries(c.env.DB);
    const costAnalytics = await queries.getAICostAnalytics(timeframeDays);

    return c.json(costAnalytics);
  } catch (error) {
    console.error('Error fetching AI cost analytics:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch AI cost analytics',
        message: c.env.ENVIRONMENT === 'development' ? (error as Error).message : undefined,
      },
      500
    );
  }
});

