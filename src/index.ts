import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { voucherRoutes } from './routes/vouchers';
import { walletRoutes } from './routes/wallets';
import { healthRoutes } from './routes/health';
import { feedbackRoutes } from './routes/feedback';
import { analyticsRoutes } from './routes/analytics';
import type { Bindings } from './types';

const app = new Hono<{ Bindings: Bindings }>();

// CORS middleware - Allow requests from anywhere
app.use('*', cors({
  origin: '*', // Allow all origins
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false, // Don't include credentials when allowing all origins
}));

// Health check routes
app.route('/health', healthRoutes);

// API routes
app.route('/api/v1/vouchers', voucherRoutes);
app.route('/api/v1/wallets', walletRoutes);
app.route('/api/v1/feedback', feedbackRoutes);
app.route('/api/v1/analytics', analyticsRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({ 
    message: 'Plunder Academy API',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({ 
    error: 'Internal server error',
    message: c.env.ENVIRONMENT === 'development' ? err.message : undefined
  }, 500);
});

export default app;
