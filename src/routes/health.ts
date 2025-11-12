import { Hono } from 'hono';
import type { Bindings } from '../types';

export const healthRoutes = new Hono<{ Bindings: Bindings }>();

// Basic health check
healthRoutes.get('/', async (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
  });
});

// Database health check
healthRoutes.get('/db', async (c) => {
  try {
    // Test database connection with a simple query
    const result = await c.env.DB.prepare('SELECT 1 as test').first();
    
    return c.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      test_result: result,
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    return c.json({
      status: 'unhealthy',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Detailed health check with database stats
healthRoutes.get('/detailed', async (c) => {
  try {
    const [walletCount, completionCount] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM wallet_data').first<{ count: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM training_completions').first<{ count: number }>(),
    ]);

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT,
      database: {
        status: 'connected',
        stats: {
          total_wallets: walletCount?.count || 0,
          total_completions: completionCount?.count || 0,
        }
      }
    });
  } catch (error) {
    console.error('Detailed health check failed:', error);
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});
