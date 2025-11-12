#!/bin/bash

# Plunder Academy Setup Script
echo "🚀 Setting up Plunder Academy project..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if wrangler is installed globally
if ! command -v wrangler &> /dev/null; then
    echo "⚠️  Wrangler not found. Installing globally..."
    npm install -g wrangler
fi

# Authenticate with Cloudflare (optional)
echo "🔐 To authenticate with Cloudflare, run: wrangler auth login"

# Create environment file
if [ ! -f .env ]; then
    echo "📄 Creating .env file from template..."
    cp .env.example .env
    echo "✏️  Please edit .env with your configuration"
else
    echo "✓ .env file already exists"
fi

# Build contracts
echo "🔨 Building smart contracts..."
cd contracts
if command -v forge &> /dev/null; then
    forge build
    echo "✓ Smart contracts built successfully"
else
    echo "⚠️  Foundry not found. Please install from https://book.getfoundry.sh/"
fi
cd ..

# Generate TypeScript types
echo "🔤 Generating TypeScript types..."
npx wrangler types || echo "⚠️  Run 'wrangler types' after setting up D1 database"

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your configuration"
echo "2. Deploy smart contracts: cd contracts && npm run contracts:deploy:testnet"
echo "3. Create D1 database: npm run db:create"
echo "4. Run migrations: npm run db:migrate"
echo "5. Start development: npm run dev"
echo ""
echo "See README.md for detailed instructions."
