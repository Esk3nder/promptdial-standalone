# Hybrid Mode Usage Guide

## Overview

PromptDial 3.0 now supports a **hybrid architecture** that allows you to run in either:
- **Monolithic mode** (default) - All optimization logic runs within a single service
- **Microservices mode** - Leverages specialized services for advanced features

## Configuration

### Environment Variables

Set the following environment variables to configure hybrid mode:

```bash
# Basic Configuration
PROMPTDIAL_MODE=microservices  # or 'monolithic' (default)

# Service URLs (for microservices mode)
TECHNIQUE_ENGINE_URL=http://localhost:3003
EVALUATOR_URL=http://localhost:3005
RETRIEVAL_HUB_URL=http://localhost:3004
OPTIMIZER_URL=http://localhost:3007
TELEMETRY_URL=http://localhost:3002

# Feature Flags (optional)
USE_TECHNIQUE_ENGINE=true
USE_EVALUATOR=true
USE_RETRIEVAL=true
USE_PARETO_FILTER=true
USE_TELEMETRY=false

# Resilience Settings
FALLBACK_TO_MONOLITHIC=true  # Fallback if services fail
SERVICE_TIMEOUT=30000        # Service call timeout (ms)
SERVICE_MAX_RETRIES=3        # Retry attempts
```

### Programmatic Configuration

```typescript
import { PromptDial } from 'promptdial'

const promptDial = new PromptDial({
  config: {
    mode: 'microservices',
    services: {
      techniqueEngine: 'http://technique-engine:3003',
      evaluator: 'http://evaluator:3005',
      retrievalHub: 'http://retrieval:3004'
    },
    features: {
      useTechniqueEngine: true,
      useEvaluator: true,
      useRetrieval: true
    },
    fallbackToMonolithic: true
  }
})
```

## Running in Different Modes

### Monolithic Mode (Default)

Simple, single-service deployment:

```bash
# Just run the core server
npm start

# Or with Docker
docker run -p 3000:3000 promptdial/core
```

### Microservices Mode

Full-featured deployment with specialized services:

```bash
# Start all services with docker-compose
docker-compose up

# Or start individual services
docker-compose up technique-engine evaluator retrieval-hub
```

### Hybrid Development Mode

Start with monolithic, progressively enable services:

```bash
# 1. Start in monolithic mode
npm start

# 2. Start specific services as needed
docker-compose up technique-engine

# 3. Enable features via environment
export USE_TECHNIQUE_ENGINE=true
npm start
```

## Feature Comparison

| Feature | Monolithic | Microservices |
|---------|------------|---------------|
| Basic Optimization | ✅ Template + AI | ✅ Template + AI |
| Advanced Techniques | ❌ | ✅ Few-Shot CoT, ReAct, IRCoT, etc. |
| Retrieval Augmentation | ❌ | ✅ Vector store integration |
| Calibrated Evaluation | ❌ | ✅ G-EVAL with confidence intervals |
| Pareto Optimization | ❌ | ✅ Multi-objective optimization |
| Self-Consistency | ❌ | ✅ Ensemble reasoning |
| Latency | Fast (~2-5s) | Moderate (~5-10s) |
| Infrastructure | Simple | Complex |

## Usage Examples

### Basic Usage (Works in Both Modes)

```typescript
const result = await promptDial.optimize({
  prompt: 'Explain quantum computing',
  targetModel: 'gpt-4'
})
```

### Advanced Usage (Microservices Only)

```typescript
// With retrieval for factual queries
const result = await promptDial.optimize({
  prompt: 'What are the latest developments in quantum computing?',
  targetModel: 'claude-3-opus',
  features: {
    useRetrieval: true,
    useSelfConsistency: true
  }
})

// With Pareto optimization for cost/quality tradeoff
const result = await promptDial.optimize({
  prompt: 'Write a marketing email',
  targetModel: 'gpt-4',
  constraints: {
    maxCost: 0.10,
    maxLatency: 5000
  }
})
```

## Monitoring & Debugging

### Health Checks

```bash
# Check core service
curl http://localhost:3000/health

# Check all services (microservices mode)
curl http://localhost:3000/health/services
```

### Debug Endpoint

```bash
# View system status and test optimization
open http://localhost:3000/debug
```

### Logs

```bash
# Monolithic mode
npm start | grep -E "(optimize|error)"

# Microservices mode
docker-compose logs -f technique-engine
```

## Best Practices

1. **Start Simple**: Begin with monolithic mode and enable microservices as needed
2. **Progressive Enhancement**: Enable features one at a time
3. **Monitor Performance**: Use telemetry to track optimization times
4. **Fallback Strategy**: Always enable `fallbackToMonolithic` in production
5. **Service Health**: Implement health checks and circuit breakers

## Troubleshooting

### Services Not Connecting

```bash
# Check service health
curl http://localhost:3003/health

# Verify network connectivity
docker network ls
docker-compose ps
```

### Slow Performance

- Reduce `SERVICE_MAX_RETRIES` for faster failures
- Decrease `SERVICE_TIMEOUT` for quicker fallbacks
- Disable unused features

### Fallback Not Working

Ensure `FALLBACK_TO_MONOLITHIC=true` and check logs for circuit breaker status.

## Migration Guide

### From Monolithic to Microservices

1. Deploy microservices infrastructure
2. Set `PROMPTDIAL_MODE=microservices`
3. Configure service URLs
4. Test with `fallbackToMonolithic=true`
5. Monitor performance and errors
6. Gradually disable fallback as confidence grows

### From Microservices to Monolithic

1. Set `PROMPTDIAL_MODE=monolithic`
2. All requests automatically use internal implementation
3. Shut down unused services to save resources