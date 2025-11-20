import { Hono } from 'hono';
import { VoucherSigner, isValidEthereumAddress, normalizeAddress } from '../utils/crypto';
import { ContractReader, achievementNumberToTaskCode, taskCodeToAchievementNumber } from '../utils/contract';
import { rateLimit } from '../utils/rateLimit';
import { DatabaseService } from '../utils/database';
import type { 
  VoucherRequest, 
  VoucherResponse, 
  CompletionVoucher, 
  ValidationResult, 
  ValidationContext, 
  SubmissionValidator,
  QuizQuestion,
  QuizSubmission,
  QuizResult,
  TransactionSubmission,
  SecretSubmission,
  Bindings,
  InteractiveElementCorrectAnswer,
  WordJumbleAnswer,
  ConceptMatchingAnswer,
  TimelineBuilderAnswer,
  TrueFalseAnswer,
  DragDropPuzzleAnswer
} from '../types';

export const voucherRoutes = new Hono<{ Bindings: Bindings }>();

// Helper function to convert hex to string (Cloudflare Workers compatible)
function hexToString(hex: string): string {
  try {
    let result = '';
    for (let i = 0; i < hex.length; i += 2) {
      const hexPair = hex.substring(i, i + 2);
      const charCode = parseInt(hexPair, 16);
      if (charCode !== 0) { // Skip null bytes
        result += String.fromCharCode(charCode);
      }
    }
    return result;
  } catch (error) {
    return '';
  }
}

// Types for RPC responses
interface RPCResponse<T = any> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

interface TransactionData {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  input: string;
  nonce: string;
  blockHash: string | null;
  blockNumber: string | null;
  transactionIndex: string | null;
}

// Quiz data and secret answers are loaded from external JSON files
// to keep them private in open source repositories
let QUIZ_DATA: Record<string, { questions: QuizQuestion[], passingScore: number }> = {};
let SECRET_ANSWERS: Record<string, string> = {};

// Cache for loaded data (expires after 1 hour)
let quizDataCache: { data: any, timestamp: number } | null = null;
let secretAnswersCache: { data: any, timestamp: number } | null = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Load quiz data from external JSON file
 */
