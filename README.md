# PromptDial 2.0 🚀 - Autonomous Prompt Optimization Engine

> Enterprise-grade microservices platform for automatic prompt enhancement using advanced techniques and multi-objective optimization

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Microservices](https://img.shields.io/badge/Architecture-Microservices-green.svg)](docs/ARCHITECTURE.md)

## Overview

PromptDial 2.0 is a complete rewrite featuring a microservices architecture that automatically optimizes prompts using state-of-the-art techniques like Few-Shot Chain-of-Thought, Self-Consistency, ReAct, and Tree of Thoughts. It provides Pareto-optimal selection balancing quality, cost, and latency with enterprise-grade security and monitoring.

## ✨ Key Features

### Core Capabilities
- **🧠 Intelligent Classification**: Automatic task type, domain, and complexity detection
- **🎯 Advanced Techniques**: 6+ optimization strategies (Few-Shot CoT, Self-Consistency, ReAct, Tree of Thought, IRCoT, DSPy)
- **🔍 Retrieval-Augmented**: Vector store integration for example retrieval and context enhancement
- **⚖️ Multi-Objective Optimization**: Pareto-optimal selection balancing quality, cost, and latency
- **🛡️ Security First**: 30+ security patterns for prompt injection and jailbreak prevention
- **📊 Calibrated Evaluation**: G-EVAL, ChatEval, Role-Debate, and Self-Consistency with drift detection

### Architecture Benefits
- **Microservices Design**: 8 specialized services for scalability and reliability
- **Multi-Provider Support**: OpenAI, Anthropic, Google AI, Cohere, and custom models
- **Enterprise Ready**: Production-grade monitoring, telemetry, and deployment options
- **API Gateway**: Unified interface with rate limiting and health monitoring

## 🏗️ Architecture

PromptDial 2.0 consists of 8 microservices:

```
┌─────────────────┐
│   API Gateway   │ Port 3000 - Central orchestration
└────────┬────────┘
         │
    ┌────┴─────────────────────────────────────┐
    │                                           │
┌───▼────┐ ┌──────────┐ ┌──────────┐ ┌────────▼──┐
│Classifier│ │Technique │ │Retrieval │ │SafetyGuard│
│Port 3001 │ │Port 3003 │ │Port 3004 │ │Port 3006  │
└─────────┘ └──────────┘ └──────────┘ └───────────┘
                                          
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐
│Telemetry │ │Evaluator │ │Optimizer │ │LLM Runner │
│Port 3002 │ │Port 3005 │ │Port 3007 │ │Port 400x  │
└──────────┘ └──────────┘ └──────────┘ └───────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- API keys for at least one LLM provider

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/promptdial-standalone.git
cd promptdial-standalone

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your API keys
```

### Start Services

```bash
# Option 1: Start all services locally
./scripts/start-services.sh

# Option 2: Start with Docker
docker-compose up

# Option 3: Start services individually
npm run dev:classifier  # Task classifier
npm run dev:technique   # Technique engine
npm run dev:safety      # Safety guard
# ... etc
```

### Basic API Usage

```bash
# Optimize a prompt
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a Python function to sort a list",
    "options": {
      "max_variants": 5,
      "cost_cap_usd": 0.10
    }
  }'

# Check system health
curl http://localhost:3000/health
```

### Node.js/TypeScript Usage

```typescript
import axios from 'axios'

const result = await axios.post('http://localhost:3000/api/optimize', {
  prompt: 'Explain quantum computing',
  options: {
    max_variants: 3,
    preferences: {
      quality: 0.7,
      cost: 0.2,
      latency: 0.1
    }
  }
})

console.log(result.data.result.recommended_variant)
```

## 🎯 Optimization Techniques

PromptDial 2.0 implements cutting-edge prompt optimization strategies:

### 1. **Few-Shot Chain-of-Thought (CoT)**
- Adds step-by-step reasoning examples
- Improves accuracy on complex tasks
- Best for: Math, reasoning, analysis

### 2. **Self-Consistency**
- Generates multiple reasoning paths
- Uses voting for robust answers
- Best for: High-stakes decisions

### 3. **ReAct (Reasoning + Acting)**
- Interleaves reasoning and actions
- Structured thought process
- Best for: Multi-step tasks

### 4. **Tree of Thoughts**
- Explores multiple reasoning branches
- Backtracks when needed
- Best for: Creative problem solving

### 5. **IRCoT (Interleaved Retrieval CoT)**
- Retrieves relevant examples dynamically
- Enhances with external knowledge
- Best for: Knowledge-intensive tasks

### 6. **DSPy Automatic Prompt Engineering**
- Learns optimal prompts from data
- Self-improving optimization
- Best for: Repeated similar tasks

## 📡 API Reference

### POST /api/optimize

Main optimization endpoint that orchestrates all services.

**Request Body:**
```json
{
  "prompt": "Your prompt text",
  "options": {
    "max_variants": 5,
    "cost_cap_usd": 0.20,
    "latency_cap_ms": 5000,
    "security_level": "strict",
    "preferences": {
      "quality": 0.6,
      "cost": 0.3,
      "latency": 0.1
    },
    "task_type": "code_generation",
    "examples": ["optional examples"],
    "reference_output": "optional expected output"
  }
}
```

**Response:**
```json
{
  "success": true,
  "trace_id": "unique-trace-id",
  "result": {
    "task_classification": {
      "task_type": "code_generation",
      "domain": "programming",
      "complexity": 0.7,
      "safety_risk": "low"
    },
    "variants": [
      {
        "id": "v1",
        "technique": "FewShot_CoT",
        "prompt": "optimized prompt text",
        "cost_usd": 0.02,
        "latency_ms": 1200,
        "score": 0.92
      }
    ],
    "recommended_variant": { /* best variant */ },
    "optimization_metadata": {
      "techniques_used": ["FewShot_CoT", "ReAct"],
      "pareto_frontier_size": 3,
      "safety_modifications": false
    }
  }
}
```

### Health & Monitoring

- `GET /health` - System health status
- `GET /health/:service` - Individual service health
- `GET /metrics` - Performance metrics
- `GET /services` - Service discovery

## 🛡️ Security Features

PromptDial 2.0 includes comprehensive security:

### Threat Detection
- **Prompt Injection**: 15+ patterns including instruction override, role hijacking
- **Jailbreaks**: DAN mode, pretend scenarios, hypotheticals
- **Data Exfiltration**: Training data probes, API key fishing
- **Evasion Techniques**: Base64 encoding, Unicode tricks, leetspeak

### Protection Mechanisms
- Real-time prompt sanitization
- Content filtering and PII redaction
- Risk scoring (0-1 scale)
- Configurable blocking thresholds
- Complete audit trail

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific service
cd packages/classifier && npm test

# Integration tests
npm run test:integration

# Test security patterns
cd packages/safety-guard && npm run test
```

## 📊 Monitoring & Telemetry

The telemetry service tracks:
- Request latencies and throughput
- Token usage and costs
- Optimization patterns
- Error rates and retry attempts
- Technique effectiveness
- Security violations

Access metrics at `http://localhost:3000/metrics`

## 🚢 Production Deployment

### Docker Deployment

```bash
# Build and start all services
docker-compose up --build

# Scale specific services
docker-compose up --scale evaluator=3 --scale classifier=2
```

### Kubernetes

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Kubernetes manifests and production configuration.

### Configuration

Key environment variables:
```env
# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Service Config
RATE_LIMIT=60
LOG_LEVEL=info
NODE_ENV=production

# Vector Store (optional)
VECTOR_STORE_TYPE=chroma
CHROMA_URL=http://localhost:8000
```

## 📚 Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment
- [Architecture](docs/ARCHITECTURE.md) - System design
- [API Reference](docs/API.md) - Complete API docs
- [Security](docs/SECURITY.md) - Security implementation
- [Contributing](CONTRIBUTING.md) - Contribution guidelines

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built on research from:
- [Chain-of-Thought Prompting](https://arxiv.org/abs/2201.11903)
- [Self-Consistency](https://arxiv.org/abs/2203.11171)
- [ReAct Framework](https://arxiv.org/abs/2210.03629)
- [Tree of Thoughts](https://arxiv.org/abs/2305.10601)
- [DSPy](https://github.com/stanfordnlp/dspy)

---

**PromptDial 2.0** - Enterprise-grade prompt optimization at scale. 🎯