# Surgical Refactor Implementation Plan

## Executive Summary

This plan leverages our existing microservices architecture to transform packages/core from a "template polisher" into an "evidence-aligned prompt-engineering engine" as outlined in the surgical refactor guide. We discovered that the technique-engine, evaluator, and retrieval-hub services already implement the research-backed approaches we need.

## Architecture Overview

### Hybrid Architecture Pattern
```
┌─────────────────────────────────────────────────────────────┐
│                     packages/core                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              PromptDial (Orchestrator)               │    │
│  │                                                      │    │
│  │  Mode: monolithic ──┐    ┌── Mode: microservices   │    │
│  │                     ↓    ↓                          │    │
│  │         ┌────────────────────────────┐              │    │
│  │         │   Service Client Layer     │              │    │
│  │         │  (HTTP clients with retry) │              │    │
│  │         └────────────────────────────┘              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Existing Services                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Technique   │  │  Evaluator  │  │  Retrieval  │        │
│  │   Engine     │  │  (G-EVAL)   │  │     Hub     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Service Client Infrastructure (Week 1)

#### 1.1 Create Base Service Client
```typescript
// packages/core/src/clients/base-client.ts
export abstract class ServiceClient {
  constructor(
    protected serviceName: string,
    protected baseUrl: string,
    protected timeout: number = 30000
  ) {}
  
  protected async request<T>(endpoint: string, data: any): Promise<T> {
    // Implement retry logic, circuit breaker, telemetry
  }
}
```

#### 1.2 Implement Specific Clients
- `TechniqueEngineClient` - Calls technique-engine service
- `EvaluatorClient` - Calls evaluator service  
- `RetrievalHubClient` - Calls retrieval-hub service
- `OptimizerClient` - Calls optimizer service (for Pareto filtering)

#### 1.3 Configuration System
```typescript
// packages/core/src/config.ts
export interface PromptDialConfig {
  mode: 'monolithic' | 'microservices'
  services?: {
    techniqueEngine?: string
    evaluator?: string
    retrievalHub?: string
    optimizer?: string
  }
  fallbackToMonolithic?: boolean
}
```

### Phase 2: Technique Integration (Week 2)

#### 2.1 Replace String-Based Techniques
Current:
```typescript
// ai-meta-prompt-designer.ts
const suggestedTechniques = ['Chain of Thought', 'Few-Shot Examples']
```

New:
```typescript
// Import from shared types
import { TechniqueStrategy } from '@promptdial/shared'

// Use technique-engine service
const techniques = await this.techniqueClient.getTechniques(taskType)
const variants = await this.techniqueClient.generateVariants({
  basePrompt,
  techniques: ['few-shot-cot', 'react', 'ircot'],
  taskClassification
})
```

#### 2.2 Enable Technique-Aware Generation
- Modify `AIMetaPromptDesigner.generateVariants()` to:
  1. Detect if microservices mode is enabled
  2. Call technique-engine service if available
  3. Fall back to current implementation if not

#### 2.3 Add Self-Consistency Wrapper
The technique-engine already supports self-consistency. Enable it via configuration:
```typescript
if (technique.supportsSelfConsistency && request.enableSC) {
  variantRequest.techniques.push(`${technique.id}_sc`)
}
```

### Phase 3: Calibrated Evaluation (Week 3)

#### 3.1 Replace QualityValidator
Current issue: QualityValidator hangs indefinitely

Solution: Use evaluator service's G-EVAL implementation
```typescript
// packages/core/src/index.ts
if (this.config.mode === 'microservices' && this.options.autoValidate) {
  const evaluation = await this.evaluatorClient.evaluate({
    variants,
    method: 'g-eval',
    includeConfidenceIntervals: true
  })
  variants = variants.map((v, i) => ({
    ...v,
    score: evaluation.results[i].score,
    confidence: evaluation.results[i].confidence
  }))
}
```

#### 3.2 Implement Calibration Monitoring
- Add background job to check evaluator calibration
- Store sentinel test cases in packages/core/tests/calibration/
- Alert if Spearman ρ < 0.8

### Phase 4: Retrieval Integration (Week 4)

#### 4.1 Detect Retrieval Needs
```typescript
// In technique selection
const needsRetrieval = taskType === 'factual_query' || 
                      taskType === 'research' ||
                      technique.requiresRetrieval