async function loadQuizData(env: Bindings): Promise<void> {
  // Check cache first
  if (quizDataCache && (Date.now() - quizDataCache.timestamp < CACHE_DURATION)) {
    QUIZ_DATA = quizDataCache.data;
    return;
  }

  const quizDataUrl = env.QUIZ_DATA_URL;
  if (!quizDataUrl) {
    console.error('QUIZ_DATA_URL not configured in environment variables');
    return;
  }

  try {
    const response = await fetch(quizDataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch quiz data: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as Record<string, { questions: QuizQuestion[], passingScore: number }>;
    QUIZ_DATA = data;
    quizDataCache = { data, timestamp: Date.now() };
  } catch (error) {
    console.error('Error loading quiz data:', error);
    throw error;
  }
}

/**
 * Load secret answers from external JSON file
 */
async function loadSecretAnswers(env: Bindings): Promise<void> {
  // Check cache first
  if (secretAnswersCache && (Date.now() - secretAnswersCache.timestamp < CACHE_DURATION)) {
    SECRET_ANSWERS = secretAnswersCache.data;
    return;
  }

  const secretAnswersUrl = env.SECRET_ANSWERS_URL;
  if (!secretAnswersUrl) {
    console.error('SECRET_ANSWERS_URL not configured in environment variables');
    return;
  }

  try {
    const response = await fetch(secretAnswersUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch secret answers: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as Record<string, string>;
    SECRET_ANSWERS = data;
    secretAnswersCache = { data, timestamp: Date.now() };
  } catch (error) {
    console.error('Error loading secret answers:', error);
    throw error;
  }
}


// Achievement type mapping
const ACHIEVEMENT_TYPES: Record<string, "quiz" | "transaction" | "contract" | "custom" | "secret" > = {
  '0001': 'quiz', // blockchain-fundamentals
  '0002': 'quiz', // evm-fundamentals  
  '0003': 'quiz', // intro-to-solidity
  '0004': 'quiz', // zilliqa-evm-setup
  '0005': 'transaction',  // creating-erc20-tokens (factory or manual deployment)
  '0021': 'quiz', // Island 2 Module 1
  '0022': 'quiz', // Island 2 Module 2
  '0023': 'quiz', // Island 2 Module 3
  '0024': 'quiz', // Island 2 Module 4
  '0025': 'transaction', // staking-contract-practical
  '0031': 'quiz', // Island 3 Module 1
  '0032': 'quiz', // Island 3 Module 2
  '0033': 'transaction', // nft-collection-practical
  '0041': 'quiz', // Island 4 Module 1
  '0042': 'quiz', // Island 4 Module 2
  '0043': 'transaction', // random-number-generator-practical
  '0044': 'quiz', // Island 4 Module 4
  '0045': 'quiz', // Island 4 Module 5
  '0046': 'contract', // upgradable-contract-practical (submit proxy address)
  '0051': 'quiz', // Island 5 Module 1
  '0052': 'quiz', // Island 5 Module 2
  '0053': 'quiz', // Island 5 Module 3
  '0054': 'quiz', // Island 5 Module 4
  '1001': 'secret',  // secret achievement - first secret
  '1002': 'secret',  // secret achievement - first secret
  '1003': 'secret',  // secret achievement - first secret
  '1004': 'secret',  // secret achievement - first secret
  '1005': 'secret',  // secret achievement - first secret
  '1101': 'secret'  // launch event achievement - this will be removed a day after the launch event
};

// Interactive element grading functions

/**
 * Helper to detect if an answer is a JSON string (interactive element)
 */
function isInteractiveAnswer(answer: string): boolean {
  if (!answer || typeof answer !== 'string') return false;
  const trimmed = answer.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

/**
 * Grade a word jumble answer
 */
function gradeWordJumble(userAnswer: string, correctAnswer: any, points: number): number {
  try {
    const parsed = JSON.parse(userAnswer);
    if (parsed.type !== 'word-jumble') return 0;
    
    const userWord = parsed.userResponse?.word?.toUpperCase() || '';
    const correctWord = correctAnswer.data.word.toUpperCase();
    
    return userWord === correctWord ? points : 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Grade concept matching with partial credit
 */
function gradeConceptMatching(userAnswer: string, correctAnswer: any, points: number): number {
  try {
    const parsed = JSON.parse(userAnswer);
    if (parsed.type !== 'concept-matching') return 0;
    
    const userPairs = parsed.userResponse?.pairs || [];
    const correctPairs = correctAnswer.data.pairs;
    
    if (correctPairs.length === 0) return 0;
    
    let correctCount = 0;
    for (const userPair of userPairs) {
      const isCorrect = correctPairs.some((cp: any) => 
        cp.conceptId === userPair.conceptId && cp.definitionId === userPair.definitionId
      );
      if (isCorrect) correctCount++;
    }
    
    // Award partial credit based on percentage correct
    return (correctCount / correctPairs.length) * points;
  } catch (error) {
    return 0;
  }
}

/**
 * Grade timeline builder with partial credit for correct positions
 */
function gradeTimelineBuilder(userAnswer: string, correctAnswer: any, points: number): number {
  try {
    const parsed = JSON.parse(userAnswer);
    if (parsed.type !== 'timeline-builder') return 0;
    
    const userSequence = parsed.userResponse?.sequence || [];
    const correctSequence = correctAnswer.data.sequence;
    
    if (correctSequence.length === 0) return 0;
    
    let correctPositions = 0;
    for (let i = 0; i < Math.min(userSequence.length, correctSequence.length); i++) {
      if (userSequence[i] === correctSequence[i]) {
        correctPositions++;
      }
    }
    
    // Award partial credit based on percentage in correct positions
    return (correctPositions / correctSequence.length) * points;
  } catch (error) {
    return 0;
  }
}

/**
 * Grade true/false statements with partial credit
 */
function gradeTrueFalseStatements(userAnswer: string, correctAnswer: any, points: number): number {
  try {
    const parsed = JSON.parse(userAnswer);
    if (parsed.type !== 'true-false-statements') return 0;
    
    const userClassifications = parsed.userResponse?.classifications || [];
    const correctClassifications = correctAnswer.data.classifications;
    
    if (correctClassifications.length === 0) return 0;
    
    let correctCount = 0;
    for (const userClass of userClassifications) {
      const correctClass = correctClassifications.find((cc: any) => cc.id === userClass.id);
      if (correctClass && correctClass.answer === userClass.answer) {
        correctCount++;
      }
    }
    
    // Award partial credit based on percentage correct
    return (correctCount / correctClassifications.length) * points;
  } catch (error) {
    return 0;
  }
}

/**
 * Grade drag & drop puzzle with partial credit for correct positions
 */
function gradeDragDropPuzzle(userAnswer: string, correctAnswer: any, points: number): number {
  try {
    const parsed = JSON.parse(userAnswer);
    if (parsed.type !== 'drag-drop-puzzle') return 0;
    
    const userSequence = parsed.userResponse?.sequence || [];
    const correctSequence = correctAnswer.data.sequence;
    
    if (correctSequence.length === 0) return 0;
    
    let correctPositions = 0;
    for (let i = 0; i < Math.min(userSequence.length, correctSequence.length); i++) {
      if (userSequence[i] === correctSequence[i]) {
        correctPositions++;
      }
    }
    
    // Award partial credit based on percentage in correct positions
    return (correctPositions / correctSequence.length) * points;
  } catch (error) {
    return 0;
  }
}

// Validation functions for different submission types

/**
 * Validates secret submissions by checking the secret answer
 */
async function validateSecretSubmission(submissionData: SecretSubmission, context: ValidationContext, env?: Bindings): Promise<ValidationResult> {
  // Load secret answers if needed
  if (env) {
    await loadSecretAnswers(env);
  }
  
  const expectedAnswer = SECRET_ANSWERS[context.achievementNumber];
  
  if (!expectedAnswer) {
    return {
      passed: false,
      error: 'Secret answer not configured for this achievement',
      retryAllowed: false
    };
  }

  // Check time restriction for achievement 1101 (launch day)
  // Only available until November 14th, 2025 at 23:00 GMT
  if (context.achievementNumber === '1101') {
    const cutoffDate = new Date('2025-11-14T23:00:00Z');
    const currentDate = new Date();
    
    if (currentDate > cutoffDate) {
      return {
        passed: false,
        error: 'This launch day achievement is no longer available. The promotion period has ended.',
        retryAllowed: false
      };
    }
  }

  const { secretAnswer } = submissionData;
  
  if (!secretAnswer || typeof secretAnswer !== 'string') {
    return {
      passed: false,
      error: 'Secret answer is required',
      retryAllowed: true
    };
  }

  // Check if the secret answer matches (case-sensitive)
  const passed = secretAnswer.trim() === expectedAnswer;

  return {
    passed,
    feedback: passed 
      ? 'Congratulations! You discovered the secret and unlocked this special achievement!'
      : 'The secret answer is incorrect. Keep exploring to find the right answer.',
    nextSteps: passed 
      ? ['Claim your voucher to receive the special achievement NFT']
      : ['Look for clues in the training materials or hidden content', 'Try again when you find the secret'],
    retryAllowed: !passed
  };
}

/**
 * Validates quiz submissions by checking answers against correct responses
 * Supports both traditional multiple choice and interactive element types
 */
async function validateQuizSubmission(submissionData: QuizSubmission, context: ValidationContext, env?: Bindings): Promise<ValidationResult> {
  // Load quiz data if needed
  if (env) {
    await loadQuizData(env);
  }
  
  const quizData = QUIZ_DATA[context.achievementNumber];
  
  if (!quizData) {
    return {
      passed: false,
      error: 'Quiz data not found for this achievement',
      retryAllowed: false
    };
  }

  const { questions, passingScore } = quizData;
  let correctCount = 0;
  let totalScore = 0;
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

  // Check each submitted answer
  for (const question of questions) {
    const submittedAnswer = submissionData.answers[question.id];
    
    if (!submittedAnswer) continue;
    
    let questionScore = 0;
    
    // Detect if this is an interactive element (JSON string)
    if (isInteractiveAnswer(submittedAnswer)) {
      // Grade interactive element based on type
      const correctAnswer = question.correctAnswer;
      
      if (typeof correctAnswer === 'object' && correctAnswer.type) {
        switch (correctAnswer.type) {
          case 'word-jumble':
            questionScore = gradeWordJumble(submittedAnswer, correctAnswer, question.points);
            break;
          case 'concept-matching':
            questionScore = gradeConceptMatching(submittedAnswer, correctAnswer, question.points);
            break;
          case 'timeline-builder':
            questionScore = gradeTimelineBuilder(submittedAnswer, correctAnswer, question.points);
            break;
          case 'true-false-statements':
            questionScore = gradeTrueFalseStatements(submittedAnswer, correctAnswer, question.points);
            break;
          case 'drag-drop-puzzle':
            questionScore = gradeDragDropPuzzle(submittedAnswer, correctAnswer, question.points);
            break;
        }
        
        // Count as correct if earned full points
        if (questionScore === question.points) {
          correctCount++;
        }
      }
    } else {
      // Traditional multiple choice - simple string comparison
      const correctAnswer = question.correctAnswer;
      if (typeof correctAnswer === 'string') {
        if (submittedAnswer.toUpperCase() === correctAnswer.toUpperCase()) {
          correctCount++;
          questionScore = question.points;
        }
      }
    }
    
    totalScore += questionScore;
  }

  const accuracy = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
  const scorePercentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const passed = scorePercentage >= passingScore;

  return {
    passed,
    score: totalScore,
    maxScore,
    passingScore,
    totalQuestions: questions.length,
    correctAnswers: correctCount,
    timeSpent: context.metadata?.timeSpent,
    accuracy,
    feedback: passed 
      ? `Congratulations! You scored ${totalScore}/${maxScore} (${scorePercentage.toFixed(1)}%) and passed the quiz.`
      : `You scored ${totalScore}/${maxScore} (${scorePercentage.toFixed(1)}%). You need ${passingScore}% to pass. Review the material and try again.`,
    nextSteps: passed 
      ? ['Claim your voucher to receive the achievement NFT']
      : ['Review the course materials', 'Focus on areas where you got questions wrong', 'Take the quiz again when ready'],
    retryAllowed: !passed
  };
}

/**
 * Validates transaction submissions by checking blockchain for valid transaction
 */
async function validateTransactionSubmission(submissionData: TransactionSubmission, context: ValidationContext, env?: Bindings): Promise<ValidationResult> {
  const { transactionHash, chainId, claimantAddress, method } = submissionData;
  
  // Validate transaction ID format
  const txIdPattern = /^0x[a-fA-F0-9]{64}$/;
  
  if (!txIdPattern.test(transactionHash)) {
    return {
      passed: false,
      error: 'Invalid transaction ID format. Expected 64-character hex string starting with 0x',
      retryAllowed: true
    };
  }

  // For achievement 0005, validate token creation
  if (context.achievementNumber === '0005') {
    if (!method) {
      return {
        passed: false,
        error: 'Token creation method is required for achievement 0005. Must be "factory" or "deployment"',
        retryAllowed: true
      };
    }

    if (!claimantAddress || claimantAddress.toLowerCase() !== context.walletAddress.toLowerCase()) {
      return {
        passed: false,
        error: 'Claimant address must match the submitting wallet address',
        retryAllowed: true
      };
    }

    if (method === 'factory') {
      if (!env) {
        return {
          passed: false,
          error: 'Environment configuration not available',
          retryAllowed: true
        };
      }
      return await verifyFactoryTokenCreation(transactionHash, chainId || 33101, claimantAddress, context, env);
    } else if (method === 'deployment') {
      return await verifyManualTokenDeployment(transactionHash, chainId || 33101, claimantAddress, context);
    } else {
      return {
        passed: false,
        error: 'Invalid method. Must be "factory" or "deployment"',
        retryAllowed: true
      };
    }
  }

  // Achievement 0025: Staking Contract
  if (context.achievementNumber === '0025') {
    if (!claimantAddress || claimantAddress.toLowerCase() !== context.walletAddress.toLowerCase()) {
      return {
        passed: false,
        error: 'Claimant address must match the submitting wallet address',
        retryAllowed: true
      };
    }
    return await verifyStakingContract(transactionHash, chainId || 33101, claimantAddress, context);
  }

  // Achievement 0033: NFT Collection
  if (context.achievementNumber === '0033') {
    if (!claimantAddress || claimantAddress.toLowerCase() !== context.walletAddress.toLowerCase()) {
      return {
        passed: false,
        error: 'Claimant address must match the submitting wallet address',
        retryAllowed: true
      };
    }
    return await verifyNFTCollection(transactionHash, chainId || 33101, claimantAddress, context);
  }

  // Achievement 0043: Random Number Generator
  if (context.achievementNumber === '0043') {
    if (!claimantAddress || claimantAddress.toLowerCase() !== context.walletAddress.toLowerCase()) {
      return {
        passed: false,
        error: 'Claimant address must match the submitting wallet address',
        retryAllowed: true
      };
    }
    return await verifyRandomNumberGenerator(transactionHash, chainId || 33101, claimantAddress, context);
  }

  // Generic transaction validation for other achievements
  try {
    // Query the blockchain to verify the transaction
    const response = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [transactionHash],
        id: 1
      })
    });

    const data = await response.json() as RPCResponse<TransactionData>;
    
    if (!response.ok || data.error) {
      return {
        passed: false,
        error: `Failed to verify transaction: ${data.error?.message || 'Network error'}`,
        retryAllowed: true
      };
    }

    const transaction = data.result;
    
    if (!transaction) {
      return {
        passed: false,
        error: 'Transaction not found on the blockchain. Make sure the transaction is confirmed.',
        retryAllowed: true
      };
    }

    // Verify the transaction is from the correct wallet address
    const normalizedTxFrom = normalizeAddress(transaction.from);
    const normalizedWallet = normalizeAddress(context.walletAddress);
    
    if (normalizedTxFrom !== normalizedWallet) {
      return {
        passed: false,
        error: 'Transaction must be from the submitting wallet address',
        retryAllowed: true
      };
    }
    
    const blockNumber = transaction.blockNumber ? parseInt(transaction.blockNumber, 16) : undefined;
    
    return { 
      passed: true,
      transactionValid: true,
      blockNumber,
      feedback: 'Transaction successfully verified on the blockchain!',
      nextSteps: ['Claim your voucher to receive the achievement NFT'],
      retryAllowed: false
    };
    
  } catch (error) {
    console.error('Error validating transaction:', error);
    return {
      passed: false,
      error: 'Failed to validate transaction due to network error',
      retryAllowed: true
    };
  }
}

/**
 * Verifies token creation via factory contract
 */
async function verifyFactoryTokenCreation(
  txId: string, 
  chainId: number, 
  expectedCreator: string,
  context: ValidationContext,
  env: Bindings
): Promise<ValidationResult> {
  try {
    // Get the correct factory address based on chain
    const factoryAddress = chainId === 33101 
      ? env.NEXT_PUBLIC_FACTORY_ADDRESS_TESTNET 
      : env.NEXT_PUBLIC_FACTORY_ADDRESS_MAINNET;
    
    if (!factoryAddress) {
      return {
        passed: false,
        error: 'Token factory not deployed on this network',
        retryAllowed: false
      };
    }

    // Get transaction receipt to check for events
    const receiptResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txId],
        id: 1
      })
    });

    const receiptData = await receiptResponse.json() as RPCResponse<any>;
    
    if (!receiptResponse.ok || receiptData.error || !receiptData.result) {
      return {
        passed: false,
        error: `Failed to get transaction receipt: ${receiptData.error?.message || 'Transaction not found'}`,
        retryAllowed: true
      };
    }

    const receipt = receiptData.result;
    
    if (receipt.status !== '0x1') {
      return {
        passed: false,
        error: 'Transaction failed on the blockchain',
        retryAllowed: true
      };
    }

    // Check if transaction called our factory
    if (receipt.to?.toLowerCase() !== factoryAddress.toLowerCase()) {
      return {
        passed: false,
        error: 'Transaction did not call the Plunder Academy token factory',
        retryAllowed: true
      };
    }

    // Look for TokenCreated event
    // TokenCreated event signature: keccak256("TokenCreated(address,address,address,string,string,uint256,uint256)")
    const tokenCreatedEventSignature = '0xf7e8acecb8d3544fef71b7f97c2188587e324a3e2279d51915c3e067a640e88d';
    
    const tokenCreatedLog = receipt.logs?.find((log: any) => 
      log.topics?.[0] === tokenCreatedEventSignature
    );

    if (!tokenCreatedLog) {
      return {
        passed: false,
        error: 'No TokenCreated event found in transaction',
        retryAllowed: true
      };
    }

    // Decode event data - indexed parameters are in topics, non-indexed in data
    const creator = '0x' + tokenCreatedLog.topics[1].slice(26); // Remove leading zeros
    const tokenAddress = '0x' + tokenCreatedLog.topics[3].slice(26); // Remove leading zeros
    
    if (creator.toLowerCase() !== expectedCreator.toLowerCase()) {
      return {
        passed: false,
        error: 'Token creator does not match connected wallet',
        retryAllowed: true
      };
    }

    // Verify the created token is a valid ERC-20
    const tokenValidation = await verifyERC20Token(tokenAddress, context.rpcUrl, expectedCreator);
    
    if (!tokenValidation.isValid) {
      return {
        passed: false,
        error: `Token validation failed: ${tokenValidation.error}`,
        retryAllowed: true
      };
    }

    return {
      passed: true,
      feedback: `Successfully created token via factory! Token address: ${tokenAddress}`,
      nextSteps: ['Claim your voucher to receive the achievement NFT'],
      retryAllowed: false,
      tokenAddress,
      tokenName: tokenValidation.name,
      tokenSymbol: tokenValidation.symbol,
      method: 'factory'
    };

  } catch (error) {
    console.error('Factory verification error:', error);
    return {
      passed: false,
      error: 'Failed to verify factory token creation',
      retryAllowed: true
    };
  }
}

