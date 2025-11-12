import { Hono } from 'hono';
import { isValidEthereumAddress, normalizeAddress } from '../utils/crypto';
import { ContractReader } from '../utils/contract';
import { rateLimit } from '../utils/rateLimit';
import { DatabaseService } from '../utils/database';
import type { Bindings } from '../types';

export const walletRoutes = new Hono<{ Bindings: Bindings }>();

// Get wallet data and achievements
walletRoutes.get('/:walletAddress', rateLimit, async (c) => {
  try {
    const walletAddress = c.req.param('walletAddress');

    if (!isValidEthereumAddress(walletAddress)) {
      return c.json({ error: 'Invalid wallet address' }, 400);
    }

    const normalizedWallet = normalizeAddress(walletAddress);
    const db = new DatabaseService(c.env.DB);
    
    const [walletData, completions] = await Promise.all([
      db.getWalletData(normalizedWallet),
      db.getWalletCompletions(normalizedWallet)
    ]);

    // Get claimed achievements from contract
    const contractReader = new ContractReader(c.env.CONTRACT_ADDRESS, c.env.RPC_URL);
    const claimedAchievements = await contractReader.getWalletAchievementDetails(normalizedWallet);
    
    // Create a set of claimed achievement numbers
    const claimedSet = new Set(
      claimedAchievements.map(achievement => achievement.achievementNumber)
    );
    
    return c.json({
      wallet: {
        address: normalizedWallet,
        created_at: walletData?.created_at,
        metadata: walletData?.metadata ? JSON.parse(walletData.metadata) : null,
      },
      achievements: {
        totalVouchers: completions.length,
        totalClaimed: claimedAchievements.length,
        unclaimed: completions.filter(c => !claimedSet.has(c.achievement_number)).length,
        vouchers: completions.map(completion => ({
          achievementNumber: completion.achievement_number,
          taskCode: completion.task_code,
          isClaimed: claimedSet.has(completion.achievement_number),
          createdAt: completion.created_at,
        })),
        claimed: claimedAchievements.map(achievement => ({
          achievementNumber: achievement.achievementNumber,
          tokenId: achievement.tokenId,
          metadataUri: achievement.uri
        }))
      }
    });
  } catch (error) {
    console.error('Error getting wallet data:', error);
    return c.json({ error: 'Failed to get wallet data' }, 500);
  }
});

// Update wallet metadata
walletRoutes.put('/:walletAddress/metadata', rateLimit, async (c) => {
  try {
    const walletAddress = c.req.param('walletAddress');
    const body = await c.req.json() as { metadata: Record<string, any> };

    if (!isValidEthereumAddress(walletAddress)) {
      return c.json({ error: 'Invalid wallet address' }, 400);
    }

    if (!body.metadata || typeof body.metadata !== 'object') {
      return c.json({ error: 'Invalid metadata object' }, 400);
    }

    const normalizedWallet = normalizeAddress(walletAddress);
    const db = new DatabaseService(c.env.DB);
    
    // Ensure wallet exists
    await db.createWalletData(normalizedWallet);
    
    // Update metadata
    await db.updateWalletMetadata(normalizedWallet, JSON.stringify(body.metadata));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating wallet metadata:', error);
    return c.json({ error: 'Failed to update wallet metadata' }, 500);
  }
});

// Get wallet statistics
walletRoutes.get('/:walletAddress/stats', rateLimit, async (c) => {
  try {
    const walletAddress = c.req.param('walletAddress');

    if (!isValidEthereumAddress(walletAddress)) {
      return c.json({ error: 'Invalid wallet address' }, 400);
    }

    const normalizedWallet = normalizeAddress(walletAddress);
    const db = new DatabaseService(c.env.DB);
    
    const [completions, contractReader] = await Promise.all([
      db.getWalletCompletions(normalizedWallet),
      new ContractReader(c.env.CONTRACT_ADDRESS, c.env.RPC_URL)
    ]);
    
    const claimedAchievements = await contractReader.getWalletAchievementDetails(normalizedWallet);
    const claimedSet = new Set(claimedAchievements.map(a => a.achievementNumber));
    
    const stats = {
      totalVouchers: completions.length,
      totalClaimed: claimedAchievements.length,
      unclaimedVouchers: completions.filter(c => !claimedSet.has(c.achievement_number)).length,
      firstVoucher: completions.length > 0 ? 
        Math.min(...completions.map(c => new Date(c.created_at!).getTime())) : null,
      lastVoucher: completions.length > 0 ? 
        Math.max(...completions.map(c => new Date(c.created_at!).getTime())) : null,
      achievementNumbers: completions.map(c => c.achievement_number).sort(),
      claimedTokenIds: claimedAchievements.map(a => a.tokenId).sort((a, b) => a - b),
    };

    return c.json(stats);
  } catch (error) {
    console.error('Error getting wallet stats:', error);
    return c.json({ error: 'Failed to get wallet stats' }, 500);
  }
});
