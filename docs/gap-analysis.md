# PromptDial 3.0 Gap Analysis

## Executive Summary

Current implementation already has a comprehensive microservices architecture with all core services. Key gaps are in API schema alignment, advanced features, and test canonization.

## 1. Architecture Comparison

### ✅ Implemented (Matching PRD)
- **All 9 core microservices** (API Gateway, Classifier, Telemetry, Technique Engine, Retrieval Hub, Evaluator, Safety Guard, Optimizer, LLM Runners)
- **Microservices communication** via HTTP REST
- **Docker containerization** with docker-compose
- **Service discovery** through environment variables
- **Health checks** on all services
- **Horizontal scaling** capability

### ⚠️ Gaps
- **gRPC support** - Only REST currently implemented
- **Service mesh** - No Istio/Linkerd integration
- **Strategy Planner service** - Extra service not in PRD (port 3008)

## 2. Functional Requirements Gap Analysis

| FR ID | Requirement | Current State | Gap |
|-------|-------------|---------------|-----|
| FR-1 | Task classifier ≤50ms P95 | ✅ Implemented | ⚠️ No performance metrics |
| FR-2 | Generate ≥4 techniques | ✅ 10+ techniques | ✅ None |
| FR-3 | Retrieval with recall@5 ≥0.8 | ✅ Vector store | ⚠️ No recall metrics |
| FR-4 | Block override directives | ✅ 30+ patterns | ✅ None |
| FR-5 | Calibrated evaluator with CI | ⚠️ Basic scoring | ❌ No calibration/CI |
| FR-6 | Pareto selection | ✅ Implemented | ✅ None |
| FR-7 | Telemetry with warehouse | ⚠️ Basic logging | ❌ No warehouse schema |
| FR-8 | REST API compliance | ⚠️ Different schema | ❌ Schema mismatch |

## 3. API Schema Gaps

### PRD Request Schema
```json
{
  "base_prompt": "string",
  "task_hint": "string",
  "max_variants": 6,
  "cost_cap_usd": 0.20,
  "latency_cap_ms": 6000,
  "security_level": "strict"
}
```

### Current Request Schema
```json
{
  "prompt": "string",
  "level": "basic|advanced|expert",
  "maxVariants": 5,
  "autoSort": true,
  "validateQuality": true
}
```

### Key Differences:
- Field naming conventions (camelCase vs snake_case)
- Missing cost/latency caps
- Different abstraction level (optimization level vs task hint)
- Missing security level parameter

## 4. Technique Implementation Gaps

### ✅ Implemented
- Few-Shot CoT
- Self-Consistency
- ReAct
- Tree of Thoughts
- Chain of Thought
- Role-based prompting

### ❌ Missing from PRD
- IRCoT (Interleaved Retrieval CoT)
- DSPy-style APE/GrIPS
- AutoDiCoT
- Universal Self-Consistency Prompt (USP)

## 5. Evaluator Gaps

### ✅ Implemented
- G-EVAL
- ChatEval  
- Role-Debate
- Basic scoring

### ❌ Missing
- Confidence intervals (CI)
- Calibration against sentinel sets
- Drift detection
- AutoCoT in evaluation

## 6. Security Gaps

### ✅ Implemented
- 30+ injection patterns
- Sanitization
- Pattern detection

### ❌ Missing
- Llama-Guard/RebuffAI integration
- System instruction sandwich
- Execution sandbox for code
- Risk score threshold (0.3)

## 7. Telemetry Gaps

### ✅ Implemented
- Request tracking
- Basic metrics
- Service logs

### ❌ Missing
- Warehouse-compatible schema
- BigQuery partitioning
- Complete event structure per PRD
- Cost tracking in USD

## 8. Non-Functional Gaps

| Requirement | Status | Gap |
|-------------|--------|-----|
| Performance (<3x single LLM) | ⚠️ Unknown | No benchmarks |
| SOC-2/GDPR compliance | ❌ Not implemented | No data retention policies |
| OpenTelemetry traces | ❌ Basic logging only | Full tracing needed |
| Prometheus metrics | ⚠️ Basic metrics | Need full instrumentation |

## 9. Missing Features

1. **Continuous Learning Loop**
   - No nightly job for retraining
   - No bandit preference model
   - No human feedback collection

2. **Edge Case Handling**
   - No budget validation
   - No human review queue
   - No minimum budget estimation

3. **Test Cases**
   - Consumer prompts not canonized
   - No integration tests for full flow
   - No red-team security suite

## 10. Additional Services (Beyond PRD)

- **Strategy Planner** (port 3008) - PromptDial 3.0 specific
- **UI Package** - Web interface not in PRD

## Priority Actions

1. **HIGH**: API schema alignment
2. **HIGH**: Canonize test cases  
3. **HIGH**: Security enhancements
4. **MEDIUM**: Missing techniques
5. **MEDIUM**: Evaluator calibration
6. **MEDIUM**: Telemetry warehouse
7. **LOW**: gRPC support
8. **LOW**: Continuous learning