/**
 * Verifies manual token contract deployment
 */
async function verifyManualTokenDeployment(
  txId: string,
  chainId: number,
  expectedClaimant: string,
  context: ValidationContext
): Promise<ValidationResult> {
  try {
    // Get transaction receipt
    const receiptResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txId],
        id: 1
      })
    });

    const receiptData = await receiptResponse.json() as RPCResponse<any>;
    
    if (!receiptResponse.ok || receiptData.error || !receiptData.result) {
      return {
        passed: false,
        error: `Failed to get transaction receipt: ${receiptData.error?.message || 'Transaction not found'}`,
        retryAllowed: true
      };
    }

    const receipt = receiptData.result;
    
    if (receipt.status !== '0x1') {
      return {
        passed: false,
        error: 'Transaction failed on the blockchain',
        retryAllowed: true
      };
    }

    // Verify it was a contract deployment
    if (!receipt.contractAddress) {
      return {
        passed: false,
        error: 'Transaction did not deploy a contract',
        retryAllowed: true
      };
    }

    const contractAddress = receipt.contractAddress;

    // Verify the deployed contract is a valid ERC-20 with claimant
    const tokenValidation = await verifyERC20Token(contractAddress, context.rpcUrl, expectedClaimant);
    if (!tokenValidation.isValid) {
      return {
        passed: false,
        error: `Token validation failed: ${tokenValidation.error}`,
        retryAllowed: true
      };
    }

    // Verify claimant field exists and matches
    const claimantValidation = await verifyClaimantField(contractAddress, context.rpcUrl, expectedClaimant);
    if (!claimantValidation.isValid) {
      return {
        passed: false,
        error: claimantValidation.error,
        retryAllowed: true
      };
    }

    return {
      passed: true,
      feedback: `Successfully deployed token contract! Contract address: ${contractAddress}`,
      nextSteps: ['Claim your voucher to receive the achievement NFT'],
      retryAllowed: false,
      tokenAddress: contractAddress,
      tokenName: tokenValidation.name,
      tokenSymbol: tokenValidation.symbol,
      method: 'deployment'
    };

  } catch (error) {
    console.error('Manual deployment verification error:', error);
    return {
      passed: false,
      error: 'Failed to verify manual token deployment',
      retryAllowed: true
    };
  }
}

