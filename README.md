# Plunder Academy – Training Registry System

This project provides a complete training registry system with smart contracts and a Cloudflare Workers API for automated voucher issuance. It includes an upgradeable `TrainingRegistry` contract that confirms task completions using EIP‑712 "vouchers" signed by approved issuers and optionally mints ERC‑1155 badges (one `tokenId` per task).

## 🏗️ Project Structure

```text
plunder-academy-contracts/
├── contracts/              # Foundry smart contract project (TrainingRegistry)
│   ├── src/                # Solidity contracts
│   ├── test/               # Contract tests
│   ├── script/             # Deployment & utility scripts
│   ├── lib/                # Dependencies (OpenZeppelin)
│   └── foundry.toml        # Foundry configuration
├── contracts-token-factory/ # Token factory smart contracts
│   ├── src/                # PlunderAcademyToken & Factory contracts
│   ├── test/               # Factory contract tests
│   ├── script/             # Factory deployment & utility scripts
│   ├── lib/                # Dependencies (OpenZeppelin, forge-std)
│   └── foundry.toml        # Foundry configuration
├── src/                    # Cloudflare Workers API
│   ├── routes/             # API route handlers
│   ├── utils/              # Utility functions
│   ├── types.ts            # TypeScript type definitions
│   └── index.ts            # Main Workers entry point
├── migrations/             # D1 database schema
├── training/               # Training metadata & assets
├── wrangler.toml          # Cloudflare Workers configuration
└── package.json           # Node.js dependencies
```

## 🔧 Smart Contract Features

- EIP‑712 voucher verification with issuer allowlist
- Per‑wallet per‑task completion tracking
- Optional ERC‑1155 badge mint on completion; badges are soulbound (non-transferable)
- UUPS upgradable, `Ownable2Step`, pausable

## 🚀 API Features

- **Quiz validation system** with automated scoring and feedback
- **Token creation verification** for both factory and manual deployments (achievement 0005)
- **Secret achievements system** with hidden challenges and special rewards (1000+ series)
- **Multiple submission types**: quiz, transaction, contract, custom, secret validation
- **Rich feedback system** with detailed results and retry logic
- **Automated voucher signing** for passing submissions only
- **D1 database** for wallet data and completion tracking
- **Rate limiting** and security measures
- **RESTful API** for wallet management
- **Health checks** and monitoring
- **Feedback & Analytics API** for tracking AI tool usage and learning outcomes
  - Track AI interactions (auditor & chat usage)
  - Collect user feedback on AI responses (thumbs up/down, ratings)
  - Module completion surveys
  - User and platform-wide analytics
  - Leaderboard system

## 📋 Prerequisites

### For Smart Contracts

- Install Foundry: `https://book.getfoundry.sh/getting-started/installation`
- Install OpenZeppelin libraries (already included in `contracts/lib/`)

### For API

- Node.js 18+ and npm
- Cloudflare account with Workers and D1 access
- Wrangler CLI: `npm install -g wrangler`

## 🛠️ Setup

### 1. Environment Variables

Set these environment variables (Linux/macOS syntax [[memory:5848151]]):

```bash
# Blockchain RPC URLs (for contract deployment scripts)
export RPC_URL_MAINNET="https://api.zilliqa.com"
export RPC_URL_TESTNET="https://api.testnet.zilliqa.com"

# Private keys
export PRIVATE_KEY="0x..."              # For contract deployment
export ISSUER_PRIVATE_KEY="0x..."       # For API voucher signing

# Contract addresses (set after deployment)
export PROXY="0x..."                    # TrainingRegistry proxy address
export CONTRACT_ADDRESS="0x..."         # Same as PROXY
export ISSUER_ADDRESS="0x..."           # Address of ISSUER_PRIVATE_KEY

# Token Factory addresses (set after factory deployment)
export NEXT_PUBLIC_FACTORY_ADDRESS_TESTNET="0x..."  # Factory on testnet
export NEXT_PUBLIC_FACTORY_ADDRESS_MAINNET="0x..."  # Factory on mainnet

# Quiz data and secret answers (External JSON files)
export QUIZ_DATA_URL="https://your-domain.com/private/quiz-data.json"
export SECRET_ANSWERS_URL="https://your-domain.com/private/secret-answers.json"

# API configuration
export CHAIN_ID="33101"                 # Zilliqa testnet (for claiming achievements)
```

**Note:** The API RPC URLs are configured in `wrangler.toml` (see below), not as shell environment variables.

### Externalizing Quiz Data and Secret Answers

To keep quiz answers and secret answers private when open-sourcing your repository, the API loads this sensitive data from external JSON files hosted at URLs you control.

#### Quiz Data Configuration

1. **Host the JSON file**: Upload `training/quiz-data.json` to a secure location (private S3 bucket, private R2 bucket, etc.)
2. **Set environment variable**: Configure `QUIZ_DATA_URL` to point to your hosted file
3. **Caching**: The API caches quiz data for 1 hour to minimize external requests

