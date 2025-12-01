import { ethers } from 'ethers';

// ABI for the functions we need to call
const TRAINING_REGISTRY_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "wallet", "type": "address"}],
    "name": "getWalletAchievements",
    "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "wallet", "type": "address"},
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"}
    ],
    "name": "hasAchievement",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "account", "type": "address"},
      {"internalType": "uint256", "name": "id", "type": "uint256"}
    ],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "uri",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export class ContractReader {
  private contract: ethers.Contract;
  private provider: ethers.JsonRpcProvider;

  constructor(contractAddress: string, rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contract = new ethers.Contract(contractAddress, TRAINING_REGISTRY_ABI, this.provider);
  }

  /**
   * Get all achievement token IDs for a wallet from the smart contract
   */
  async getWalletAchievements(walletAddress: string): Promise<number[]> {
    try {
      const achievements = await this.contract.getWalletAchievements(walletAddress);
      // Handle case where contract returns empty or null
      if (!achievements || achievements.length === 0) {
        return [];
      }
      return achievements.map((tokenId: bigint) => Number(tokenId));
    } catch (error: any) {
      // Handle BAD_DATA error - this often means wallet has no achievements or contract doesn't exist
      if (error?.code === 'BAD_DATA' || error?.message?.includes('BAD_DATA')) {
        console.warn('Contract returned empty data for wallet achievements - wallet may have no achievements yet');
        return [];
      }
      console.error('Error getting wallet achievements from contract:', error);
      throw new Error('Failed to read achievements from contract');
    }
  }

  /**
   * Check if a wallet has a specific achievement
   */
  async hasAchievement(walletAddress: string, tokenId: number): Promise<boolean> {
    try {
      return await this.contract.hasAchievement(walletAddress, tokenId);
    } catch (error) {
      console.error('Error checking achievement from contract:', error);
      throw new Error('Failed to check achievement from contract');
    }
  }

  /**
   * Get the balance of a specific token for a wallet (should be 0 or 1 for soulbound tokens)
   */
  async getBalance(walletAddress: string, tokenId: number): Promise<number> {
    try {
      const balance = await this.contract.balanceOf(walletAddress, tokenId);
      return Number(balance);
    } catch (error) {
      console.error('Error getting balance from contract:', error);
      throw new Error('Failed to get balance from contract');
    }
  }

  /**
   * Get the metadata URI for a specific token
   */
  async getTokenUri(tokenId: number): Promise<string> {
    try {
      return await this.contract.uri(tokenId);
    } catch (error) {
      console.error('Error getting token URI from contract:', error);
      throw new Error('Failed to get token URI from contract');
    }
  }

  /**
   * Get detailed achievement information for a wallet
   */
  async getWalletAchievementDetails(walletAddress: string): Promise<Array<{
    tokenId: number;
    achievementNumber: string;
    hasAchievement: boolean;
    balance: number;
    uri: string;
  }>> {
    try {
      const tokenIds = await this.getWalletAchievements(walletAddress);
      
      const details = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const [hasIt, balance, uri] = await Promise.all([
            this.hasAchievement(walletAddress, tokenId),
            this.getBalance(walletAddress, tokenId),
            this.getTokenUri(tokenId)
          ]);

          return {
            tokenId,
            achievementNumber: this.formatAchievementNumber(tokenId),
            hasAchievement: hasIt,
            balance,
            uri
          };
        })
      );

      return details;
    } catch (error) {
      console.error('Error getting wallet achievement details:', error);
      throw new Error('Failed to get achievement details from contract');
    }
  }

  /**
   * Format a token ID as a zero-padded achievement number (e.g., 1 -> "0001")
   */
  private formatAchievementNumber(tokenId: number, padding: number = 4): string {
    return tokenId.toString().padStart(padding, '0');
  }
}

/**
 * Convert achievement number (e.g., "0001") to task code (number)
 */
export function achievementNumberToTaskCode(achievementNumber: string): number {
  return parseInt(achievementNumber, 10);
}

/**
 * Convert task code (number) to achievement number (e.g., 1 -> "0001")
 */
export function taskCodeToAchievementNumber(taskCode: number, padding: number = 4): string {
  return taskCode.toString().padStart(padding, '0');
}