/**
 * Verifies that a contract is a valid ERC-20 token
 */
async function verifyERC20Token(
  contractAddress: string,
  rpcUrl: string,
  expectedCreator: string
): Promise<{ isValid: boolean; error?: string; name?: string; symbol?: string; totalSupply?: string }> {
  try {
    // Check standard ERC-20 functions
    const functions = [
      { name: 'name', signature: '0x06fdde03' },
      { name: 'symbol', signature: '0x95d89b41' },
      { name: 'decimals', signature: '0x313ce567' },
      { name: 'totalSupply', signature: '0x18160ddd' }
    ];

    const results: any = {};

    for (const func of functions) {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{
            to: contractAddress,
            data: func.signature
          }, 'latest'],
          id: 1
        })
      });

      const data = await response.json() as RPCResponse<string>;
      
      if (!response.ok || data.error) {
        return {
          isValid: false,
          error: `Failed to call ${func.name}(): ${data.error?.message || 'Network error'}`
        };
      }
      
      if (!data.result || data.result === '0x') {
        return {
          isValid: false,
          error: `Contract does not implement ERC-20 function: ${func.name}`
        };
      }

      // Decode the result based on function
      if (func.name === 'name' || func.name === 'symbol') {
        try {
          const hex = data.result.slice(2);
          
          if (hex.length >= 128) {
            // Standard ABI encoding: offset(32) + length(32) + data(padded)
            const lengthHex = hex.slice(64, 128);
            const length = parseInt(lengthHex, 16);
            
            if (length > 0 && length <= 100) { // Reasonable string length
              const dataHex = hex.slice(128, 128 + length * 2);
              const decoded = hexToString(dataHex);
              results[func.name] = decoded;
            } else {
              results[func.name] = '';
            }
          } else {
            // Try direct decode for shorter responses
            const decoded = hexToString(hex);
            if (decoded.length > 0) {
              results[func.name] = decoded;
            } else {
              results[func.name] = '';
            }
          }
        } catch (decodeError) {
          results[func.name] = '';
        }
      } else if (func.name === 'totalSupply' || func.name === 'decimals') {
        results[func.name] = data.result;
      }
    }

    // Validate that we got meaningful results
    if (!results.name || !results.symbol || results.name.length === 0 || results.symbol.length === 0) {
      return {
        isValid: false,
        error: `Contract does not return valid token name (${results.name}) or symbol (${results.symbol})`
      };
    }

    return {
      isValid: true,
      name: results.name,
      symbol: results.symbol,
      totalSupply: results.totalSupply
    };

  } catch (error) {
    return {
      isValid: false,
      error: `Failed to verify ERC-20 compliance: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Verifies that the contract has a claimant field matching the expected address
 */
async function verifyClaimantField(
  contractAddress: string,
  rpcUrl: string,
  expectedClaimant: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    // Call claimant() function - signature: 0xd28720af
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: '0xd28720af'
        }, 'latest'],
        id: 1
      })
    });

    const data = await response.json() as RPCResponse<string>;
    
    if (!response.ok || data.error) {
      return {
        isValid: false,
        error: `Failed to call claimant(): ${data.error?.message || 'Network error'}`
      };
    }
    
    if (!data.result || data.result === '0x') {
      return {
        isValid: false,
        error: 'Contract does not have a claimant field - required for achievement verification'
      };
    }

    // Decode address from result
    const claimantAddress = '0x' + data.result.slice(26); // Remove leading zeros from 32-byte result
    
    if (claimantAddress.toLowerCase() !== expectedClaimant.toLowerCase()) {
      return {
        isValid: false,
        error: `Contract claimant (${claimantAddress}) does not match connected wallet (${expectedClaimant})`
      };
    }

    return { isValid: true };

  } catch (error) {
    return {
      isValid: false,
      error: `Failed to verify claimant field: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Verifies staking contract deployment (Achievement 0025)
 */
async function verifyStakingContract(
  txId: string,
  chainId: number,
  expectedClaimant: string,
  context: ValidationContext
): Promise<ValidationResult> {
  try {
    // Get transaction receipt
    const receiptResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txId],
        id: 1
      })
    });

    const receiptData = await receiptResponse.json() as RPCResponse<any>;
    
    if (!receiptResponse.ok || receiptData.error || !receiptData.result) {
      return {
        passed: false,
        error: `Failed to get transaction receipt: ${receiptData.error?.message || 'Transaction not found'}`,
        retryAllowed: true
      };
    }

    const receipt = receiptData.result;
    
    if (receipt.status !== '0x1') {
      return {
        passed: false,
        error: 'Transaction failed on the blockchain',
        retryAllowed: true
      };
    }

    // Verify it was a contract deployment
    if (!receipt.contractAddress) {
      return {
        passed: false,
        error: 'Transaction did not deploy a contract',
        retryAllowed: true
      };
    }

    const contractAddress = receipt.contractAddress;

    // Verify claimant field
    const claimantValidation = await verifyClaimantField(contractAddress, context.rpcUrl, expectedClaimant);
    if (!claimantValidation.isValid) {
      return {
        passed: false,
        error: claimantValidation.error,
        retryAllowed: true
      };
    }

    // Verify stakingToken() function exists - signature: 0x72f702f3
    const stakingTokenResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: '0x72f702f3'
        }, 'latest'],
        id: 1
      })
    });

    const stakingTokenData = await stakingTokenResponse.json() as RPCResponse<string>;
    if (!stakingTokenResponse.ok || stakingTokenData.error || !stakingTokenData.result || stakingTokenData.result === '0x') {
      return {
        passed: false,
        error: 'Contract does not appear to be a staking contract (missing stakingToken)',
        retryAllowed: true
      };
    }

    // Verify totalStaked() function exists - signature: 0x817b1cd2
    const totalStakedResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: '0x817b1cd2'
        }, 'latest'],
        id: 1
      })
    });

    const totalStakedData = await totalStakedResponse.json() as RPCResponse<string>;
    if (!totalStakedResponse.ok || totalStakedData.error || !totalStakedData.result || totalStakedData.result === '0x') {
      return {
        passed: false,
        error: 'Contract does not appear to be a staking contract (missing totalStaked)',
        retryAllowed: true
      };
    }

    return {
      passed: true,
      feedback: `Successfully deployed staking contract! Contract address: ${contractAddress}`,
      nextSteps: ['Claim your voucher to receive the achievement NFT'],
      retryAllowed: false,
      contractAddress,
      method: 'deployment'
    };

  } catch (error) {
    console.error('Staking contract verification error:', error);
    return {
      passed: false,
      error: 'Failed to verify staking contract deployment',
      retryAllowed: true
    };
  }
}