**Quiz Data Format** (`quiz-data.json`):
```json
{
  "0001": {
    "passingScore": 80,
    "questions": [
      { "id": "q1", "question": "Module 1 Question 1", "options": [], "correctAnswer": "A", "points": 6, "explanation": "" },
      { "id": "q2", "question": "Module 1 Question 2", "options": [], "correctAnswer": "B", "points": 6, "explanation": "" },
      { "id": "q3", "question": "Module 1 Question 3 - Word Jumble", "options": [], "correctAnswer": { "type": "word-jumble", "data": { "word": "BLOCKCHAIN" } }, "points": 6, "explanation": "", "type": "word-jumble" },
      { "id": "q4", "question": "Module 1 Question 4", "options": [], "correctAnswer": "A", "points": 6, "explanation": "" },
      { "id": "q5", "question": "Module 1 Question 5", "options": [], "correctAnswer": "B", "points": 6, "explanation": "" },
      { "id": "q6", "question": "Module 1 Question 6", "options": [], "correctAnswer": "B", "points": 6, "explanation": "" },
      { "id": "q7", "question": "Module 1 Question 7", "options": [], "correctAnswer": "B", "points": 6, "explanation": "" },
      { "id": "q8", "question": "Module 1 Question 8", "options": [], "correctAnswer": "B", "points": 6, "explanation": "" },
      { "id": "q9", "question": "Module 1 Question 9", "options": [], "correctAnswer": "B", "points": 6, "explanation": "" },
      { "id": "q10", "question": "Module 1 Question 10", "options": [], "correctAnswer": "A,B,C", "points": 6, "explanation": "" },
      { "id": "q11", "question": "Module 1 Question 11", "options": [], "correctAnswer": "B", "points": 6, "explanation": "" },
      { "id": "q12", "question": "Module 1 Question 12", "options": [], "correctAnswer": "A", "points": 6, "explanation": "" },
      { "id": "q13", "question": "Module 1 Question 13", "options": [], "correctAnswer": "A", "points": 6, "explanation": "" },
      { "id": "q14", "question": "Module 1 Question 14", "options": [], "correctAnswer": "B", "points": 6, "explanation": "" },
      { "id": "q15", "question": "Module 1 Question 15", "options": [], "correctAnswer": "B", "points": 6, "explanation": "" },
      { "id": "q16", "question": "Module 1 Question 16", "options": [], "correctAnswer": "B", "points": 6, "explanation": "" }
    ]
  },
```

####Secret Answers Configuration

1. **Host the JSON file**: Upload `training/secret-answers.json` to a secure location
2. **Set environment variable**: Configure `SECRET_ANSWERS_URL` to point to your hosted file
3. **Caching**: The API caches secret answers for 1 hour

**Secret Answers Format** (`secret-answers.json`):
```json
{
  "1001": "answer1",
  "1002": "answer2",
  "1003": "answer3"
}
```

#### Security Considerations

- ⚠️ **Never commit** `quiz-data.json` or `secret-answers.json` to your public repository
- ✅ **Use private hosting** with authentication/access controls
- ✅ **Restrict CORS** to only your API domain if hosting on CDN
- ✅ **Monitor access logs** for unauthorized attempts
- ✅ **Rotate URLs periodically** if answers are compromised

#### Setting Cloudflare Secrets

```bash
# Set quiz data URL
wrangler secret put QUIZ_DATA_URL

# Set secret answers URL
wrangler secret put SECRET_ANSWERS_URL

# For development environment
wrangler secret put QUIZ_DATA_URL --env development
wrangler secret put SECRET_ANSWERS_URL --env development
```


### 2. Install Dependencies

```bash
# Install API dependencies
npm install

# Install contract dependencies (if needed)
cd contracts && forge install
```

### 3. Deploy Smart Contracts

```bash
cd contracts

# Deploy to testnet
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --broadcast --legacy \
  --sig "run(string,string,string)" \
  "https://static.plunderswap.com/training/" "TrainingCert" "1"

# Note the proxy address from output and export it
export PROXY=<proxy_address_from_output>
export CONTRACT_ADDRESS=$PROXY
```

### 3.1. Deploy Token Factory (for Achievement 0005)

Deploy the token factory contracts for ERC-20 token creation:

```bash
cd contracts-token-factory

# Deploy to testnet
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $RPC_URL_TESTNET \
  --broadcast --legacy \
  --sig "run()"

# Deploy to mainnet
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $RPC_URL_MAINNET \
  --broadcast --legacy \
  --sig "run()"

# Note the factory addresses from output and export them
export NEXT_PUBLIC_FACTORY_ADDRESS_TESTNET=<factory_address_from_testnet>
export NEXT_PUBLIC_FACTORY_ADDRESS_MAINNET=<factory_address_from_mainnet>
```

### 4. Configure Smart Contract

Add your API as an approved issuer:

```bash
cd contracts
forge script script/Configure.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "issuer(address,address,bool)" $PROXY $ISSUER_ADDRESS true
```

### 5. Set Up Cloudflare D1 Database

#### Production Database
```bash
# Create production database
npm run db:create

# Apply migrations to remote database (production)
npm run db:migrate

# Set up local database for testing production config
npm run db:local
```

#### Development Database (Optional)
```bash
# Create separate development database
npm run db:create:dev

# Update wrangler.toml with the dev database ID (see output from create command)
# Then apply migrations to development database
npm run db:migrate:dev

# Set up local database using development environment
npm run db:local:dev
```

#### Database Migrations

The system includes three migrations:

1. **001-initial.sql** - Initial schema (wallet data, training completions, issuers, rate limiting)
2. **002-update-submissions.sql** - Multiple submission types, scoring system, retry functionality
3. **003-feedback-analytics.sql** - Feedback & analytics tables (ai_interactions, ai_feedback, module_feedback)

All migrations are automatically applied when running `npm run db:migrate`

**Note:** With wrangler 4.32+, the default is now local execution. The `--env development` flag uses the development database configuration.

### 6. Configure Wrangler

1. Login to Cloudflare: `npx wrangler login`

2. Update `wrangler.toml` with your database IDs (get from step 5 output):
   ```toml
   # Production database
   [[d1_databases]]
   database_id = "46bcf7be-5dc9-4f84-959a-42bb2433906c"  # From npm run db:create

   # Development database  
   [[env.development.d1_databases]]
   database_id = "your-dev-database-id"  # From npm run db:create:dev
   ```

   **RPC URLs Configuration:**  
   The API needs access to **both** mainnet and testnet RPCs simultaneously to route transaction validations based on the submitted chainId. These are configured in `wrangler.toml`:
   ```toml
   [vars]
   RPC_URL = "https://api.zilliqa.com"              # Default/fallback
   RPC_URL_MAINNET = "https://api.zilliqa.com"      # For chainId 32769
   RPC_URL_TESTNET = "https://api.testnet.zilliqa.com"  # For chainId 33101
   ```
   These are already set correctly in `wrangler.toml` - no changes needed unless using custom RPC endpoints.

