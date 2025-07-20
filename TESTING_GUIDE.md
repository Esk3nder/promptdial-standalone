# PromptDial 2.0 - Complete Testing Guide

## 🚀 Full End-to-End Testing with Real API Calls

This guide explains how to test PromptDial 2.0 with actual LLM API calls.

## Prerequisites

### 1. API Keys
Ensure you have at least one API key in your `.env` file:
```bash
# Check your .env file
cat .env | grep "_API_KEY"
```

You need at least one of:
- `OPENAI_API_KEY=sk-...`
- `ANTHROPIC_API_KEY=sk-ant-...`
- `GOOGLE_AI_API_KEY=AIza...`

### 2. Install Dependencies
```bash
npm install
npm install dotenv  # If not already installed
```

## Step-by-Step Testing

### 1. Start All Services

```bash
# This will start all services including the LLM Runner
./scripts/deploy-local.sh
```

You should see:
- ✅ All core services starting
- ✅ LLM Runner starting (OpenAI/Anthropic/Google based on your API keys)
- ✅ Health check passing

### 2. Verify Services are Running

```bash
# Check individual service health
curl http://localhost:3000/health  # API Gateway
curl http://localhost:3001/health  # Classifier
curl http://localhost:3003/health  # Technique Engine
curl http://localhost:3005/health  # Evaluator
curl http://localhost:3006/health  # SafetyGuard
curl http://localhost:3007/health  # Optimizer

# Check LLM Runner (port depends on provider)
curl http://localhost:4001/health  # OpenAI
curl http://localhost:4002/health  # Anthropic
curl http://localhost:4003/health  # Google
```

### 3. Run Real API Tests

```bash
# This runs comprehensive tests with actual LLM calls
./test-real-api.js
```

This test will:
- ✅ Verify all services are healthy
- ✅ Test optimization with real prompts
- ✅ Make actual LLM API calls
- ✅ Run real evaluations
- ✅ Test safety features
- ✅ Show complete results including:
  - Task classification
  - Generated variants
  - LLM responses
  - Evaluation scores
  - Pareto optimization
  - Recommended variant

## What You'll See

### Successful Test Output

```
🚀 Testing Real API Optimization
================================

Test Case: Simple Code Generation
Prompt: "Write a Python function that checks if a number is prime"

✅ Optimization successful in 8.5s

Task Classification:
- Type: code_generation
- Domain: programming
- Complexity: 0.65
- Safety Risk: low

Variants Generated: 3

Variant v1:
- Technique: FewShot_CoT
- Cost: $0.0234
- Score: 0.921
- Prompt Preview: [Few-shot examples with chain-of-thought...]

Evaluation Results:
- G-EVAL Score: 0.89
- Chat-Eval Score: 0.92
- Final Score: 0.905

Recommended Variant:
- Technique: FewShot_CoT
- Optimized Prompt: [Complete optimized prompt with examples]
```

## Cost Estimates

Each full optimization test will cost approximately:
- **OpenAI**: $0.10-0.30 per test
- **Anthropic**: $0.08-0.25 per test  
- **Google AI**: $0.05-0.20 per test

Costs depend on:
- Number of variants generated
- Evaluation methods used
- Prompt complexity

## Troubleshooting

### "No LLM provider configured"
- Check your `.env` file has valid API keys
- Ensure the keys start with the correct prefix
- Restart services after updating `.env`

### "Request timeout"
- LLM calls can take 10-30 seconds
- Check your internet connection
- Verify API key has sufficient quota

### "Evaluation failed"
- Ensure evaluator service is running
- Check LLM Runner logs: `tail -f packages/llm-runner/logs/*`
- Verify port 4001/4002/4003 is accessible

### Rate Limiting
- OpenAI: 3 requests/minute on free tier
- Add delays between tests if needed
- Consider upgrading API plan for heavy testing

## Advanced Testing

### Test Specific Techniques
```bash
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum computing",
    "options": {
      "techniques": ["TreeOfThought", "SelfConsistency"],
      "max_variants": 2
    }
  }'
```

### Test with Custom Preferences
```bash
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a sorting algorithm",
    "options": {
      "preferences": {
        "quality": 0.9,
        "cost": 0.05,
        "latency": 0.05
      }
    }
  }'
```

### Monitor Real-time Logs
```bash
# In separate terminals:
tail -f packages/api-gateway/logs/*
tail -f packages/llm-runner/logs/*
tail -f packages/evaluator/logs/*
```

## Performance Metrics

With real API calls, expect:
- **Total optimization time**: 10-45 seconds
- **Variant generation**: 2-5 seconds each
- **LLM execution**: 3-15 seconds per variant
- **Evaluation**: 5-20 seconds total
- **Optimization**: <1 second

## Next Steps

Once testing is successful:

1. **Monitor Costs**: Keep track of API usage
2. **Optimize Performance**: Adjust concurrency limits
3. **Fine-tune Evaluations**: Calibrate evaluation weights
4. **Production Deployment**: See [DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 🎉 Success Indicators

You know the system is working when:
- ✅ All services show as healthy
- ✅ Real LLM responses appear (not mocked)
- ✅ Evaluation scores vary between variants
- ✅ Safety features block malicious prompts
- ✅ Optimization selects best variant based on preferences

---

**Ready to test?** Run `./test-real-api.js` and watch PromptDial 2.0 optimize prompts with real AI!