/**
 * Verifies NFT collection deployment (Achievement 0033)
 */
async function verifyNFTCollection(
  txId: string,
  chainId: number,
  expectedClaimant: string,
  context: ValidationContext
): Promise<ValidationResult> {
  try {
    // Get transaction receipt
    const receiptResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txId],
        id: 1
      })
    });

    const receiptData = await receiptResponse.json() as RPCResponse<any>;
    
    if (!receiptResponse.ok || receiptData.error || !receiptData.result) {
      return {
        passed: false,
        error: `Failed to get transaction receipt: ${receiptData.error?.message || 'Transaction not found'}`,
        retryAllowed: true
      };
    }

    const receipt = receiptData.result;
    
    if (receipt.status !== '0x1') {
      return {
        passed: false,
        error: 'Transaction failed on the blockchain',
        retryAllowed: true
      };
    }

    // Verify it was a contract deployment
    if (!receipt.contractAddress) {
      return {
        passed: false,
        error: 'Transaction did not deploy a contract',
        retryAllowed: true
      };
    }

    const contractAddress = receipt.contractAddress;

    // Verify claimant field
    const claimantValidation = await verifyClaimantField(contractAddress, context.rpcUrl, expectedClaimant);
    if (!claimantValidation.isValid) {
      return {
        passed: false,
        error: claimantValidation.error,
        retryAllowed: true
      };
    }

    // Verify MAX_SUPPLY() constant - signature: 0x32cb6b0c
    const maxSupplyResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: '0x32cb6b0c'
        }, 'latest'],
        id: 1
      })
    });

    const maxSupplyData = await maxSupplyResponse.json() as RPCResponse<string>;
    if (!maxSupplyResponse.ok || maxSupplyData.error || !maxSupplyData.result || maxSupplyData.result === '0x') {
      return {
        passed: false,
        error: 'Contract does not appear to be an NFT collection (missing MAX_SUPPLY)',
        retryAllowed: true
      };
    }

    // Verify totalMinted() function - signature: 0xa2309ff8
    const totalMintedResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: '0xa2309ff8'
        }, 'latest'],
        id: 1
      })
    });

    const totalMintedData = await totalMintedResponse.json() as RPCResponse<string>;
    if (!totalMintedResponse.ok || totalMintedData.error || !totalMintedData.result || totalMintedData.result === '0x') {
      return {
        passed: false,
        error: 'Contract does not appear to be an NFT collection (missing totalMinted)',
        retryAllowed: true
      };
    }

    return {
      passed: true,
      feedback: `Successfully deployed NFT collection contract! Contract address: ${contractAddress}`,
      nextSteps: ['Claim your voucher to receive the achievement NFT'],
      retryAllowed: false,
      contractAddress,
      method: 'deployment'
    };

  } catch (error) {
    console.error('NFT collection verification error:', error);
    return {
      passed: false,
      error: 'Failed to verify NFT collection deployment',
      retryAllowed: true
    };
  }
}