3. Set secrets for production:
   ```bash
   wrangler secret put ISSUER_PRIVATE_KEY
   wrangler secret put CONTRACT_ADDRESS
   wrangler secret put CHAIN_ID
   wrangler secret put NEXT_PUBLIC_FACTORY_ADDRESS_TESTNET
   wrangler secret put NEXT_PUBLIC_FACTORY_ADDRESS_MAINNET
   wrangler secret put QUIZ_DATA_URL
   wrangler secret put SECRET_ANSWERS_URL
   ```

4. Set secrets for development environment:
   ```bash
   wrangler secret put ISSUER_PRIVATE_KEY --env development
   wrangler secret put CONTRACT_ADDRESS --env development  
   wrangler secret put CHAIN_ID --env development
   wrangler secret put NEXT_PUBLIC_FACTORY_ADDRESS_TESTNET --env development
   wrangler secret put NEXT_PUBLIC_FACTORY_ADDRESS_MAINNET --env development
   wrangler secret put QUIZ_DATA_URL --env development
   wrangler secret put SECRET_ANSWERS_URL --env development
   ```

**Note:** RPC URLs (`RPC_URL`, `RPC_URL_MAINNET`, `RPC_URL_TESTNET`) are configured in `wrangler.toml`, not as secrets.

## 📦 R2 Training Assets Upload

The training metadata and images need to be uploaded to Cloudflare R2 storage to be accessible via your custom domain.

### 1. Set Up R2 Environment Variables

**Option A: Environment Variables** [[memory:5848151]]

```bash
# R2 Storage configuration
export R2_ACCOUNT_ID="your-cloudflare-account-id"
export R2_ACCESS_KEY_ID="your-r2-access-key-id"
export R2_ACCESS_KEY_SECRET="your-r2-access-key-secret"
export R2_BUCKET_NAME="plunder-training-assets"
```

**Option B: .env File (Recommended for development)**

Create a `.env` file in your project root:

```bash
# .env
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_ACCESS_KEY_SECRET=your-r2-access-key-secret
R2_BUCKET_NAME=plunder-training-assets
```

The upload script automatically loads variables from `.env` files.

### 2. Create R2 Bucket

Create your R2 bucket via the Cloudflare dashboard or CLI:

```bash
# Via wrangler CLI
wrangler r2 bucket create plunder-training-assets

# Or create via Cloudflare dashboard at https://dash.cloudflare.com/r2
```

### 3. Configure R2 API Token

1. Go to Cloudflare dashboard → My Profile → API Tokens
2. Create a new token with:
   - **Permissions**: `Cloudflare R2:Edit`
   - **Account Resources**: Include your account
   - **Zone Resources**: All zones (or specific zones if preferred)

### 4. Convert Images for Social Media (Optional)

If you need PNG versions of achievement cards for social media (Twitter/X, etc.), use the conversion script:

```bash
# Install ImageMagick and pngquant in WSL
sudo apt-get update
sudo apt-get install imagemagick pngquant

# Convert WebP achievement cards to optimized PNGs
# Resizes to 800px wide and compresses for optimal file size
chmod +x scripts/convert-cards-to-png.sh
./scripts/convert-cards-to-png.sh
```

**Conversion Features:**
- ✅ Resizes images to 800px width (perfect for Twitter/social media)
- ✅ Maintains aspect ratio automatically
- ✅ High-quality lossy compression via pngquant (65-80% reduction)
- ✅ Fallback compression for difficult images
- ✅ Only converts main card files (e.g., `0001.webp`, `0002.webp`)
- ✅ Skips variant files (`*-plain-card.webp`, `*-trinket.webp`, etc.)

**Results:** ~300-700 KB PNG files optimized for social sharing

### 5. Upload Training Assets

Install dependencies and run the upload script:

```bash
# Install dependencies (includes AWS SDK for R2 uploads)
npm install

# Upload only missing files (default, recommended)
npm run upload:training

# Upload all files, overwriting existing (when needed)
node scripts/upload-training.js --force
```

The script uploads:

- `training/*.json` → R2 bucket `training/` folder (includes regular achievements 0001-0005 and secret achievements 1000+)
- `training/images/*` → R2 bucket `training/images/` folder (includes all image formats: WebP, PNG, etc.)

### 6. Configure R2 Custom Domain (Optional)

For production, set up a custom domain for your R2 bucket:

1. Go to Cloudflare dashboard → R2 → your bucket → Settings
2. Add custom domain (e.g., `static.yourdomain.com`)
3. Update your contract's base URI to use the custom domain:

```bash
cd contracts
forge script script/Configure.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "baseURI(address,string)" $PROXY "https://static.yourdomain.com/training/"
```

### 7. Verify Upload

After uploading, your training assets will be accessible at:

- **JSON metadata**: `https://your-bucket.your-account-id.r2.cloudflarestorage.com/training/0001.json`
- **Images**: `https://your-bucket.your-account-id.r2.cloudflarestorage.com/training/images/0001.png`

Or with custom domain:

- **JSON metadata**: `https://static.yourdomain.com/training/0001.json`
- **Images**: `https://static.yourdomain.com/training/images/0001.png`

### R2 Upload Script Features

- ✅ **Smart uploads** - Only uploads missing files by default
- ✅ **Force mode** - Use `--force` flag to overwrite all files when needed  
- ✅ **Validates environment variables** - Clear error messages
- ✅ **Proper MIME types** - Sets correct Content-Type headers for all formats (JSON, PNG, WebP, etc.)
- ✅ **Recursive uploads** - Automatically uploads all files in `training/` and subdirectories
- ✅ **Cache headers** - 1-year cache for performance
- ✅ **Upload summary** - Shows uploaded/skipped/failed counts

