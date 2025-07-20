#!/bin/bash

# PromptDial 2.0 - Service Startup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting PromptDial 2.0 Services${NC}"
echo "=================================="

# Check if running in Docker mode
if [ "$1" == "docker" ]; then
    echo -e "${YELLOW}Starting services with Docker Compose...${NC}"
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
        exit 1
    fi
    
    # Build and start services
    docker-compose up --build
    
else
    echo -e "${YELLOW}Starting services locally...${NC}"
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}npm is not installed. Please install Node.js first.${NC}"
        exit 1
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Build shared package first
    echo "Building shared package..."
    npm run build:shared
    
    # Function to start a service
    start_service() {
        local service_name=$1
        local port=$2
        echo -e "${GREEN}Starting $service_name on port $port...${NC}"
        npm run dev:$service_name &
        sleep 2
    }
    
    # Start core services
    start_service "telemetry" 3002
    start_service "classifier" 3001
    start_service "safety" 3006
    start_service "technique" 3003
    start_service "retrieval" 3004
    start_service "evaluator" 3005
    start_service "optimizer" 3007
    
    # Wait for services to be ready
    echo "Waiting for services to be ready..."
    sleep 5
    
    # Start API Gateway
    echo -e "${GREEN}Starting API Gateway on port 3000...${NC}"
    cd packages/api-gateway && npm run dev &
    
    # Wait for gateway to be ready
    sleep 3
    
    # Check health
    echo -e "\n${YELLOW}Checking service health...${NC}"
    curl -s http://localhost:3000/health | jq '.' || echo "Health check failed"
    
    echo -e "\n${GREEN}✅ All services started!${NC}"
    echo "API Gateway: http://localhost:3000"
    echo "Health: http://localhost:3000/health"
    echo "Services: http://localhost:3000/services"
    
    # Keep script running
    echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}"
    wait
fi