/**
 * Verifies random number generator contract deployment (Achievement 0043)
 */
async function verifyRandomNumberGenerator(
  txId: string,
  chainId: number,
  expectedClaimant: string,
  context: ValidationContext
): Promise<ValidationResult> {
  try {
    // Get transaction receipt
    const receiptResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txId],
        id: 1
      })
    });

    const receiptData = await receiptResponse.json() as RPCResponse<any>;
    
    if (!receiptResponse.ok || receiptData.error || !receiptData.result) {
      return {
        passed: false,
        error: `Failed to get transaction receipt: ${receiptData.error?.message || 'Transaction not found'}`,
        retryAllowed: true
      };
    }

    const receipt = receiptData.result;
    
    if (receipt.status !== '0x1') {
      return {
        passed: false,
        error: 'Transaction failed on the blockchain',
        retryAllowed: true
      };
    }

    // Verify it was a contract deployment
    if (!receipt.contractAddress) {
      return {
        passed: false,
        error: 'Transaction did not deploy a contract',
        retryAllowed: true
      };
    }

    const contractAddress = receipt.contractAddress;

    // Verify claimant field (immutable in this contract)
    const claimantValidation = await verifyClaimantField(contractAddress, context.rpcUrl, expectedClaimant);
    if (!claimantValidation.isValid) {
      return {
        passed: false,
        error: claimantValidation.error,
        retryAllowed: true
      };
    }

    // Verify reveal() function exists - signature: 0xa475b5dd
    const revealResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: '0xa475b5dd'
        }, 'latest'],
        id: 1
      })
    });

    const revealData = await revealResponse.json() as RPCResponse<string>;
    // Note: reveal() will revert if no commitment found, but we just need to verify the function exists
    // So we check that we got a response (even if it's a revert) and not a missing function error
    if (!revealResponse.ok && revealData.error?.message?.includes('does not exist')) {
      return {
        passed: false,
        error: 'Contract does not appear to be a random number generator (missing reveal function)',
        retryAllowed: true
      };
    }

    // Verify commitments() function exists - signature: 0xe8fcf723
    // This is a view function that won't revert, better for validation
    const dummyAddress = expectedClaimant.toLowerCase().replace('0x', '');
    const commitmentsResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: '0xe8fcf723' + dummyAddress.padStart(64, '0') // Pass claimant address
        }, 'latest'],
        id: 1
      })
    });

    const commitmentsData = await commitmentsResponse.json() as RPCResponse<string>;
    if (!commitmentsResponse.ok || commitmentsData.error) {
      return {
        passed: false,
        error: 'Contract does not appear to be a random number generator (missing commitments mapping)',
        retryAllowed: true
      };
    }

    return {
      passed: true,
      feedback: `Successfully deployed random number generator contract! Contract address: ${contractAddress}`,
      nextSteps: ['Claim your voucher to receive the achievement NFT'],
      retryAllowed: false,
      contractAddress,
      method: 'deployment'
    };

  } catch (error) {
    console.error('Random number generator verification error:', error);
    return {
      passed: false,
      error: 'Failed to verify random number generator deployment',
      retryAllowed: true
    };
  }
}

/**
 * Verifies upgradeable contract (proxy address) for Achievement 0046
 * Note: Users submit the proxy contract address directly, not a transaction hash
 */
async function verifyUpgradeableContract(
  proxyAddress: string,
  chainId: number,
  expectedClaimant: string,
  context: ValidationContext
): Promise<ValidationResult> {
  try {
    const contractAddress = normalizeAddress(proxyAddress);

    // Verify claimant field
    const claimantValidation = await verifyClaimantField(contractAddress, context.rpcUrl, expectedClaimant);
    if (!claimantValidation.isValid) {
      return {
        passed: false,
        error: claimantValidation.error,
        retryAllowed: true
      };
    }

    // Verify EIP-1967 proxy by checking implementation storage slot
    // Slot: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
    // This is bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
    const implementationSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    
    const storageResponse = await fetch(context.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getStorageAt',
        params: [contractAddress, implementationSlot, 'latest'],
        id: 1
      })
    });

    const storageData = await storageResponse.json() as RPCResponse<string>;
    if (!storageResponse.ok || storageData.error) {
      return {
        passed: false,
        error: 'Failed to read proxy storage slot',
        retryAllowed: true
      };
    }
    
    // Check if implementation slot has a non-zero value (indicating it's a proxy)
    const implementationAddress = storageData.result;
    if (!implementationAddress || implementationAddress === '0x' || implementationAddress === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return {
        passed: false,
        error: 'Contract does not appear to be an EIP-1967 proxy (implementation slot is empty)',
        retryAllowed: true
      };
    }

    return {
      passed: true,
      feedback: `Successfully verified upgradeable proxy contract! Proxy address: ${contractAddress}`,
      nextSteps: ['Claim your voucher to receive the achievement NFT'],
      retryAllowed: false,
      contractAddress,
      method: 'deployment'
    };

  } catch (error) {
    console.error('Upgradeable contract verification error:', error);
    return {
      passed: false,
      error: 'Failed to verify upgradeable contract proxy',
      retryAllowed: true
    };
  }
}

/**
 * Routes to the appropriate validation function based on submission type
 */
