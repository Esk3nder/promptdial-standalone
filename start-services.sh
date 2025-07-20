#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 PromptDial 2.0 - Starting Services${NC}"
echo "======================================"

# Kill any existing processes
echo -e "${YELLOW}Stopping any existing services...${NC}"
pkill -f "tsx src/index" 2>/dev/null || true
pkill -f "node dist/index" 2>/dev/null || true
sleep 2

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Start services
echo -e "\n${YELLOW}Starting core services...${NC}\n"

# Core services
echo "Starting API Gateway (port 3000)..."
(cd packages/api-gateway && npx tsx src/index.ts > ../../logs/api-gateway.log 2>&1 &)

echo "Starting Classifier (port 3001)..."
(cd packages/classifier && npx tsx src/index.ts > ../../logs/classifier.log 2>&1 &)

echo "Starting Telemetry (port 3002)..."
(cd packages/telemetry && npx tsx src/index.ts > ../../logs/telemetry.log 2>&1 &)

echo "Starting Technique Engine (port 3003)..."
(cd packages/technique-engine && npx tsx src/index.ts > ../../logs/technique-engine.log 2>&1 &)

echo "Starting Retrieval Hub (port 3004)..."
(cd packages/retrieval-hub && npx tsx src/index.ts > ../../logs/retrieval-hub.log 2>&1 &)

echo "Starting Evaluator (port 3005)..."
(cd packages/evaluator && npx tsx src/index.ts > ../../logs/evaluator.log 2>&1 &)

echo "Starting SafetyGuard (port 3006)..."
(cd packages/safety-guard && npx tsx src/index.ts > ../../logs/safety-guard.log 2>&1 &)

echo "Starting Optimizer (port 3007)..."
(cd packages/optimizer && npx tsx src/index.ts > ../../logs/optimizer.log 2>&1 &)

# Start LLM Runner based on available API keys
echo -e "\n${YELLOW}Starting LLM Runner...${NC}"

if [ ! -z "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "your-openai-api-key" ]; then
    echo "Starting LLM Runner for OpenAI (port 4001)..."
    (cd packages/llm-runner && PROVIDER=openai PORT=4001 npx tsx src/index.ts > ../../logs/llm-runner-openai.log 2>&1 &)
fi

if [ ! -z "$ANTHROPIC_API_KEY" ] && [ "$ANTHROPIC_API_KEY" != "your-anthropic-api-key" ]; then
    echo "Starting LLM Runner for Anthropic (port 4002)..."
    (cd packages/llm-runner && PROVIDER=anthropic PORT=4002 npx tsx src/index.ts > ../../logs/llm-runner-anthropic.log 2>&1 &)
fi

if [ ! -z "$GOOGLE_AI_API_KEY" ] && [ "$GOOGLE_AI_API_KEY" != "your-google-ai-api-key" ]; then
    echo "Starting LLM Runner for Google (port 4003)..."
    (cd packages/llm-runner && PROVIDER=google PORT=4003 npx tsx src/index.ts > ../../logs/llm-runner-google.log 2>&1 &)
fi

# Wait for services to start
echo -e "\n${YELLOW}Waiting for services to initialize...${NC}"
sleep 10

# Check health
echo -e "\n${BLUE}Checking service health...${NC}\n"

check_service() {
    local name=$1
    local port=$2
    local url="http://localhost:${port}/health"
    
    if curl -s -f "$url" > /dev/null; then
        echo -e "${GREEN}✅ ${name} (port ${port}) - Healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ ${name} (port ${port}) - Not responding${NC}"
        return 1
    fi
}

# Check all services
check_service "API Gateway" 3000
check_service "Classifier" 3001
check_service "Telemetry" 3002
check_service "Technique Engine" 3003
check_service "Retrieval Hub" 3004
check_service "Evaluator" 3005
check_service "SafetyGuard" 3006
check_service "Optimizer" 3007

# Check LLM Runners
if [ ! -z "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "your-openai-api-key" ]; then
    check_service "LLM Runner (OpenAI)" 4001
fi

if [ ! -z "$ANTHROPIC_API_KEY" ] && [ "$ANTHROPIC_API_KEY" != "your-anthropic-api-key" ]; then
    check_service "LLM Runner (Anthropic)" 4002
fi

if [ ! -z "$GOOGLE_AI_API_KEY" ] && [ "$GOOGLE_AI_API_KEY" != "your-google-ai-api-key" ]; then
    check_service "LLM Runner (Google)" 4003
fi

echo -e "\n${GREEN}✅ All services started!${NC}"
echo -e "\n${BLUE}Service Logs:${NC}"
echo "  • API Gateway: logs/api-gateway.log"
echo "  • Classifier: logs/classifier.log"
echo "  • Other services: logs/*.log"
echo -e "\n${YELLOW}To stop all services, run: pkill -f 'tsx src/index'${NC}\n"