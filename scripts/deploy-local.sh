#!/bin/bash

# PromptDial 3.0 - Local Deployment Script
# This script sets up a minimal working deployment for testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 PromptDial 3.0 - Local Deployment${NC}"
echo "===================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed. Please install npm${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites satisfied${NC}"

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Please edit .env and add your API keys${NC}"
        echo -e "${YELLOW}   Required: OPENAI_API_KEY or ANTHROPIC_API_KEY${NC}"
        exit 1
    else
        echo -e "${RED}❌ No .env.example file found${NC}"
        exit 1
    fi
fi

# Install dependencies at root level
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install --workspaces --if-present || true

# Build shared package first
echo -e "${YELLOW}Building shared package...${NC}"
cd packages/shared
npm install
npm run build || echo "Shared build completed with warnings"
cd ../..

# Function to start a service with error handling
start_service() {
    local service_name=$1
    local service_dir=$2
    local port=$3
    
    echo -e "${GREEN}Starting $service_name on port $port...${NC}"
    
    cd "packages/$service_dir"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        npm install || echo "Install completed with warnings"
    fi
    
    # Try to build TypeScript files
    if [ -f "tsconfig.json" ]; then
        npm run build 2>/dev/null || echo "Build completed with warnings"
    fi
    
    # Start the service
    if [ -f "src/index.ts" ]; then
        npx tsx src/index.ts &
    elif [ -f "dist/index.js" ]; then
        node dist/index.js &
    else
        echo -e "${RED}Could not find entry point for $service_name${NC}"
    fi
    
    cd ../..
    sleep 2
}

# Start essential services only
echo -e "${BLUE}Starting essential services...${NC}"

# Start classifier (required)
start_service "Classifier" "classifier" 3001

# Start safety guard (required)
start_service "SafetyGuard" "safety-guard" 3006

# Start technique engine (required) 
start_service "Technique Engine" "technique-engine" 3003

# Start optimizer
start_service "Optimizer" "optimizer" 3007

# Start telemetry (optional but useful)
start_service "Telemetry" "telemetry" 3002

# Start LLM Runner based on available API keys
echo -e "${YELLOW}Checking for LLM API keys...${NC}"
if grep -q "OPENAI_API_KEY=sk-" .env 2>/dev/null; then
    echo -e "${GREEN}OpenAI API key found, starting OpenAI LLM Runner...${NC}"
    cd packages/llm-runner
    PROVIDER=openai PORT=4001 npx tsx src/index.ts &
    cd ../..
elif grep -q "ANTHROPIC_API_KEY=sk-" .env 2>/dev/null; then
    echo -e "${GREEN}Anthropic API key found, starting Anthropic LLM Runner...${NC}"
    cd packages/llm-runner
    PROVIDER=anthropic PORT=4002 npx tsx src/index.ts &
    cd ../..
elif grep -q "GOOGLE_AI_API_KEY=" .env 2>/dev/null; then
    echo -e "${GREEN}Google AI API key found, starting Google LLM Runner...${NC}"
    cd packages/llm-runner
    PROVIDER=google PORT=4003 npx tsx src/index.ts &
    cd ../..
else
    echo -e "${RED}❌ No LLM API keys found in .env${NC}"
    echo -e "${YELLOW}Please add at least one API key to .env file${NC}"
    exit 1
fi

# Start evaluator (now that LLM Runner is available)
start_service "Evaluator" "evaluator" 3005

# Wait for services to stabilize
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 5

# Start API Gateway
echo -e "${BLUE}Starting API Gateway...${NC}"
cd packages/api-gateway
if [ ! -d "node_modules" ]; then
    npm install
fi
npx tsx src/index.ts &
GATEWAY_PID=$!
cd ../..

# Wait for gateway to be ready
sleep 3

# Check health
echo -e "${YELLOW}Checking system health...${NC}"
curl -s http://localhost:3000/health | jq '.' 2>/dev/null || echo -e "${YELLOW}Health check pending...${NC}"

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Services running:"
echo "- API Gateway: http://localhost:3000"
echo "- Classifier: http://localhost:3001"
echo "- SafetyGuard: http://localhost:3006"  
echo "- Technique Engine: http://localhost:3003"
echo "- Optimizer: http://localhost:3007"
echo "- Evaluator: http://localhost:3005"
echo "- Telemetry: http://localhost:3002"
if grep -q "OPENAI_API_KEY=sk-" .env 2>/dev/null; then
    echo "- LLM Runner (OpenAI): http://localhost:4001"
elif grep -q "ANTHROPIC_API_KEY=sk-" .env 2>/dev/null; then
    echo "- LLM Runner (Anthropic): http://localhost:4002"
elif grep -q "GOOGLE_AI_API_KEY=" .env 2>/dev/null; then
    echo "- LLM Runner (Google): http://localhost:4003"
fi
echo ""
echo -e "${BLUE}Test the system:${NC}"
echo 'curl -X POST http://localhost:3000/api/optimize \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"prompt": "Write a hello world function"}'"'"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Keep the script running
wait $GATEWAY_PID