#!/bin/bash

# Test the AI costs analytics endpoint
# Usage: ./scripts/test-ai-costs.sh [BASE_URL] [TIMEFRAME]
# Example: ./scripts/test-ai-costs.sh http://localhost:8787 7d

BASE_URL=${1:-"https://plunder-academy-api-dev.plunderswap.workers.dev"}
TIMEFRAME=${2:-"7d"}

echo "Testing AI Cost Analytics endpoint..."
echo "Base URL: $BASE_URL"
echo "Timeframe: $TIMEFRAME"
echo ""

# Test with default (7 days)
echo "=== Test 1: Default timeframe (7 days) ==="
curl -s "$BASE_URL/api/v1/analytics/ai-costs" | jq .
echo ""

# Test with custom timeframe
echo "=== Test 2: Custom timeframe ($TIMEFRAME) ==="
curl -s "$BASE_URL/api/v1/analytics/ai-costs?timeframe=$TIMEFRAME" | jq .
echo ""

# Test with 1 day
echo "=== Test 3: Last 24 hours (1d) ==="
curl -s "$BASE_URL/api/v1/analytics/ai-costs?timeframe=1d" | jq .
echo ""

# Test with 30 days
echo "=== Test 4: Last 30 days ==="
curl -s "$BASE_URL/api/v1/analytics/ai-costs?timeframe=30d" | jq .
echo ""

echo "Tests complete!"