async function validateSubmission(context: ValidationContext, env?: Bindings): Promise<ValidationResult> {
  switch (context.submissionType) {
    case 'quiz':
      return validateQuizSubmission(context.submissionData as QuizSubmission, context, env);
    
    case 'transaction':
      return validateTransactionSubmission(context.submissionData as TransactionSubmission, context, env);
      
    case 'secret':
      return validateSecretSubmission(context.submissionData as SecretSubmission, context, env);
    
    case 'contract':
      // Achievement 0046: Upgradeable Contract (Proxy Pattern)
      // Users submit the proxy contract address directly
      if (context.achievementNumber === '0046') {
        const contractAddress = (context.submissionData as any).contractAddress;
        
        if (!contractAddress || !isValidEthereumAddress(contractAddress)) {
          return {
            passed: false,
            error: 'Valid contract address is required for achievement 0046',
            retryAllowed: true
          };
        }
        
        const chainId = (context.submissionData as any).chainId || 33101;
        // Verify the claimant field on the contract matches the submitting wallet
        return await verifyUpgradeableContract(contractAddress, chainId, context.walletAddress, context);
      }
      
      // Other contract validations not yet implemented
      return {
        passed: false,
        error: 'Contract validation not yet implemented for this achievement',
        retryAllowed: false
      };
    
    case 'custom':
      // TODO: Implement custom validation logic
      return {
        passed: false,
        error: 'Custom validation not yet implemented',
        retryAllowed: false
      };
    
    default:
      return {
        passed: false,
        error: 'Unknown submission type',
        retryAllowed: false
      };
  }
}

// Submit an achievement completion and issue voucher
voucherRoutes.post('/submit', rateLimit, async (c) => {
  try {
    const body = await c.req.json() as VoucherRequest;
    const { walletAddress, achievementNumber, submissionType, submissionData, metadata } = body;

    // Validate input
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      return c.json({ 
        success: false, 
        error: 'Invalid wallet address' 
      }, 400);
    }

    if (!achievementNumber || typeof achievementNumber !== 'string') {
      return c.json({ 
        success: false, 
        error: 'Invalid achievement number' 
      }, 400);
    }

    if (!submissionType || !['quiz', 'transaction', 'contract', 'custom', 'secret'].includes(submissionType)) {
      return c.json({ 
        success: false, 
        error: 'Invalid submission type. Must be one of: quiz, transaction, contract, custom, secret' 
      }, 400);
    }

    if (!submissionData) {
      return c.json({ 
        success: false, 
        error: 'Submission data is required' 
      }, 400);
    }

    // Validate achievement number exists in ACHIEVEMENT_TYPES
    if (!ACHIEVEMENT_TYPES[achievementNumber]) {
      return c.json({ 
        success: false, 
        error: 'Invalid achievement number - achievement does not exist' 
      }, 400);
    }

    // Check if submission type matches expected type for this achievement
    const expectedType = ACHIEVEMENT_TYPES[achievementNumber];
    if (expectedType && submissionType !== expectedType) {
      return c.json({ 
        success: false, 
        error: `Invalid submission type for achievement ${achievementNumber}. Expected: ${expectedType}` 
      }, 400);
    }

    // Convert achievement number to task code
    const taskCode = achievementNumberToTaskCode(achievementNumber);
    if (taskCode <= 0) {
      return c.json({ 
        success: false, 
        error: 'Invalid achievement number format' 
      }, 400);
    }

    const normalizedWallet = normalizeAddress(walletAddress);
    const db = new DatabaseService(c.env.DB);

    // Check if there's already a successful completion for this wallet/achievement combination
    const existingCompletion = await db.getTrainingCompletion(normalizedWallet, achievementNumber);
    if (existingCompletion && existingCompletion.passed) {
      return c.json({ 
        success: false, 
        error: 'Achievement already completed successfully' 
      }, 409);
    }

    // Validate the submission using type-specific validation
    // Determine RPC URL based on chainId from submission data
    let rpcUrl = c.env.RPC_URL_MAINNET || c.env.RPC_URL; // Default to mainnet
    
    if (submissionType === 'transaction' || submissionType === 'contract') {
      const submittedChainId = (submissionData as any).chainId;
      
      // Use the appropriate RPC based on submitted chainId
      if (submittedChainId === 33101) {
        // Testnet
        rpcUrl = c.env.RPC_URL_TESTNET || c.env.RPC_URL;
      } else if (submittedChainId === 32769) {
        // Mainnet
        rpcUrl = c.env.RPC_URL_MAINNET || c.env.RPC_URL;
      } else if (submittedChainId) {
        // If a chainId was provided but we don't recognize it
        console.warn(`Unknown chainId ${submittedChainId}, defaulting to testnet RPC`);
        rpcUrl = c.env.RPC_URL_TESTNET || c.env.RPC_URL;
      } else {
        // No chainId provided, default to testnet for backward compatibility
        rpcUrl = c.env.RPC_URL_TESTNET || c.env.RPC_URL;
      }
    }
    
    const validationContext: ValidationContext = {
      achievementNumber,
      walletAddress: normalizedWallet,
      rpcUrl,
      submissionType,
      submissionData,
      metadata
    };
    
    const validationResult = await validateSubmission(validationContext, c.env);
    
    // Always store the attempt in the database for tracking
    await db.createWalletData(normalizedWallet);
    
    let voucher: CompletionVoucher | undefined;
    let signature: string | undefined;
    
    // Only create voucher for passing submissions
    if (validationResult.passed) {
      // Create voucher signer
      const signer = new VoucherSigner(
        c.env.ISSUER_PRIVATE_KEY,
        c.env.CONTRACT_ADDRESS,
        parseInt(c.env.CHAIN_ID)
      );

      // Create voucher for the smart contract
      voucher = {
        taskCode,
        wallet: normalizedWallet,
      };

      // Sign voucher
      signature = await signer.signVoucher(voucher);
    }

    // Store in database (including failed attempts for retry tracking)
    await db.createTrainingCompletion({
      wallet_address: normalizedWallet,
      achievement_number: achievementNumber,
      task_code: taskCode,
      submission_type: submissionType,
      submission_data: JSON.stringify(submissionData),
      score: validationResult.score,
      max_score: validationResult.maxScore,
      passed: validationResult.passed,
      voucher_signature: signature,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });

    // Determine which chainId to return based on submission type
    let responseChainId = parseInt(c.env.CHAIN_ID); // Default to mainnet for claiming
    if (submissionType === 'transaction' || submissionType === 'contract') {
      // For transaction/contract submissions, return the chainId they submitted to
      const submittedChainId = (submissionData as any).chainId;
      if (submittedChainId) {
        responseChainId = submittedChainId;
      }
    }

    const response: VoucherResponse = {
      success: validationResult.passed,
      voucher,
      signature,
      contractAddress: c.env.CONTRACT_ADDRESS,
      chainId: responseChainId,
      results: validationResult,
      error: validationResult.passed ? undefined : validationResult.error
    };

    return c.json(response);
  } catch (error) {
    console.error('Error processing achievement submission:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to process achievement submission' 
    }, 500);
  }
});

