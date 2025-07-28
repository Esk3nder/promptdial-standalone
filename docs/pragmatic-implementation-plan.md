# PromptDial: Pragmatic Implementation Plan

## Goal: Ship a Working System in 2 Weeks

Focus on what matters: **A service that takes prompts and returns better prompts.**

## Week 1: Core Functionality

### Day 1-2: Simplify & Fix Core
**Goal**: Get the standalone server working properly

1. **Remove Template Fallback Guard**
   ```typescript
   // Remove the check that blocks non-AI optimization
   // Allow graceful degradation when no API keys
   ```

2. **Fix API Schema**
   ```typescript
   interface OptimizeRequest {
     prompt: string;
     options?: {
       techniques?: string[];  // Which techniques to use
       maxCost?: number;       // Budget in USD
       maxLatency?: number;    // Time limit in ms
     };
   }
   ```

3. **Implement API Key Optional Mode**
   - With keys: Full AI optimization
   - Without keys: Basic template techniques + warning

### Day 3-4: Essential Features Only
**Goal**: Just the features people actually need

1. **Cost Tracking**
   ```typescript
   // Simple token counting per provider
   const costs = {
     'gpt-4': { input: 0.01, output: 0.03 },
     'claude-3': { input: 0.008, output: 0.024 }
   };
   ```

2. **Basic Rate Limiting**
   - In-memory rate limiter
   - 60 requests/minute default
   - No Redis needed

3. **Simple Caching**
   - LRU cache for identical requests
   - 1 hour TTL
   - Saves API costs

### Day 5: Testing & UI Polish
**Goal**: Ensure it actually works end-to-end

1. **Integration Tests**
   ```bash
   # Test with real API calls
   npm test:e2e
   ```

2. **UI Fixes**
   - Remove microservices options
   - Add cost estimate display
   - Show technique explanations

## Week 2: Production Ready

### Day 6-7: Deployment
**Goal**: One-click deploy

1. **Single Docker Container**
   ```dockerfile
   FROM node:18-slim
   COPY . .
   RUN npm ci --production
   CMD ["npm", "start"]
   ```

2. **Deploy Options**
   ```yaml
   # Railway/Render/Fly.io
   - One click deploy
   - Auto SSL
   - Built-in metrics
   ```

3. **Environment Config**
   ```env
   # .env.example
   PORT=3000
   OPENAI_API_KEY=optional
   ANTHROPIC_API_KEY=optional
   RATE_LIMIT=60
   CACHE_TTL=3600
   ```

### Day 8-9: Observability (Simple)
**Goal**: Know what's happening without complexity

1. **Structured Logging**
   ```typescript
   logger.info('optimization_complete', {
     technique: 'few_shot_cot',
     input_length: 150,
     output_length: 450,
     cost_usd: 0.02,
     duration_ms: 1200
   });
   ```

2. **Basic Metrics Endpoint**
   ```typescript
   GET /metrics
   {
     "requests_total": 1543,
     "requests_per_minute": 23,
     "average_cost_usd": 0.03,
     "cache_hit_rate": 0.34
   }
   ```

### Day 10: Documentation
**Goal**: People can actually use it

1. **Simple README**
   ```markdown
   # PromptDial
   
   Optimize your prompts with one API call.
   
   ## Quick Start
   curl -X POST http://localhost:3000/optimize \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Explain quantum computing"}'
   
   ## Deploy
   [![Deploy on Railway](button.svg)](railway-link)
   ```

2. **API Docs** (one page)
   - POST /optimize
   - GET /health
   - GET /metrics

## What We're NOT Building

### Cut These Features
1. ❌ **Microservices** - Use modules instead
2. ❌ **Telemetry Service** - Use console.log + grep
3. ❌ **Strategy Planner** - YAGNI
4. ❌ **Evaluator Calibration** - Overengineering
5. ❌ **gRPC Support** - REST is fine
6. ❌ **Warehouse Schema** - Just log JSON
7. ❌ **Continuous Learning** - Version 2 maybe
8. ❌ **Complex Security** - Basic patterns sufficient

### Why Cut Them?
- No user has asked for these
- They add complexity without value
- Can always add later if needed

## Success Metrics

### Week 1 Milestone
- [ ] Server starts without API keys
- [ ] Can optimize a prompt via API
- [ ] UI shows results
- [ ] Costs tracked accurately

### Week 2 Milestone  
- [ ] Deployed to cloud
- [ ] Documentation complete
- [ ] 100 test optimizations work
- [ ] Under $10 in API costs

## Code Structure (Simple)

```
promptdial/
├── src/
│   ├── index.ts          # Express server
│   ├── optimizer.ts      # Core logic
│   ├── techniques/       # Optimization strategies
│   ├── providers/        # LLM integrations
│   └── utils/           # Helpers
├── public/              # UI files
├── tests/              # Integration tests
├── Dockerfile
├── package.json
└── README.md
```

## Day-by-Day Checklist

### Week 1
- [ ] Day 1: Remove guards, fix schema
- [ ] Day 2: Implement degraded mode
- [ ] Day 3: Add cost tracking
- [ ] Day 4: Add rate limiting & caching
- [ ] Day 5: Test everything, fix UI

### Week 2
- [ ] Day 6: Create Docker image
- [ ] Day 7: Deploy to cloud
- [ ] Day 8: Add logging
- [ ] Day 9: Add metrics endpoint
- [ ] Day 10: Write documentation

## The Real Implementation Philosophy

1. **Start with what works** - The core package is solid
2. **Remove what doesn't add value** - Most microservices
3. **Focus on user needs** - Simple API, clear docs
4. **Ship early** - Better done than perfect
5. **Iterate based on feedback** - Not assumptions

## Fallback Plan

If even this is too much, ship the **absolute minimum**:

```typescript
// The entire service
app.post('/optimize', async (req, res) => {
  const improved = await improvePrompt(req.body.prompt);
  res.json({ improved });
});
```

Deploy on Vercel. Done.

## Summary

Two weeks to go from over-engineered microservices to a **working product** that:
- Actually ships
- Solves real problems  
- Can be maintained by one person
- Costs < $100/month to run

The best code is code that doesn't exist. The second best is code that works.