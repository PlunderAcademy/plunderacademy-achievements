import { Context, Next } from 'hono';
import { DatabaseService } from './database';
import { RATE_LIMITS, Bindings } from '../types';

export async function rateLimit(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const path = new URL(c.req.url).pathname;
    const rateConfig = RATE_LIMITS[path];
    
    if (!rateConfig) {
      // No rate limit configured for this endpoint
      return await next();
    }

    // Get client identifiers
    const walletAddress = c.req.param('walletAddress') || 
                         c.req.header('x-wallet-address') || 
                         'anonymous';
    const ipAddress = c.req.header('cf-connecting-ip') || 
                     c.req.header('x-forwarded-for') || 
                     c.req.header('x-real-ip') || 
                     'unknown';

    const db = new DatabaseService(c.env.DB);
    
    const { allowed, remaining } = await db.checkRateLimit(
      walletAddress,
      ipAddress,
      path,
      rateConfig.maxRequests,
      rateConfig.windowMs
    );

    // Set rate limit headers
    c.header('X-RateLimit-Limit', rateConfig.maxRequests.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', (Date.now() + rateConfig.windowMs).toString());

    if (!allowed) {
      return c.json(
        { 
          error: 'Rate limit exceeded', 
          message: `Too many requests. Limit: ${rateConfig.maxRequests} per ${rateConfig.windowMs / 1000}s`,
          retryAfter: rateConfig.windowMs / 1000
        }, 
        429
      );
    }

    return await next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Continue on rate limit error to avoid blocking requests
    return await next();
  }
}
