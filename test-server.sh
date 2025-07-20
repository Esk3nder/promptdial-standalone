#!/bin/bash

echo "Testing PromptDial API Server..."
echo "================================"

# Test health endpoint
echo -n "Testing health endpoint... "
curl -s http://localhost:3001/api/health | grep -q "ok" && echo "✅ OK" || echo "❌ Failed"

# Test starting a new test
echo -n "Starting a test... "
TEST_RESPONSE=$(curl -s -X POST http://localhost:3001/api/test \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is AI?","targetModel":"gpt-4","optimizationLevel":"basic"}')

if echo "$TEST_RESPONSE" | grep -q "testId"; then
  echo "✅ OK"
  echo "Response: $TEST_RESPONSE"
else
  echo "❌ Failed"
fi

echo ""
echo "Server is ready for the UI!"
echo "Now run: cd packages/ui && npm run dev"
echo "Then open: http://localhost:5173/test-dashboard.html"