## 🔄 Environment Workflow

### How Wrangler Environments Work

Your `wrangler.toml` defines two environments:

- **Production (default)**: Uses `plunder-academy-db` database, mainnet RPC
- **Development**: Uses `plunder-academy-db-dev` database, testnet RPC

### Commands by Environment

| Task | Production | Development |
|------|------------|-------------|
| **Local Dev** | `wrangler dev` | `npm run dev` (uses `--env development`) |
| **Deploy** | `npm run deploy` | `npm run deploy:dev` |
| **Database Setup** | `npm run db:local` | `npm run db:local:dev` |
| **Upload Training** | `npm run upload:training` | `npm run upload:training` |
| **Set Secrets** | `wrangler secret put KEY` | `wrangler secret put KEY --env development` |

### Recommended Workflow

1. **Development**: Use `npm run dev` (development environment with testnet)
2. **Testing**: Deploy to development with `npm run deploy:dev`  
3. **Production**: Deploy with `npm run deploy` (production environment with mainnet)

## 🚀 Development

### Run API Locally

```bash
# Run with development environment (uses dev database config)
npm run dev

# This is equivalent to: wrangler dev --env development
```

### Test Smart Contracts

```bash
cd contracts
forge test --rpc-url $RPC_URL_TESTNET
```

### Deploy API

```bash
# Deploy to production
npm run deploy

# Deploy to development/staging
npm run deploy:dev
```

## 📡 API Endpoints

### Feedback & Analytics

#### `POST /api/v1/feedback/ai-interaction`

Track AI tool usage (auditor & chat).

**Request:**
```json
{
  "id": "uuid-v4",
  "walletAddress": "0x...",
  "toolType": "auditor",
  "inputLength": 1234,
  "outputLength": 5678,
  "modelUsed": "gpt-4",
  "durationMs": 3500,
  "vulnerabilitiesFound": 3,
  "queryCategory": "debugging",
  "currentModule": "island1-module1",
  "sessionId": "session-uuid"
}
```

#### `POST /api/v1/feedback/ai-response`

Submit feedback on AI responses (thumbs up/down, ratings).

**Request:**
```json
{
  "interactionId": "uuid",
  "walletAddress": "0x...",
  "toolType": "auditor",
  "feedbackType": "thumbs_up",
  "feedbackValue": "up",
  "qualityRating": 4
}
```

#### `POST /api/v1/feedback/module-completion`

Submit module completion feedback survey.

**Request:**
```json
{
  "walletAddress": "0x...",
  "moduleSlug": "island1-module1",
  "achievementCodes": ["0001"],
  "contentDifficulty": 3,
  "contentClarity": 5,
  "practicalValue": 4,
  "paceAppropriateness": 4,
  "whatWorkedWell": "Great explanations",
  "timeSpentMinutes": 45,
  "aiToolsHelpful": true
}
```

#### `GET /api/v1/analytics/user/:walletAddress`

Get user-specific analytics (AI usage, feedback, module progress).

#### `GET /api/v1/analytics/summary?timeframe=30d`

Get comprehensive platform-wide analytics summary.

**Query params:** `?timeframe=30d` (optional: 7d, 30d, 90d, or "all" for all-time data)

**Response includes:**
- Platform stats (users, interactions, satisfaction)
- Tools breakdown (auditor vs chat usage with feedback)
- Module stats (completions, ratings, time spent)
- Query categories (chat query types with satisfaction)
- Time series (daily data points for graphs)
- Recent activity (latest 50 interactions)

#### `GET /api/v1/analytics/text-feedback?limit=50&timeframe=30d`

Get detailed text feedback and ratings from users on AI tool responses.

**Query params:**
- `limit=50` (optional: 1-100, default: 50)
- `timeframe=30d` (optional: 7d, 30d, 90d, or "all" for all-time, default: 30d)

**Response includes text and rating feedback only** (excludes thumbs up/down)

#### `GET /api/v1/analytics/module-feedback?limit=50&timeframe=30d`

Get module completion survey feedback with text comments.

**Query params:**
- `limit=50` (optional: 1-100, default: 50)
- `timeframe=30d` (optional: 7d, 30d, 90d, or "all" for all-time, default: 30d)

**Only returns feedback that includes at least one text comment** (whatWorkedWell, suggestionsForImprovement, or additionalTopicsWanted)

