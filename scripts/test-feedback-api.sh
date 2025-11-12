#!/bin/bash

# Configuration
API_URL="${API_URL:-http://localhost:8787}"  # Use env var or default to local
WALLET="0x742d35Cc6665C3532d8F8D9e5d6e40d9B3e5e6B7"
INTERACTION_ID="550e8400-e29b-41d4-a716-446655440000"

echo "========================================"
echo "Testing Plunder Academy Feedback API"
echo "========================================"
echo "API URL: $API_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check HTTP status
check_status() {
    if [ $1 -eq 200 ] || [ $1 -eq 201 ]; then
        echo -e "${GREEN}✓ Success (HTTP $1)${NC}"
    else
        echo -e "${RED}✗ Failed (HTTP $1)${NC}"
    fi
}

# Test 1: Health Check
echo "0. Testing Health Check"
echo "GET /health/detailed"
response=$(curl -s -w "\n%{http_code}" "$API_URL/health/detailed")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "$body" | jq '.' 2>/dev/null || echo "$body"
check_status $http_code
echo ""

# Test 2: Track AI Interaction
echo "1. Testing AI Interaction Tracking"
echo "POST /api/v1/feedback/ai-interaction"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/feedback/ai-interaction" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$INTERACTION_ID\",
    \"walletAddress\": \"$WALLET\",
    \"toolType\": \"auditor\",
    \"inputLength\": 100,
    \"outputLength\": 500,
    \"modelUsed\": \"gpt-4\",
    \"durationMs\": 2000,
    \"vulnerabilitiesFound\": 2,
    \"sessionId\": \"test-session\"
  }")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "$body" | jq '.' 2>/dev/null || echo "$body"
check_status $http_code
echo ""

# Test 3: Submit Feedback
echo "2. Testing AI Response Feedback"
echo "POST /api/v1/feedback/ai-response"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/feedback/ai-response" \
  -H "Content-Type: application/json" \
  -d "{
    \"interactionId\": \"$INTERACTION_ID\",
    \"walletAddress\": \"$WALLET\",
    \"toolType\": \"auditor\",
    \"feedbackType\": \"thumbs_up\",
    \"feedbackValue\": \"up\",
    \"qualityRating\": 5
  }")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "$body" | jq '.' 2>/dev/null || echo "$body"
check_status $http_code
echo ""

# Test 4: Submit Module Feedback
echo "3. Testing Module Completion Feedback"
echo "POST /api/v1/feedback/module-completion"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/feedback/module-completion" \
  -H "Content-Type: application/json" \
  -d "{
    \"walletAddress\": \"$WALLET\",
    \"moduleSlug\": \"island1-module1\",
    \"achievementCodes\": [\"0001\"],
    \"contentDifficulty\": 3,
    \"contentClarity\": 5,
    \"practicalValue\": 4,
    \"paceAppropriateness\": 4,
    \"whatWorkedWell\": \"Great explanations and examples\",
    \"suggestionsForImprovement\": \"More practice exercises\",
    \"timeSpentMinutes\": 45,
    \"externalResourcesUsed\": false,
    \"aiToolsHelpful\": true
  }")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "$body" | jq '.' 2>/dev/null || echo "$body"
check_status $http_code
echo ""

# Test 5: Get User Analytics
echo "4. Testing User Analytics"
echo "GET /api/v1/analytics/user/$WALLET"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/v1/analytics/user/$WALLET")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "$body" | jq '.' 2>/dev/null || echo "$body"
check_status $http_code
echo ""

# Test 6: Get Platform Summary
echo "5. Testing Platform Analytics Summary"
echo "GET /api/v1/analytics/summary?timeframe=30d"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/v1/analytics/summary?timeframe=30d")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "$body" | jq '.' 2>/dev/null || echo "$body"
check_status $http_code
echo ""
echo "  Response includes:"
echo "  - platform: $(echo "$body" | jq -r 'if .platform then "✓" else "✗" end' 2>/dev/null)"
echo "  - tools: $(echo "$body" | jq -r 'if .tools then "✓" else "✗" end' 2>/dev/null)"
echo "  - modules: $(echo "$body" | jq -r 'if .modules then "✓ (\(.modules | length) modules)" else "✗" end' 2>/dev/null)"
echo "  - queryCategories: $(echo "$body" | jq -r 'if .queryCategories then "✓ (\(.queryCategories | length) categories)" else "✗" end' 2>/dev/null)"
echo "  - timeSeries: $(echo "$body" | jq -r 'if .timeSeries then "✓ (\(.timeSeries | length) data points)" else "✗" end' 2>/dev/null)"
echo "  - recentActivity: $(echo "$body" | jq -r 'if .recentActivity then "✓ (\(.recentActivity | length) items)" else "✗" end' 2>/dev/null)"
echo ""

# Test 7: Get Leaderboard
echo "6. Testing Leaderboard"
echo "GET /api/v1/analytics/leaderboard?limit=5&timeframe=30d"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/v1/analytics/leaderboard?limit=5&timeframe=30d")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "$body" | jq '.' 2>/dev/null || echo "$body"
check_status $http_code
echo ""

# Test 7b: Get Leaderboard (all-time)
echo "6b. Testing Leaderboard (all-time)"
echo "GET /api/v1/analytics/leaderboard?limit=5&timeframe=all"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/v1/analytics/leaderboard?limit=5&timeframe=all")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "$body" | jq '.' 2>/dev/null || echo "$body"
check_status $http_code
echo "  Timeframe: $(echo "$body" | jq -r '.timeframe' 2>/dev/null)"
echo ""

# Test 7c: Get Text Feedback
echo "6c. Testing Text Feedback"
echo "GET /api/v1/analytics/text-feedback?limit=10&timeframe=30d"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/v1/analytics/text-feedback?limit=10&timeframe=30d")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "$body" | jq '.' 2>/dev/null || echo "$body"
check_status $http_code
echo "  Feedback items: $(echo "$body" | jq -r 'if .feedback then "\(.feedback | length)" else "0" end' 2>/dev/null)"
echo ""

# Test 7d: Get Module Feedback
echo "6d. Testing Module Completion Feedback"
echo "GET /api/v1/analytics/module-feedback?limit=10&timeframe=30d"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/v1/analytics/module-feedback?limit=10&timeframe=30d")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "$body" | jq '.' 2>/dev/null || echo "$body"
check_status $http_code
echo "  Feedback items: $(echo "$body" | jq -r 'if .feedback then "\(.feedback | length)" else "0" end' 2>/dev/null)"
echo ""

# Test 8: Error Handling - Invalid Wallet
echo "7. Testing Error Handling (Invalid Wallet)"
echo "POST /api/v1/feedback/ai-interaction"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/feedback/ai-interaction" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"550e8400-e29b-41d4-a716-446655440001\",
    \"walletAddress\": \"invalid-wallet\",
    \"toolType\": \"auditor\"
  }")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "$body" | jq '.' 2>/dev/null || echo "$body"
if [ $http_code -eq 400 ]; then
    echo -e "${GREEN}✓ Correctly rejected invalid wallet (HTTP $http_code)${NC}"
else
    echo -e "${RED}✗ Should have returned 400 (got HTTP $http_code)${NC}"
fi
echo ""

echo "========================================"
echo "Testing Complete!"
echo "========================================"
echo ""
echo "To test against production, run:"
echo "API_URL=https://your-api.workers.dev ./test-feedback-api.sh"