// Get voucher status for a wallet/achievement
voucherRoutes.get('/status/:walletAddress/:achievementNumber', async (c) => {
  try {
    const walletAddress = c.req.param('walletAddress');
    const achievementNumber = c.req.param('achievementNumber');

    if (!isValidEthereumAddress(walletAddress)) {
      return c.json({ error: 'Invalid wallet address' }, 400);
    }

    if (!achievementNumber || typeof achievementNumber !== 'string') {
      return c.json({ error: 'Invalid achievement number' }, 400);
    }

    const normalizedWallet = normalizeAddress(walletAddress);
    const db = new DatabaseService(c.env.DB);
    
    const completion = await db.getTrainingCompletion(normalizedWallet, achievementNumber);
    
    if (!completion) {
      return c.json({ error: 'No voucher found for this achievement' }, 404);
    }

    return c.json({
      achievementNumber: completion.achievement_number,
      taskCode: completion.task_code,
      walletAddress: completion.wallet_address,
      voucherSigned: !!completion.voucher_signature,
      createdAt: completion.created_at,
    });
  } catch (error) {
    console.error('Error getting voucher status:', error);
    return c.json({ error: 'Failed to get voucher status' }, 500);
  }
});

// Get combined wallet achievements (vouchers + claimed achievements)
voucherRoutes.get('/wallet/:walletAddress', rateLimit, async (c) => {
  try {
    const walletAddress = c.req.param('walletAddress');

    if (!isValidEthereumAddress(walletAddress)) {
      return c.json({ error: 'Invalid wallet address' }, 400);
    }

    const normalizedWallet = normalizeAddress(walletAddress);
    const db = new DatabaseService(c.env.DB);
    
    // Get vouchers from database
    const vouchers = await db.getWalletCompletions(normalizedWallet);
    
    // Get claimed achievements from contract
    const contractReader = new ContractReader(c.env.CONTRACT_ADDRESS, c.env.RPC_URL);
    const claimedAchievements = await contractReader.getWalletAchievementDetails(normalizedWallet);
    
    // Create a map of claimed achievement numbers
    const claimedMap = new Map(
      claimedAchievements.map(achievement => [achievement.achievementNumber, achievement])
    );
    
    // Combine vouchers with claimed status
    const combined = vouchers.map(voucher => ({
      achievementNumber: voucher.achievement_number,
      tokenId: voucher.task_code,
      hasVoucher: true,
      isClaimed: claimedMap.has(voucher.achievement_number),
      voucherSignature: voucher.voucher_signature,
      metadataUri: claimedMap.get(voucher.achievement_number)?.uri,
      createdAt: voucher.created_at,
    }));

    return c.json({
      walletAddress: normalizedWallet,
      contractAddress: c.env.CONTRACT_ADDRESS,
      achievements: combined
    });
  } catch (error) {
    console.error('Error getting combined wallet achievements:', error);
    return c.json({ error: 'Failed to get wallet achievements' }, 500);
  }
});

// List all vouchers generated for a wallet (from our database)
voucherRoutes.get('/list/:walletAddress', async (c) => {
  try {
    const walletAddress = c.req.param('walletAddress');

    if (!isValidEthereumAddress(walletAddress)) {
      return c.json({ error: 'Invalid wallet address' }, 400);
    }

    const normalizedWallet = normalizeAddress(walletAddress);
    const db = new DatabaseService(c.env.DB);
    
    const completions = await db.getWalletCompletions(normalizedWallet);
    
    return c.json({
      walletAddress: normalizedWallet,
      vouchers: completions.map(completion => ({
        achievementNumber: completion.achievement_number,
        taskCode: completion.task_code,
        voucherSigned: !!completion.voucher_signature,
        createdAt: completion.created_at,
      }))
    });
  } catch (error) {
    console.error('Error listing vouchers:', error);
    return c.json({ error: 'Failed to list vouchers' }, 500);
  }
});

// Get unclaimed vouchers for a wallet (vouchers that haven't been submitted to contract yet)
voucherRoutes.get('/unclaimed/:walletAddress', rateLimit, async (c) => {
  try {
    const walletAddress = c.req.param('walletAddress');

    if (!isValidEthereumAddress(walletAddress)) {
      return c.json({ error: 'Invalid wallet address' }, 400);
    }

    const normalizedWallet = normalizeAddress(walletAddress);
    const db = new DatabaseService(c.env.DB);
    
    // Get vouchers from database
    const vouchers = await db.getWalletCompletions(normalizedWallet);
    
    // Get claimed achievements from contract
    const contractReader = new ContractReader(c.env.CONTRACT_ADDRESS, c.env.RPC_URL);
    const claimedAchievements = await contractReader.getWalletAchievementDetails(normalizedWallet);
    
    // Create a set of claimed achievement numbers
    const claimedSet = new Set(
      claimedAchievements.map(achievement => achievement.achievementNumber)
    );
    
    // Filter to only unclaimed vouchers
    const unclaimed = vouchers
      .filter(voucher => !claimedSet.has(voucher.achievement_number))
      .map(voucher => ({
        achievementNumber: voucher.achievement_number,
        taskCode: voucher.task_code,
        voucherSignature: voucher.voucher_signature,
        createdAt: voucher.created_at,
      }));

    return c.json({
      walletAddress: normalizedWallet,
      contractAddress: c.env.CONTRACT_ADDRESS,
      unclaimedVouchers: unclaimed
    });
  } catch (error) {
    console.error('Error getting unclaimed vouchers:', error);
    return c.json({ error: 'Failed to get unclaimed vouchers' }, 500);
  }
});

// Get achievements that a wallet has actually claimed on the blockchain
voucherRoutes.get('/claimed/:walletAddress', rateLimit, async (c) => {
  try {
    const walletAddress = c.req.param('walletAddress');

    if (!isValidEthereumAddress(walletAddress)) {
      return c.json({ error: 'Invalid wallet address' }, 400);
    }

    const normalizedWallet = normalizeAddress(walletAddress);
    
    // Read from smart contract
    const contractReader = new ContractReader(c.env.CONTRACT_ADDRESS, c.env.RPC_URL);
    const achievements = await contractReader.getWalletAchievementDetails(normalizedWallet);
    
    return c.json({
      walletAddress: normalizedWallet,
      contractAddress: c.env.CONTRACT_ADDRESS,
      claimedAchievements: achievements.map(achievement => ({
        achievementNumber: achievement.achievementNumber,
        tokenId: achievement.tokenId,
        hasAchievement: achievement.hasAchievement,
        balance: achievement.balance,
        metadataUri: achievement.uri
      }))
    });
  } catch (error) {
    console.error('Error getting wallet achievements from contract:', error);
    return c.json({ error: 'Failed to get achievements from smart contract' }, 500);
  }
});
