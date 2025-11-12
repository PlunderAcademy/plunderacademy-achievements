import type {
  AIInteraction,
  AIFeedback,
  ModuleFeedback,
  UserAnalyticsResponse,
  AnalyticsSummaryResponse,
  LeaderboardResponse,
  AICostAnalyticsResponse,
  AICostByTool,
  TextFeedbackResponse,
  ModuleFeedbackResponse,
} from '../types';

/**
 * Query helpers for feedback and analytics data
 */
export class AnalyticsQueries {
  constructor(private db: D1Database) {}

  /**
   * Store AI interaction data
   */
  async createAIInteraction(interaction: AIInteraction): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO ai_interactions (
          id, wallet_address, tool_type, input_length, output_length, 
          model_used, duration_ms, vulnerabilities_found, query_category,
          current_module, session_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(
        interaction.id,
        interaction.wallet_address,
        interaction.tool_type,
        interaction.input_length || null,
        interaction.output_length || null,
        interaction.model_used || null,
        interaction.duration_ms || null,
        interaction.vulnerabilities_found || null,
        interaction.query_category || null,
        interaction.current_module || null,
        interaction.session_id || null
      )
      .run();
  }

  /**
   * Store AI feedback data
   */
  async createAIFeedback(feedback: AIFeedback): Promise<number> {
    const result = await this.db
      .prepare(`
        INSERT INTO ai_feedback (
          interaction_id, wallet_address, tool_type, feedback_type,
          feedback_value, response_quality_rating, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(
        feedback.interaction_id,
        feedback.wallet_address,
        feedback.tool_type,
        feedback.feedback_type,
        feedback.feedback_value,
        feedback.response_quality_rating || null
      )
      .run();

    return result.meta.last_row_id || 0;
  }

  /**
   * Store module feedback data
   */
  async createModuleFeedback(feedback: ModuleFeedback): Promise<number> {
    const achievementCodesJson = feedback.achievement_codes ? 
      JSON.stringify(feedback.achievement_codes) : null;

    const result = await this.db
      .prepare(`
        INSERT INTO module_feedback (
          wallet_address, module_slug, achievement_codes,
          content_difficulty, content_clarity, practical_value, pace_appropriateness,
          what_worked_well, suggestions_for_improvement, additional_topics_wanted,
          time_spent_minutes, external_resources_used, ai_tools_helpful, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(
        feedback.wallet_address,
        feedback.module_slug,
        achievementCodesJson,
        feedback.content_difficulty || null,
        feedback.content_clarity || null,
        feedback.practical_value || null,
        feedback.pace_appropriateness || null,
        feedback.what_worked_well || null,
        feedback.suggestions_for_improvement || null,
        feedback.additional_topics_wanted || null,
        feedback.time_spent_minutes || null,
        feedback.external_resources_used !== undefined ? (feedback.external_resources_used ? 1 : 0) : null,
        feedback.ai_tools_helpful !== undefined ? (feedback.ai_tools_helpful ? 1 : 0) : null
      )
      .run();

    return result.meta.last_row_id || 0;
  }

  /**
   * Check if an interaction exists
   */
  async interactionExists(interactionId: string): Promise<boolean> {
    const result = await this.db
      .prepare('SELECT id FROM ai_interactions WHERE id = ? LIMIT 1')
      .bind(interactionId)
      .first<{ id: string }>();

    return !!result;
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(walletAddress: string): Promise<UserAnalyticsResponse> {
    // Get AI interaction stats
    const interactionStats = await this.db
      .prepare(`
        SELECT 
          COUNT(ai.id) as total_interactions,
          COUNT(CASE WHEN ai.tool_type = 'auditor' THEN 1 END) as auditor_usage,
          COUNT(CASE WHEN ai.tool_type = 'chat' THEN 1 END) as chat_usage,
          AVG(CASE WHEN ai.tool_type = 'auditor' THEN ai.vulnerabilities_found END) as avg_vulnerabilities,
          COUNT(CASE WHEN af.feedback_type = 'thumbs_up' THEN 1 END) as positive_feedback,
          COUNT(CASE WHEN af.feedback_type = 'thumbs_down' THEN 1 END) as negative_feedback,
          AVG(af.response_quality_rating) as avg_quality_rating
        FROM ai_interactions ai
        LEFT JOIN ai_feedback af ON ai.id = af.interaction_id
        WHERE ai.wallet_address = ?
      `)
      .bind(walletAddress)
      .first<{
        total_interactions: number;
        auditor_usage: number;
        chat_usage: number;
        avg_vulnerabilities: number;
        positive_feedback: number;
        negative_feedback: number;
        avg_quality_rating: number;
      }>();

    // Get module feedback stats
    const moduleStats = await this.db
      .prepare(`
        SELECT 
          COUNT(*) as modules_completed,
          AVG(content_difficulty) as avg_difficulty,
          AVG(practical_value) as avg_value,
          COUNT(CASE WHEN ai_tools_helpful = 1 THEN 1 END) * 1.0 / NULLIF(COUNT(*), 0) as ai_helpful_rate
        FROM module_feedback
        WHERE wallet_address = ?
      `)
      .bind(walletAddress)
      .first<{
        modules_completed: number;
        avg_difficulty: number;
        avg_value: number;
        ai_helpful_rate: number;
      }>();

    // Get recent interactions (last 10)
    const recentInteractions = await this.db
      .prepare(`
        SELECT 
          ai.id,
          ai.tool_type,
          ai.created_at,
          af.feedback_type
        FROM ai_interactions ai
        LEFT JOIN ai_feedback af ON ai.id = af.interaction_id
        WHERE ai.wallet_address = ?
        ORDER BY ai.created_at DESC
        LIMIT 10
      `)
      .bind(walletAddress)
      .all<{
        id: string;
        tool_type: string;
        created_at: string;
        feedback_type?: string;
      }>();

    // Get module progress
    const moduleProgress = await this.db
      .prepare(`
        SELECT 
          module_slug,
          created_at,
          (COALESCE(content_difficulty, 0) + COALESCE(content_clarity, 0) + 
           COALESCE(practical_value, 0) + COALESCE(pace_appropriateness, 0)) / 
          NULLIF((CASE WHEN content_difficulty IS NOT NULL THEN 1 ELSE 0 END +
                  CASE WHEN content_clarity IS NOT NULL THEN 1 ELSE 0 END +
                  CASE WHEN practical_value IS NOT NULL THEN 1 ELSE 0 END +
                  CASE WHEN pace_appropriateness IS NOT NULL THEN 1 ELSE 0 END), 0) as avg_rating
        FROM module_feedback
        WHERE wallet_address = ?
        ORDER BY created_at DESC
      `)
      .bind(walletAddress)
      .all<{
        module_slug: string;
        created_at: string;
        avg_rating: number;
      }>();

    return {
      walletAddress,
      stats: {
        totalAIInteractions: interactionStats?.total_interactions || 0,
        auditorUsage: interactionStats?.auditor_usage || 0,
        chatUsage: interactionStats?.chat_usage || 0,
        avgVulnerabilitiesPerScan: interactionStats?.avg_vulnerabilities || 0,
        positiveFeedback: interactionStats?.positive_feedback || 0,
        negativeFeedback: interactionStats?.negative_feedback || 0,
        avgQualityRating: interactionStats?.avg_quality_rating || 0,
        modulesCompleted: moduleStats?.modules_completed || 0,
        avgModuleDifficulty: moduleStats?.avg_difficulty || 0,
        avgModuleValue: moduleStats?.avg_value || 0,
        aiToolsHelpfulRate: moduleStats?.ai_helpful_rate || 0,
      },
      recentInteractions: (recentInteractions.results || []).map(r => ({
        id: r.id,
        toolType: r.tool_type,
        createdAt: r.created_at,
        feedback: r.feedback_type,
      })),
      moduleProgress: (moduleProgress.results || []).map(m => ({
        moduleSlug: m.module_slug,
        completedAt: m.created_at,
        avgRating: m.avg_rating || 0,
      })),
    };
  }

  /**
   * Get platform-wide analytics summary
   */
  async getAnalyticsSummary(timeframeDays: number | null = 30): Promise<AnalyticsSummaryResponse> {
    // If timeframeDays is null, means "all time" - no date restriction
    const cutoffDate = timeframeDays === null ? `datetime('1970-01-01')` : `datetime('now', '-${timeframeDays} days')`;

    // Platform overview stats
    const platformStats = await this.db
      .prepare(`
        SELECT 
          COUNT(DISTINCT ai.wallet_address) as total_users,
          COUNT(ai.id) as total_interactions,
          AVG(ai.duration_ms) as avg_duration
        FROM ai_interactions ai
        WHERE ai.created_at >= ${cutoffDate}
      `)
      .first<{
        total_users: number;
        total_interactions: number;
        avg_duration: number;
      }>();

    // Total feedback submissions
    const feedbackCount = await this.db
      .prepare(`
        SELECT COUNT(*) as total_feedback
        FROM ai_feedback
        WHERE created_at >= ${cutoffDate}
      `)
      .first<{ total_feedback: number }>();

    // Total modules completed
    const moduleCount = await this.db
      .prepare(`
        SELECT COUNT(*) as total_modules
        FROM module_feedback
        WHERE created_at >= ${cutoffDate}
      `)
      .first<{ total_modules: number }>();

    // Tool-specific breakdown
    const toolStats = await this.db
      .prepare(`
        SELECT 
          tool_type,
          COUNT(*) as usage_count,
          AVG(duration_ms) as avg_duration,
          COUNT(DISTINCT wallet_address) as unique_users
        FROM ai_interactions
        WHERE created_at >= ${cutoffDate}
        GROUP BY tool_type
      `)
      .all<{
        tool_type: string;
        usage_count: number;
        avg_duration: number;
        unique_users: number;
      }>();

    // Feedback summary by tool
    const feedbackByTool = await this.db
      .prepare(`
        SELECT 
          af.tool_type,
          COUNT(CASE WHEN af.feedback_type = 'thumbs_up' THEN 1 END) as positive,
          COUNT(CASE WHEN af.feedback_type = 'thumbs_down' THEN 1 END) as negative,
          AVG(af.response_quality_rating) as avg_rating
        FROM ai_feedback af
        WHERE af.created_at >= ${cutoffDate}
        GROUP BY af.tool_type
      `)
      .all<{
        tool_type: string;
        positive: number;
        negative: number;
        avg_rating: number;
      }>();

    // Query category breakdown
    const queryCategories = await this.db
      .prepare(`
        SELECT 
          ai.query_category as category,
          COUNT(*) as count,
          AVG(ai.duration_ms) as avg_duration,
          COUNT(CASE WHEN af.feedback_type = 'thumbs_up' THEN 1 END) * 1.0 / 
            NULLIF(COUNT(af.feedback_type), 0) as satisfaction_rate
        FROM ai_interactions ai
        LEFT JOIN ai_feedback af ON ai.id = af.interaction_id
        WHERE ai.tool_type = 'chat'
          AND ai.created_at >= ${cutoffDate}
          AND ai.query_category IS NOT NULL
        GROUP BY ai.query_category
        ORDER BY count DESC
      `)
      .all<{
        category: string;
        count: number;
        avg_duration: number;
        satisfaction_rate: number;
      }>();

    // Module stats
    const moduleStats = await this.db
      .prepare(`
        SELECT 
          module_slug,
          COUNT(*) as completions,
          AVG(content_difficulty) as avg_difficulty,
          AVG(content_clarity) as avg_clarity,
          AVG(practical_value) as avg_value,
          AVG(pace_appropriateness) as avg_pace,
          AVG(time_spent_minutes) as avg_time_spent,
          COUNT(CASE WHEN ai_tools_helpful = 1 THEN 1 END) * 1.0 / NULLIF(COUNT(*), 0) as ai_helpful_rate
        FROM module_feedback
        WHERE created_at >= ${cutoffDate}
        GROUP BY module_slug
        ORDER BY completions DESC
      `)
      .all<{
        module_slug: string;
        completions: number;
        avg_difficulty: number;
        avg_clarity: number;
        avg_value: number;
        avg_pace: number;
        avg_time_spent: number;
        ai_helpful_rate: number;
      }>();

    // Time series data (daily aggregation)
    const timeSeries = await this.db
      .prepare(`
        SELECT 
          DATE(ai.created_at) as date,
          COUNT(*) as interactions,
          COUNT(CASE WHEN af.feedback_type = 'thumbs_up' THEN 1 END) as positive_feedback,
          COUNT(CASE WHEN af.feedback_type = 'thumbs_down' THEN 1 END) as negative_feedback
        FROM ai_interactions ai
        LEFT JOIN ai_feedback af ON ai.id = af.interaction_id
        WHERE ai.created_at >= ${cutoffDate}
        GROUP BY DATE(ai.created_at)
        ORDER BY date DESC
        LIMIT 30
      `)
      .all<{
        date: string;
        interactions: number;
        positive_feedback: number;
        negative_feedback: number;
      }>();

    // Recent activity across platform (only show first thumbs feedback per interaction)
    const recentActivity = await this.db
      .prepare(`
        SELECT DISTINCT
          ai.id,
          ai.wallet_address,
          ai.tool_type,
          ai.created_at,
          (
            SELECT af_sub.feedback_type 
            FROM ai_feedback af_sub 
            WHERE af_sub.interaction_id = ai.id 
              AND af_sub.feedback_type IN ('thumbs_up', 'thumbs_down')
            ORDER BY af_sub.created_at ASC 
            LIMIT 1
          ) as feedback
        FROM ai_interactions ai
        ORDER BY ai.created_at DESC
        LIMIT 50
      `)
      .all<{
        id: string;
        wallet_address: string;
        tool_type: string;
        created_at: string;
        feedback?: string;
      }>();

    // Process tool stats
    const auditorStats = toolStats.results?.find(t => t.tool_type === 'auditor');
    const chatStats = toolStats.results?.find(t => t.tool_type === 'chat');
    const auditorFeedback = feedbackByTool.results?.find(f => f.tool_type === 'auditor');
    const chatFeedback = feedbackByTool.results?.find(f => f.tool_type === 'chat');

    // Calculate average satisfaction (from ratings)
    const avgSatisfaction = ((auditorFeedback?.avg_rating || 0) + (chatFeedback?.avg_rating || 0)) / 2;

    return {
      platform: {
        totalUsers: platformStats?.total_users || 0,
        totalInteractions: platformStats?.total_interactions || 0,
        totalFeedbackSubmissions: feedbackCount?.total_feedback || 0,
        averageSatisfaction: avgSatisfaction / 5, // Convert to 0-1 scale
        auditorSatisfaction: auditorFeedback?.avg_rating || 0,
        chatSatisfaction: chatFeedback?.avg_rating || 0,
        totalModulesCompleted: moduleCount?.total_modules || 0,
        avgInteractionsPerUser: platformStats?.total_users 
          ? (platformStats.total_interactions / platformStats.total_users) 
          : 0,
        avgModulesPerUser: platformStats?.total_users 
          ? ((moduleCount?.total_modules || 0) / platformStats.total_users) 
          : 0,
      },
      tools: {
        auditorUsage: auditorStats?.usage_count || 0,
        chatUsage: chatStats?.usage_count || 0,
        auditorAvgDuration: Math.round(auditorStats?.avg_duration || 0),
        chatAvgDuration: Math.round(chatStats?.avg_duration || 0),
        auditorPositiveFeedback: auditorFeedback?.positive || 0,
        auditorNegativeFeedback: auditorFeedback?.negative || 0,
        chatPositiveFeedback: chatFeedback?.positive || 0,
        chatNegativeFeedback: chatFeedback?.negative || 0,
      },
      modules: (moduleStats.results || []).map(m => ({
        moduleSlug: m.module_slug,
        completions: m.completions,
        avgDifficulty: Math.round((m.avg_difficulty || 0) * 10) / 10,
        avgClarity: Math.round((m.avg_clarity || 0) * 10) / 10,
        avgValue: Math.round((m.avg_value || 0) * 10) / 10,
        avgPace: Math.round((m.avg_pace || 0) * 10) / 10,
        avgTimeSpent: Math.round((m.avg_time_spent || 0) * 10) / 10,
        aiToolsHelpfulRate: Math.round((m.ai_helpful_rate || 0) * 100) / 100,
      })),
      queryCategories: (queryCategories.results || []).map(q => ({
        category: q.category,
        count: q.count,
        avgDuration: Math.round(q.avg_duration || 0),
        satisfactionRate: Math.round((q.satisfaction_rate || 0) * 100) / 100,
      })),
      timeSeries: (timeSeries.results || []).map(t => ({
        date: t.date,
        interactions: t.interactions,
        positiveFeedback: t.positive_feedback,
        negativeFeedback: t.negative_feedback,
      })),
      recentActivity: (recentActivity.results || []).map(a => ({
        id: a.id,
        walletAddress: a.wallet_address,
        toolType: a.tool_type,
        createdAt: a.created_at,
        feedback: a.feedback,
      })),
    };
  }

  /**
   * Get detailed text feedback
   */
  async getTextFeedback(limit: number = 50, timeframeDays: number | null = 30): Promise<TextFeedbackResponse> {
    const cutoffDate = timeframeDays === null 
      ? new Date('1970-01-01')
      : (() => {
          const date = new Date();
          date.setDate(date.getDate() - timeframeDays);
          return date;
        })();

    const feedback = await this.db
      .prepare(`
        SELECT DISTINCT
          af.id,
          af.interaction_id,
          af.wallet_address,
          af.tool_type,
          af.feedback_type,
          af.feedback_value,
          af.response_quality_rating as quality_rating,
          ai.current_module as module_slug,
          af.created_at
        FROM ai_feedback af
        LEFT JOIN ai_interactions ai ON af.interaction_id = ai.id
        WHERE af.feedback_type IN ('text', 'rating')
          AND af.created_at >= datetime(?)
        ORDER BY af.created_at DESC
        LIMIT ?
      `)
      .bind(cutoffDate.toISOString(), limit)
      .all<{
        id: number;
        interaction_id: string;
        wallet_address: string;
        tool_type: string;
        feedback_type: string;
        feedback_value: string;
        quality_rating: number | null;
        module_slug: string | null;
        created_at: string;
      }>();

    return {
      timeframe: timeframeDays === null ? 'all' : `${timeframeDays}d`,
      feedback: (feedback.results || []).map(f => ({
        id: f.id,
        interactionId: f.interaction_id,
        walletAddress: f.wallet_address,
        toolType: f.tool_type,
        feedbackType: f.feedback_type,
        feedbackValue: f.feedback_value,
        qualityRating: f.quality_rating,
        moduleSlug: f.module_slug,
        createdAt: f.created_at,
      })),
    };

  }

  /**
   * Get module completion feedback with text comments
   */
  async getModuleFeedback(limit: number = 50, timeframeDays: number | null = 30): Promise<ModuleFeedbackResponse> {
    const cutoffDate = timeframeDays === null 
      ? new Date('1970-01-01')
      : (() => {
          const date = new Date();
          date.setDate(date.getDate() - timeframeDays);
          return date;
        })();

    const feedback = await this.db
      .prepare(`
        SELECT 
          id,
          wallet_address,
          module_slug,
          content_difficulty,
          content_clarity,
          practical_value,
          pace_appropriateness,
          what_worked_well,
          suggestions_for_improvement,
          additional_topics_wanted,
          time_spent_minutes,
          external_resources_used,
          ai_tools_helpful,
          created_at
        FROM module_feedback
        WHERE created_at >= datetime(?)
          AND (
            what_worked_well IS NOT NULL AND what_worked_well != ''
            OR suggestions_for_improvement IS NOT NULL AND suggestions_for_improvement != ''
            OR additional_topics_wanted IS NOT NULL AND additional_topics_wanted != ''
          )
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .bind(cutoffDate.toISOString(), limit)
      .all<{
        id: number;
        wallet_address: string;
        module_slug: string;
        content_difficulty: number | null;
        content_clarity: number | null;
        practical_value: number | null;
        pace_appropriateness: number | null;
        what_worked_well: string | null;
        suggestions_for_improvement: string | null;
        additional_topics_wanted: string | null;
        time_spent_minutes: number | null;
        external_resources_used: number | null;
        ai_tools_helpful: number | null;
        created_at: string;
      }>();

    return {
      timeframe: timeframeDays === null ? 'all' : `${timeframeDays}d`,
      feedback: (feedback.results || []).map(f => ({
        id: f.id,
        walletAddress: f.wallet_address,
        moduleSlug: f.module_slug,
        contentDifficulty: f.content_difficulty,
        contentClarity: f.content_clarity,
        practicalValue: f.practical_value,
        paceAppropriateness: f.pace_appropriateness,
        whatWorkedWell: f.what_worked_well,
        suggestionsForImprovement: f.suggestions_for_improvement,
        additionalTopicsWanted: f.additional_topics_wanted,
        timeSpentMinutes: f.time_spent_minutes,
        externalResourcesUsed: f.external_resources_used === 1 ? true : f.external_resources_used === 0 ? false : null,
        aiToolsHelpful: f.ai_tools_helpful === 1 ? true : f.ai_tools_helpful === 0 ? false : null,
        createdAt: f.created_at,
      })),
    };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit: number = 10, timeframeDays: number | null = 30): Promise<LeaderboardResponse> {
    // If timeframeDays is null, means "all time" - use epoch date
    const cutoffDate = timeframeDays === null 
      ? new Date('1970-01-01')
      : (() => {
          const date = new Date();
          date.setDate(date.getDate() - timeframeDays);
          return date;
        })();

    const leaderboard = await this.db
      .prepare(`
        SELECT 
          tc.wallet_address,
          COUNT(DISTINCT tc.achievement_number) as achievement_count,
          COUNT(DISTINCT ai.id) as ai_interactions,
          AVG(af.response_quality_rating) as avg_feedback_rating
        FROM training_completions tc
        LEFT JOIN ai_interactions ai ON tc.wallet_address = ai.wallet_address 
          AND ai.created_at >= datetime(?)
        LEFT JOIN ai_feedback af ON ai.id = af.interaction_id
        WHERE tc.passed = 1 
          AND tc.created_at >= datetime(?)
        GROUP BY tc.wallet_address
        HAVING achievement_count > 0
        ORDER BY achievement_count DESC, ai_interactions DESC
        LIMIT ?
      `)
      .bind(cutoffDate.toISOString(), cutoffDate.toISOString(), limit)
      .all<{
        wallet_address: string;
        achievement_count: number;
        ai_interactions: number;
        avg_feedback_rating: number;
      }>();

    return {
      timeframe: timeframeDays === null ? 'all' : `${timeframeDays}d`,
      topLearners: (leaderboard.results || []).map((entry, index) => ({
        walletAddress: entry.wallet_address,
        achievementCount: entry.achievement_count,
        aiInteractions: entry.ai_interactions || 0,
        avgFeedbackRating: entry.avg_feedback_rating || 0,
        rank: index + 1,
      })),
    };
  }

  /**
   * Get AI cost analytics
   * Pricing: openai/gpt-oss-120b - $0.25 per 1M input tokens, $0.69 per 1M output tokens
   */
  async getAICostAnalytics(timeframeDays: number = 7): Promise<AICostAnalyticsResponse> {
    const INPUT_COST_PER_1M = 0.25; // $0.25 per 1M input tokens
    const OUTPUT_COST_PER_1M = 0.69; // $0.69 per 1M output tokens
    const MODEL_NAME = 'openai/gpt-oss-120b';

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframeDays);

    // Get overall statistics
    const overallStats = await this.db
      .prepare(`
        SELECT 
          COUNT(*) as total_interactions,
          SUM(COALESCE(input_length, 0)) as total_input_tokens,
          SUM(COALESCE(output_length, 0)) as total_output_tokens,
          AVG(COALESCE(input_length, 0)) as avg_input_tokens,
          AVG(COALESCE(output_length, 0)) as avg_output_tokens,
          AVG(duration_ms) as avg_duration_ms
        FROM ai_interactions
        WHERE created_at >= datetime(?)
          AND created_at <= datetime(?)
      `)
      .bind(startDate.toISOString(), endDate.toISOString())
      .first<{
        total_interactions: number;
        total_input_tokens: number;
        total_output_tokens: number;
        avg_input_tokens: number;
        avg_output_tokens: number;
        avg_duration_ms: number;
      }>();

    // Get stats by tool type
    const toolStats = await this.db
      .prepare(`
        SELECT 
          tool_type,
          COUNT(*) as total_interactions,
          SUM(COALESCE(input_length, 0)) as total_input_tokens,
          SUM(COALESCE(output_length, 0)) as total_output_tokens,
          AVG(COALESCE(input_length, 0)) as avg_input_tokens,
          AVG(COALESCE(output_length, 0)) as avg_output_tokens,
          AVG(duration_ms) as avg_duration_ms
        FROM ai_interactions
        WHERE created_at >= datetime(?)
          AND created_at <= datetime(?)
        GROUP BY tool_type
        ORDER BY total_interactions DESC
      `)
      .bind(startDate.toISOString(), endDate.toISOString())
      .all<{
        tool_type: string;
        total_interactions: number;
        total_input_tokens: number;
        total_output_tokens: number;
        avg_input_tokens: number;
        avg_output_tokens: number;
        avg_duration_ms: number;
      }>();

    // Calculate costs
    const totalInputTokens = overallStats?.total_input_tokens || 0;
    const totalOutputTokens = overallStats?.total_output_tokens || 0;
    const totalTokens = totalInputTokens + totalOutputTokens;
    const totalInputCost = (totalInputTokens / 1_000_000) * INPUT_COST_PER_1M;
    const totalOutputCost = (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_1M;
    const totalCost = totalInputCost + totalOutputCost;
    const totalInteractions = overallStats?.total_interactions || 0;
    const avgCostPerInteraction = totalInteractions > 0 ? totalCost / totalInteractions : 0;

    // Process tool-specific stats
    const byToolType: AICostByTool[] = (toolStats.results || []).map(tool => {
      const inputCost = (tool.total_input_tokens / 1_000_000) * INPUT_COST_PER_1M;
      const outputCost = (tool.total_output_tokens / 1_000_000) * OUTPUT_COST_PER_1M;
      const toolTotalCost = inputCost + outputCost;
      const avgInputCost = tool.total_interactions > 0 
        ? inputCost / tool.total_interactions 
        : 0;
      const avgOutputCost = tool.total_interactions > 0 
        ? outputCost / tool.total_interactions 
        : 0;
      const avgTotalCost = tool.total_interactions > 0 
        ? toolTotalCost / tool.total_interactions 
        : 0;

      return {
        toolType: tool.tool_type,
        totalInteractions: tool.total_interactions,
        avgInputTokens: Math.round(tool.avg_input_tokens || 0),
        avgOutputTokens: Math.round(tool.avg_output_tokens || 0),
        avgDurationMs: Math.round(tool.avg_duration_ms || 0),
        avgInputCost: Math.round(avgInputCost * 1_000_000) / 1_000_000, // Round to 6 decimals
        avgOutputCost: Math.round(avgOutputCost * 1_000_000) / 1_000_000,
        avgTotalCost: Math.round(avgTotalCost * 1_000_000) / 1_000_000,
        totalInputCost: Math.round(inputCost * 100) / 100, // Round to 2 decimals
        totalOutputCost: Math.round(outputCost * 100) / 100,
        totalCost: Math.round(toolTotalCost * 100) / 100,
      };
    });

    return {
      timeframe: `${timeframeDays}d`,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      pricing: {
        model: MODEL_NAME,
        inputPer1M: INPUT_COST_PER_1M,
        outputPer1M: OUTPUT_COST_PER_1M,
        currency: 'USD',
      },
      overall: {
        totalInteractions,
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        avgInputTokens: Math.round(overallStats?.avg_input_tokens || 0),
        avgOutputTokens: Math.round(overallStats?.avg_output_tokens || 0),
        avgTotalTokens: Math.round(
          (overallStats?.avg_input_tokens || 0) + (overallStats?.avg_output_tokens || 0)
        ),
        avgDurationMs: Math.round(overallStats?.avg_duration_ms || 0),
        totalInputCost: Math.round(totalInputCost * 100) / 100,
        totalOutputCost: Math.round(totalOutputCost * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        avgCostPerInteraction: Math.round(avgCostPerInteraction * 1_000_000) / 1_000_000,
      },
      byToolType,
    };
  }
}