```

#### 4.2 Integrate RetrievalHub
```typescript
if (needsRetrieval) {
  const context = await this.retrievalClient.retrieve({
    query: basePrompt,
    maxChunks: 5,
    technique: 'ircot'
  })
  // Inject context into prompt generation
}
```

### Phase 5: Pareto Optimization (Week 5)

#### 5.1 Add Cost/Latency Tracking
- Track token usage for each variant
- Measure generation time
- Calculate cost based on model pricing

#### 5.2 Implement Pareto Filtering
```typescript
if (this.options.paretoFilter) {
  const optimized = await this.optimizerClient.paretoFilter({
    variants,
    objectives: ['quality', 'cost', 'latency']
  })
  return optimized
}
```

## Migration Strategy

### Step 1: Backward Compatibility
- Default to monolithic mode
- All existing APIs continue working
- No breaking changes

### Step 2: Progressive Enhancement
```typescript
// Enable microservices features progressively
const promptDial = new PromptDial({
  mode: process.env.PROMPTDIAL_MODE || 'monolithic',
  services: {
    techniqueEngine: process.env.TECHNIQUE_ENGINE_URL,
    evaluator: process.env.EVALUATOR_URL
  },
  fallbackToMonolithic: true
})
```

### Step 3: Feature Flags
```typescript
// Granular control over features
{
  features: {
    useTechniqueEngine: true,
    useEvaluator: true,
    useRetrieval: false,  // Enable when ready
    useParetoFilter: false
  }
}
```

## Testing Strategy

### Unit Tests
- Mock service clients for isolated testing
- Test both monolithic and microservices modes
- Verify fallback behavior

### Integration Tests
```typescript
// tests/integration/hybrid-mode.test.ts
describe('Hybrid Mode', () => {
  it('uses services when available', async () => {
    // Start test services
    const results = await promptDial.optimize({
      prompt: 'What is quantum computing?',
      useServices: true
    })
    expect(results[0].technique).toBe('ircot_retrieval')
  })
  
  it('falls back to monolithic when services down', async () => {
    // Don't start services
    const results = await promptDial.optimize({
      prompt: 'What is quantum computing?'
    })
    expect(results[0].technique).toBe('enhanced')
  })
})
```

### Performance Tests
- Measure latency overhead of service calls
- Compare monolithic vs microservices performance
- Validate Pareto optimization effectiveness

## Deployment Considerations

### Development Environment
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  core:
    build: ./packages/core
    environment:
      - PROMPTDIAL_MODE=microservices
      - TECHNIQUE_ENGINE_URL=http://technique-engine:3003
    depends_on:
      - technique-engine
      - evaluator
      - retrieval-hub
```

### Production Recommendations
1. Start with monolithic mode in production
2. Enable microservices mode in staging first
3. Use feature flags for gradual rollout
4. Monitor latency and error rates
5. Have automatic fallback to monolithic mode

## Success Metrics

### Technical Metrics
- [ ] All existing tests pass in both modes
- [ ] Service integration latency < 100ms overhead
- [ ] Evaluator calibration ρ > 0.8
- [ ] 95% of requests succeed without fallback

### Quality Metrics
- [ ] Factual queries show 10%+ improvement with retrieval
- [ ] Self-consistency reduces variance by 30%+
- [ ] Pareto filtering reduces cost by 40%+ for similar quality

## Risk Mitigation

### Risk 1: Service Latency
**Mitigation**: Aggressive timeouts, circuit breakers, parallel calls where possible

### Risk 2: Service Availability
**Mitigation**: Fallback to monolithic mode, health checks, graceful degradation

### Risk 3: Integration Complexity
**Mitigation**: Phased rollout, comprehensive logging, clear service contracts

### Risk 4: Cost Increase
**Mitigation**: Pareto optimization, caching, request deduplication

## Next Steps

1. **Week 1**: Implement service client infrastructure
2. **Week 2**: Integrate technique-engine for advanced techniques
3. **Week 3**: Replace QualityValidator with evaluator service
4. **Week 4**: Add retrieval for factual queries
5. **Week 5**: Implement Pareto optimization
6. **Week 6**: Testing, documentation, and production prep

## Conclusion

This surgical refactor leverages our existing microservices to deliver research-backed prompt optimization while maintaining the simplicity of our current monolithic deployment. The hybrid approach allows us to progressively enhance the system without breaking changes, ultimately delivering an evidence-aligned prompt-engineering engine that balances quality, cost, and latency.