**Response example:**
```json
{
  "timeframe": "30d",
  "feedback": [
    {
      "id": 1,
      "walletAddress": "0x...",
      "moduleSlug": "island1-module1",
      "contentDifficulty": 3,
      "contentClarity": 5,
      "practicalValue": 4,
      "paceAppropriateness": 4,
      "whatWorkedWell": "Great explanations and examples!",
      "suggestionsForImprovement": "More interactive demos",
      "additionalTopicsWanted": "Advanced cryptography",
      "timeSpentMinutes": 90,
      "externalResourcesUsed": false,
      "aiToolsHelpful": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### `GET /api/v1/analytics/leaderboard?limit=10&timeframe=30d`

Get top learners leaderboard.

**Query params:** 
- `limit=10` (optional: 1-100, default: 10)
- `timeframe=30d` (optional: 7d, 30d, 90d, or "all" for all-time, default: 30d)

#### `GET /api/v1/analytics/ai-costs?timeframe=7d`

Get AI tool cost analytics with token usage and cost breakdowns by tool type.

**Pricing Model:** `openai/gpt-oss-120b`
- Input tokens: $0.15 per 1M tokens
- Output tokens: $0.60 per 1M tokens

**Query params:**
- `timeframe=7d` (optional: 1d, 7d, 30d, 90d - defaults to 7d)

**Response example:**
```json
{
  "timeframe": "7d",
  "period": {
    "startDate": "2024-10-16T00:00:00.000Z",
    "endDate": "2024-10-23T00:00:00.000Z"
  },
  "pricing": {
    "model": "openai/gpt-oss-120b",
    "inputPer1M": 0.15,
    "outputPer1M": 0.60,
    "currency": "USD"
  },
  "overall": {
    "totalInteractions": 1250,
    "totalInputTokens": 3500000,
    "totalOutputTokens": 1200000,
    "totalTokens": 4700000,
    "avgInputTokens": 2800,
    "avgOutputTokens": 960,
    "avgTotalTokens": 3760,
    "avgDurationMs": 2450,
    "totalInputCost": 0.53,
    "totalOutputCost": 0.72,
    "totalCost": 1.25,
    "avgCostPerInteraction": 0.001000
  },
  "byToolType": [
    {
      "toolType": "auditor",
      "totalInteractions": 750,
      "avgInputTokens": 3200,
      "avgOutputTokens": 1100,
      "avgDurationMs": 2800,
      "avgInputCost": 0.000480,
      "avgOutputCost": 0.000660,
      "avgTotalCost": 0.001140,
      "totalInputCost": 0.36,
      "totalOutputCost": 0.50,
      "totalCost": 0.86
    },
    {
      "toolType": "chat",
      "totalInteractions": 500,
      "avgInputTokens": 2100,
      "avgOutputTokens": 750,
      "avgDurationMs": 1850,
      "avgInputCost": 0.000315,
      "avgOutputCost": 0.000450,
      "avgTotalCost": 0.000765,
      "totalInputCost": 0.16,
      "totalOutputCost": 0.23,
      "totalCost": 0.39
    }
  ]
}
```

**Testing:**
```bash
# Run comprehensive test suite
./scripts/test-feedback-api.sh

# Test AI costs endpoint
./scripts/test-ai-costs.sh

