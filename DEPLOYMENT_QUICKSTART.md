# PromptDial 2.0 - Local Deployment Quick Start

## 🚀 Quick Deployment (3 Steps)

### Step 1: Verify Prerequisites

```bash
# Check Node.js (requires v18+)
node --version

# Check you have API keys in .env
cat .env | grep API_KEY
```

### Step 2: Deploy Services

```bash
# Make scripts executable
chmod +x scripts/*.sh *.sh *.js

# Deploy all services locally
./scripts/deploy-local.sh
```

This will start:

- API Gateway (port 3000) - Main entry point
- Classifier (port 3001) - Task analysis
- SafetyGuard (port 3006) - Security filtering
- Technique Engine (port 3003) - Variant generation
- Optimizer (port 3007) - Multi-objective selection
- Telemetry (port 3002) - Metrics collection

### Step 3: Test the System

```bash
# Run the full test with real API calls
./test-real-api.js

# Or run the demo (simulated responses)
./demo-minimal.js

# Or run basic tests
./test-local.sh
```

## 📋 What's Working

✅ **Full Functionality with Real API Calls**

- Task classification and analysis
- Multi-technique variant generation (6 techniques)
- Safety filtering and prompt sanitization
- Real LLM API calls (OpenAI/Anthropic/Google)
- Real evaluation with G-EVAL, ChatEval, Role-Debate
- Pareto-optimal selection
- Complete microservices orchestration

✅ **Production-Ready Features**

- Multi-provider LLM support
- Concurrent request handling
- Error recovery and retries
- Comprehensive telemetry
- Security enforcement

## 🧪 Manual Testing

### Test Health Check

```bash
curl http://localhost:3000/health
```

### Test Simple Optimization

```bash
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Write a sorting algorithm"}'
```

### Test with Preferences

```bash
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum computing",
    "options": {
      "max_variants": 5,
      "preferences": {
        "quality": 0.8,
        "cost": 0.1,
        "latency": 0.1
      }
    }
  }'
```

## 🛠️ Troubleshooting

### Services Won't Start

1. Check Node.js version: `node --version` (needs v18+)
2. Check port availability: `lsof -i :3000`
3. Kill existing processes: `pkill -f "tsx src/index"`

### API Gateway Can't Find Services

1. Ensure services started before gateway
2. Check individual service health:
   ```bash
   curl http://localhost:3001/health  # Classifier
   curl http://localhost:3006/health  # SafetyGuard
   ```

### Build Errors

1. Install dependencies: `npm install`
2. Build shared package: `cd packages/shared && npm run build`
3. Use tsx for TypeScript: `npx tsx src/index.ts`

## 🔍 What You Can Test

1. **Task Classification**
   - Different prompt types (code, creative, analytical)
   - Complexity detection
   - Domain identification

2. **Technique Application**
   - Few-Shot CoT for reasoning
   - ReAct for structured tasks
   - Self-Consistency for reliability
   - Tree of Thoughts for exploration

3. **Safety Features**
   - Prompt injection blocking
   - Jailbreak prevention
   - Content filtering

4. **Optimization**
   - Multi-objective balancing
   - Cost/quality trade-offs
   - Preference-based selection

## 📊 Monitoring

View real-time metrics:

```bash
# System metrics
curl http://localhost:3000/metrics

# Service discovery
curl http://localhost:3000/services

# Telemetry data
curl http://localhost:3002/metrics
```

## 🛑 Stopping Services

```bash
# Stop all services
pkill -f "tsx src/index"
pkill -f "node dist/index"

# Or use Ctrl+C in the terminal running deploy-local.sh
```

## 🚧 Known Limitations

This is a development deployment with:

- Mocked LLM responses (no actual API calls)
- Simplified evaluation (random scores)
- No persistent storage
- Limited error handling
- Single-node deployment

For production deployment, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## ✅ System is Ready!

The system now supports **full end-to-end testing with real LLM API calls**:

### What's Implemented:

- ✅ Real LLM API calls through LLM Runner service
- ✅ Multi-provider support (OpenAI, Anthropic, Google)
- ✅ Real evaluations using LLM-based methods
- ✅ Complete service orchestration
- ✅ Production-ready error handling

### To Test with Real APIs:

1. Ensure you have API keys in `.env`
2. Run `./scripts/deploy-local.sh`
3. Run `./test-real-api.js`

### Next Steps for Production:

1. **Configure Rate Limiting** - Adjust based on API tier
2. **Enable Persistence** - Add database for telemetry
3. **Set Up Monitoring** - Configure alerts and dashboards
4. **Deploy to Cloud** - Use Docker Compose or Kubernetes

---

**Ready to test?** Run `./scripts/deploy-local.sh` and then `./test-real-api.js` for full functionality!
