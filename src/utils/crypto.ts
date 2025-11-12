import { ethers } from 'ethers';
import type { CompletionVoucher, EIP712Domain, EIP712Types } from '../types';

export class VoucherSigner {
  private wallet: ethers.Wallet;
  private domain: EIP712Domain;
  private types: EIP712Types;

  constructor(privateKey: string, contractAddress: string, chainId: number) {
    this.wallet = new ethers.Wallet(privateKey);
    
    this.domain = {
      name: "TrainingCert",
      version: "1",
      chainId,
      verifyingContract: contractAddress,
    };

    this.types = {
      CompletionVoucher: [
        { name: "taskCode", type: "uint256" },
        { name: "wallet", type: "address" },
      ],
    };
  }

  async signVoucher(voucher: CompletionVoucher): Promise<string> {
    return await this.wallet.signTypedData(this.domain, this.types, voucher);
  }

  async verifyVoucher(voucher: CompletionVoucher, signature: string): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyTypedData(
        this.domain,
        this.types,
        voucher,
        signature
      );
      return recoveredAddress.toLowerCase() === this.wallet.address.toLowerCase();
    } catch (error) {
      console.error('Voucher verification failed:', error);
      return false;
    }
  }

  getIssuerAddress(): string {
    return this.wallet.address;
  }

  getDomain(): EIP712Domain {
    return this.domain;
  }
}

export function isValidEthereumAddress(address: string): boolean {
  return ethers.isAddress(address);
}

export function normalizeAddress(address: string): string {
  return ethers.getAddress(address);
}