# Test against production
API_URL=https://your-api.workers.dev ./scripts/test-feedback-api.sh
API_URL=https://your-api.workers.dev ./scripts/test-ai-costs.sh
```

### Achievement Submission and Voucher Management

#### `POST /api/v1/vouchers/submit`

Submit an achievement completion and receive detailed results with optional voucher for passing submissions.

**Request Format:**

Quizzes now support mixed question types including interactive elements. All answers are submitted as strings within the `answers` object. Interactive element answers are submitted as stringified JSON:

```json
{
  "walletAddress": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7",
  "achievementNumber": "0001",
  "submissionType": "quiz",
  "submissionData": {
    "answers": {
      "q1": "B",
      "q2": "B", 
      "q3": "{\"type\":\"word-jumble\",\"userResponse\":{\"word\":\"BLOCKCHAIN\",\"timeSpent\":45}}",
      "q4": "A",
      "q5": "B",
      "q6": "{\"type\":\"concept-matching\",\"userResponse\":{\"pairs\":[{\"conceptId\":\"gas\",\"definitionId\":\"def-gas\"}]}}"
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "timeSpent": 120
  }
}
```

**Interactive Element Answer Formats:**

All interactive element answers follow this structure when stringified:

```json
{
  "type": "element-type",
  "userResponse": {
    // Element-specific response data
  }
}
```

Examples:
- **Word Jumble**: `{"type":"word-jumble","userResponse":{"word":"BLOCKCHAIN","timeSpent":45}}`
- **Concept Matching**: `{"type":"concept-matching","userResponse":{"pairs":[{"conceptId":"gas","definitionId":"def-gas"}]}}`
- **Timeline Builder**: `{"type":"timeline-builder","userResponse":{"sequence":["evt-1","evt-2","evt-3"]}}`
- **True/False**: `{"type":"true-false-statements","userResponse":{"classifications":[{"id":"stmt-1","answer":true}]}}`
- **Drag & Drop**: `{"type":"drag-drop-puzzle","userResponse":{"sequence":["step-1","step-2","step-3"]}}`

**Success Response (Passed):**

```json
{
  "success": true,
  "voucher": {
    "taskCode": 1,
    "wallet": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7"
  },
  "signature": "0x1edc5d5b9c98899b6b3d856e38dd97ac4cea91823277684746f9a85c0aea75fd...",
  "contractAddress": "0x1dAC4421F77C43931c8f2671665f1b72cC4082ef",
  "chainId": 33101,
  "results": {
    "passed": true,
    "score": 48,
    "maxScore": 96,
    "passingScore": 80,
    "totalQuestions": 16,
    "correctAnswers": 8,
    "timeSpent": 120,
    "accuracy": 50.0,
    "feedback": "Congratulations! You scored 48/96 (50.0%) and passed the quiz.",
    "nextSteps": ["Claim your voucher to receive the achievement NFT"],
    "retryAllowed": false
  }
}
```

**Failure Response (Failed Quiz):**

```json
{
  "success": false,
  "results": {
    "passed": false,
    "score": 36,
    "maxScore": 96,
    "passingScore": 80,
    "totalQuestions": 16,
    "correctAnswers": 6,
    "timeSpent": 120,
    "accuracy": 37.5,
    "feedback": "You scored 36/96 (37.5%). You need 80% to pass. Review the material and try again.",
    "nextSteps": [
      "Review the course materials",
      "Focus on areas where you got questions wrong", 
      "Take the quiz again when ready"
    ],
    "retryAllowed": true
  },
  "error": "Quiz score below passing threshold"
}
```

**Submission Types:**

- **`quiz`**: Multiple choice questions with automated scoring (achievements 0001-0004)
- **`transaction`**: Blockchain transaction verification (achievement 0005 - token creation)
- **`secret`**: Hidden challenges requiring secret answers (achievements 1000+ series)
- **`contract`**: Smart contract deployment validation (future use)
- **`custom`**: Custom validation logic (future use)

**Achievement 0005 (Token Creation) Submission:**

```json
{
  "walletAddress": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7",
  "achievementNumber": "0005",
  "submissionType": "transaction",
  "submissionData": {
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "chainId": 33101,
    "claimantAddress": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7",
    "method": "factory"  // OR "deployment"
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Success Response (Token Creation):**

```json
{
  "success": true,
  "voucher": {
    "taskCode": 5,
    "wallet": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7"
  },
  "signature": "0x1edc5d5b9c98899b6b3d856e38dd97ac4cea91823277684746f9a85c0aea75fd...",
  "contractAddress": "0x1dAC4421F77C43931c8f2671665f1b72cC4082ef",
  "chainId": 33101,
  "results": {
    "passed": true,
    "feedback": "Successfully created token via factory! Token address: 0x...",
    "tokenAddress": "0x...",
    "tokenName": "My First Token",
    "tokenSymbol": "MFT",
    "method": "factory",
    "nextSteps": ["Claim your voucher to receive the achievement NFT"],
    "retryAllowed": false
  }
}
```

**Secret Achievement Submission (Achievement 1001):**

Secret achievements are special hidden challenges that require users to discover secret answers through exploration, easter eggs, or hidden content within the platform.

```json
{
  "walletAddress": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7",
  "achievementNumber": "1001",
  "submissionType": "secret",
  "submissionData": {
    "secretAnswer": "FIRSTSECRET"
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Success Response (Secret Achievement):**

```json
{
  "success": true,
  "voucher": {
    "taskCode": 1001,
    "wallet": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7"
  },
  "signature": "0x1edc5d5b9c98899b6b3d856e38dd97ac4cea91823277684746f9a85c0aea75fd...",
  "contractAddress": "0x1dAC4421F77C43931c8f2671665f1b72cC4082ef",
  "chainId": 33101,
  "results": {
    "passed": true,
    "feedback": "Congratulations! You discovered the secret and unlocked this special achievement!",
    "nextSteps": ["Claim your voucher to receive the special achievement NFT"],
    "retryAllowed": false
  }
}
```

**Failure Response (Secret Achievement):**

```json
{
  "success": false,
  "results": {
    "passed": false,
    "feedback": "The secret answer is incorrect. Keep exploring to find the right answer.",
    "nextSteps": [
      "Look for clues in the training materials or hidden content",
      "Try again when you find the secret"
    ],
    "retryAllowed": true
  },
  "error": "Secret answer is incorrect"
}
```

#### `GET /api/v1/vouchers/wallet/:walletAddress`

Get combined view of wallet's vouchers and claimed achievements.

**Response:**

```json
{
  "walletAddress": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7",
  "contractAddress": "0x1dAC4421F77C43931c8f2671665f1b72cC4082ef",
  "achievements": [
    {
      "achievementNumber": "0001",
      "tokenId": 1,
      "hasVoucher": true,
      "isClaimed": true,
      "voucherSignature": "0x...",
      "metadataUri": "https://static.plunderswap.com/training/0001.json",
      "createdAt": "2024-08-23T10:30:00Z"
    }
  ]
}
```

#### `GET /api/v1/vouchers/unclaimed/:walletAddress`

Get vouchers that haven't been claimed on the blockchain yet.

**Response:**

```json
{
  "walletAddress": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7",
  "contractAddress": "0x1dAC4421F77C43931c8f2671665f1b72cC4082ef",
  "unclaimedVouchers": [
    {
      "achievementNumber": "0002",
      "taskCode": 2,
      "voucherSignature": "0x...",
      "createdAt": "2024-08-23T11:00:00Z"
    }
  ]
}
```

#### `GET /api/v1/vouchers/claimed/:walletAddress`

Get achievements that have been claimed on the blockchain.

**Response:**

```json
{
  "walletAddress": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7",
  "contractAddress": "0x1dAC4421F77C43931c8f2671665f1b72cC4082ef",
  "claimedAchievements": [
    {
      "achievementNumber": "0001",
      "tokenId": 1,
      "hasAchievement": true,
      "balance": 1,
      "metadataUri": "https://static.plunderswap.com/training/0001.json"
    }
  ]
}
```

#### `GET /api/v1/vouchers/status/:walletAddress/:achievementNumber`

Get the status of a specific achievement submission.

**Response:**

```json
{
  "achievementNumber": "0001",
  "taskCode": 1,
  "walletAddress": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7",
  "voucherSigned": true,
  "createdAt": "2024-08-23T10:30:00Z"
}
```

### Wallet Management

#### `GET /api/v1/wallets/:walletAddress`

Get comprehensive wallet data with vouchers and claimed achievements.

#### `PUT /api/v1/wallets/:walletAddress/metadata`

Update wallet metadata.

#### `GET /api/v1/wallets/:walletAddress/stats`

Get wallet statistics including voucher and claim counts.

### Health Checks

- `GET /health` - Basic health check
- `GET /health/db` - Database connectivity check
- `GET /health/detailed` - Detailed system status

## 🔄 Simplified Workflow

### 1. User completes achievement

**Quiz Achievement (0001-0004):**
```bash
curl -X POST https://your-api.workers.dev/api/v1/vouchers/submit \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7",
    "achievementNumber": "0001",
    "submissionType": "quiz",
    "submissionData": {
      "answers": {
        "q1": "B",
        "q2": "B",
        "q3": "B",
        "q4": "A",
        "q5": "B"
      }
    },
    "metadata": {
      "timestamp": "2024-01-15T10:30:00Z",
      "timeSpent": 120
    }
  }'
```

**Secret Achievement (1000+ series):**
```bash
curl -X POST https://your-api.workers.dev/api/v1/vouchers/submit \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7",
    "achievementNumber": "1001",
    "submissionType": "secret",
    "submissionData": {
      "secretAnswer": "FIRSTSECRET"
    },
    "metadata": {
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }'
```

### 2. Frontend submits voucher to smart contract

The API returns a signed voucher that the frontend immediately uses with the smart contract's `submitVoucher()` function.

### 3. Check achievements status

```bash
# Get combined view (vouchers + claims)
curl https://your-api.workers.dev/api/v1/vouchers/wallet/0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7

# Get only unclaimed vouchers
curl https://your-api.workers.dev/api/v1/vouchers/unclaimed/0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7

# Get only claimed achievements
curl https://your-api.workers.dev/api/v1/vouchers/claimed/0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7
```

## 🔐 Smart Contract Usage

### Submit a Voucher (CLI)

After receiving a voucher from the API:

```bash
cd contracts
export TASK_CODE=1
export SIGNATURE=<signature_from_api>

forge script script/SubmitVoucher.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "run(address,uint256,bytes)" \
  $PROXY $TASK_CODE $SIGNATURE
```

### Query Achievements

```bash
cd contracts
# List all achievements for a wallet
forge script script/State.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --sig "list(address,address)" $PROXY $LEARNER_WALLET

# Check specific achievement
forge script script/State.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --sig "check(address,address,uint256)" $PROXY $LEARNER_WALLET 1
```

## 🕵️ Secret Achievements System

The API supports special secret achievements (1000+ series) that require users to discover hidden answers through exploration of the platform.

### **How Secret Achievements Work**

1. **Discovery-Based**: Users must explore the platform to find clues and hidden content
2. **Simple Validation**: Just wallet address + secret answer (case-sensitive)
3. **Instant Feedback**: Users know immediately if they found the right answer
4. **Retry Allowed**: Users can keep trying different answers until they get it right

### **Configuration**

Secret achievements are configured in `src/routes/vouchers.ts`:

```typescript
// Add new secret achievement types
const ACHIEVEMENT_TYPES: Record<string, "quiz" | "transaction" | "contract" | "custom" | "secret"> = {
  '1001': 'secret',  // First secret achievement
  '1002': 'secret',  // Add more as needed
};

// Configure secret answers
const SECRET_ANSWERS: Record<string, string> = {
  '1001': 'FIRSTSECRET',    // First secret achievement answer
  '1002': 'ANOTHERSECRET',  // Add more secret answers
};
```

### **Adding New Secret Achievements**

1. Add entry to `ACHIEVEMENT_TYPES` mapping
2. Add secret answer to `SECRET_ANSWERS` mapping  
3. Create metadata files (`1001.json`, `1001-poly-card.webp` etc.) in `training/` directory
4. Upload assets to R2 with `npm run upload:training`
5. Users can start discovering and claiming the new secret achievement!

## 🧠 Quiz Validation System

The API includes a comprehensive quiz validation system for achievements 0001-0004 with support for both traditional multiple choice and interactive elements:

### **Scoring System**

- **80% passing threshold** across all modules
- **Weighted scoring** - different questions have different point values
- **Detailed feedback** - score breakdown, accuracy percentage, time tracking
- **Retry system** - unlimited retries for failed attempts, only passing submissions get vouchers
- **Mixed question types** - traditional multiple choice + interactive elements in single quiz
- **Partial credit** - interactive elements can award partial points based on correctness

### **Interactive Element Grading**

The API supports grading for 5 types of interactive elements:

1. **Word Jumble** - Binary scoring (full points or 0)
   - Exact match required (case-insensitive)
   - Example: "BLOCKCHAIN" must match exactly

2. **Concept Matching** - Partial credit based on correct pairs
   - Each correct pair earns proportional points
   - 4 pairs = 25% points per correct pair
   - Example: 3/4 correct = 75% of question points

3. **Timeline Builder** - Partial credit based on correct positions
   - Each event in correct position earns proportional points
   - Order matters: ["evt-1", "evt-2", "evt-3"]
   - Example: 4/5 in correct positions = 80% of question points

4. **True/False Statements** - Partial credit per correct classification
   - Each statement classified correctly earns proportional points
   - Example: 3/4 correct = 75% of question points

5. **Drag & Drop Puzzle** - Partial credit based on correct positions
   - Each block in correct position earns proportional points
   - Example: 4/5 blocks correct = 80% of question points

### **Security Features**

- **Answer protection** - Correct answers never exposed in API responses [[memory:7196793]]
- **Attempt tracking** - All attempts stored, failed attempts don't generate vouchers
- **Input validation** - Submission format and content validation
- **JSON validation** - Interactive element answers validated and sanitized

### **Quiz Configuration**
| Module | Questions | Point Distribution | Total Points | Pass Score | Interactive |
|--------|-----------|-------------------|--------------|------------|-------------|
| 0001   | 16        | All 6 points      | 96           | 77+ (80%)  | 1 Word Jumble |
| 0002   | 14        | 11×7 + 3×8       | 101          | 81+ (80%)  | 1 Concept Match |
| 0003   | 14        | 11×7 + 3×8       | 101          | 81+ (80%)  | 1 Timeline |
| 0004   | 14        | 8×7 + 6×8        | 104          | 84+ (80%)  | 2 (True/False + Drag-Drop) |
| 0005   | N/A       | N/A              | N/A          | N/A        | Transaction validation |

## 🎖️ Badge System

The system supports ERC-1155 badges mapped to task codes:

- Badge `tokenId` 0 means "no badge"; use positive IDs
- Badges are soulbound (non-transferable)
- Metadata served from configurable base URI
- Default padding: 4 digits (task 1 → `0001.json`)

### Metadata Example

Place at `https://your-cdn.com/training/0001.json`:

```json
{
  "name": "Solidity Basics – Completion Badge",
  "description": "Awarded for completing the Solidity Basics certification.",
  "image": "https://your-cdn.com/training/images/0001.png",
  "attributes": [
    { "trait_type": "Certification", "value": "Solidity Basics" },
    { "trait_type": "Level", "value": 1 },
    { "trait_type": "Type", "value": "Achievement" }
  ]
}
```

## 🔧 Configuration

### Smart Contract

```bash
cd contracts
# Update base URI
forge script script/Configure.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "baseURI(address,string)" $PROXY "https://your-cdn.com/training/"

# Pause/unpause
forge script script/Configure.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "pause(address)" $PROXY
```

### Upgrade Contract

```bash
cd contracts
forge script script/Upgrade.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "run(address payable)" $PROXY
```

## 📊 Monitoring

Monitor your API with:

```bash
# View logs
wrangler tail

# Check health
curl https://your-api.workers.dev/health/detailed
```

## 🔗 Integration Example

### Frontend Integration

```typescript
// 1. Submit achievement completion with quiz answers
const submissionResponse = await fetch('/api/v1/vouchers/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: userWallet,
    achievementNumber: "0001",
    submissionType: "quiz",
    submissionData: {
      answers: {
        q1: "B",
        q2: "B", 
        q3: "B",
        q4: "A",
        q5: "B"
      }
    },
    metadata: {
      timestamp: new Date().toISOString(),
      timeSpent: 120
    }
  })
});

// 1b. Submit secret achievement (alternative example)
const secretSubmissionResponse = await fetch('/api/v1/vouchers/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: userWallet,
    achievementNumber: "1001",
    submissionType: "secret",
    submissionData: {
      secretAnswer: "FIRSTSECRET"
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  })
});

const submissionResult = await submissionResponse.json();

if (submissionResult.success) {
  // Quiz passed - show success feedback and claim voucher
  const { voucher, signature, contractAddress, chainId, results } = submissionResult;
  
  console.log(`🎉 Quiz passed! Score: ${results.score}/${results.maxScore} (${results.accuracy}%)`);
  console.log(`Feedback: ${results.feedback}`);
  
  // 2. Submit voucher to smart contract using wagmi [[memory:5848161]]
  const { writeContract } = useContractWrite({
    address: contractAddress,
    abi: TrainingRegistryABI,
    functionName: 'submitVoucher',
  });

  await writeContract({
    args: [voucher.taskCode, signature]
  });
} else {
  // Quiz failed - show feedback and retry option
  const { results, error } = submissionResult;
  
  console.log(`❌ Quiz failed. Score: ${results.score}/${results.maxScore} (${results.accuracy}%)`);
  console.log(`Feedback: ${results.feedback}`);
  console.log(`Next steps: ${results.nextSteps.join(', ')}`);
  
  if (results.retryAllowed) {
    // Allow user to retry the quiz
    console.log("You can retry this quiz when ready.");
  }
}

// 3. Get user's combined achievements (vouchers + claims)
const walletResponse = await fetch(`/api/v1/vouchers/wallet/${userWallet}`);
const { achievements } = await walletResponse.json();

// 4. Get unclaimed vouchers for the user to claim
const unclaimedResponse = await fetch(`/api/v1/vouchers/unclaimed/${userWallet}`);
const { unclaimedVouchers } = await unclaimedResponse.json();
```

## 🛡️ Security

- **Quiz answer protection** - Correct answers never exposed in API responses [[memory:7196793]]
- **Retry validation** - Failed attempts tracked, retries allowed
- **EIP-712 signature verification** - Cryptographically secure vouchers
- **Rate limiting** on API endpoints
- **Input validation** and sanitization
- **Smart contract access controls**
- **Database input sanitization**

## 📝 Notes

- Badge `tokenId` 0 means "no badge"; use positive IDs
- To support contract wallets as issuers, extend with EIP‑1271 checks in a future version
- API automatically handles voucher signing and database updates

## 🌐 Example Deployment

A sample deployment is running on Zilliqa Testnet:

- **Contract**: `0x1dAC4421F77C43931c8f2671665f1b72cC4082ef`
- **Chain ID**: `33101`

## 🤝 Contributing

We welcome contributions to PlunderAcademy! Whether it's bug fixes, new features, documentation improvements, or additional training content, your contributions help make this platform better for everyone.

### How to Contribute

1. **Fork the repository** and create your feature branch
2. **Make your changes** with clear, descriptive commits
3. **Test your changes** thoroughly
4. **Submit a pull request** with a clear description of what you've changed and why

### Contribution Guidelines

- Follow the existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Keep commits focused and atomic
- Write clear commit messages

### License for Contributions

By contributing to this repository, you agree that:

- You retain copyright to your contributions
- Your contributions will be licensed under the same Business Source License 1.1 terms as the project
- Your contributions may be used in the Licensed Work under these terms

This means your contributions will also convert to Apache License 2.0 on the Change Date (October 30, 2028).

### Questions?

If you have questions about contributing, feel free to open an issue or reach out to the maintainers.

## 📄 License

This project is licensed under the Business Source License 1.1 (BSL 1.1).

**Key Points:**

- **Licensor**: Abbika LLC
- **Licensed Work**: plunderacademy-achievements (© 2025 Abbika LLC) - https://github.com/PlunderAcademy/plunderacademy-achievements
- **Additional Use Grant**: You may use the Licensed Work, but not for commercial educational platforms or blockchain training sites that compete with PlunderAcademy
- **Change Date**: 2028-10-30 (converts to Apache License 2.0)

For full license terms, see the [LICENSE](LICENSE) file.

### What This Means

- ✅ You can freely use, modify, and distribute this code for non-production purposes
- ✅ You can use it for internal/private educational purposes
- ✅ You can contribute improvements back to the project
- ✅ After October 30, 2028, it becomes Apache 2.0 (fully open source)
- ❌ You cannot use it to run a competing commercial educational platform or blockchain training site

For commercial use that doesn't comply with the Additional Use Grant, please contact Abbika LLC for a commercial license.