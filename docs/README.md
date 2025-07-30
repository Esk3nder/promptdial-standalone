# PromptDial 3.0 Documentation

Welcome to the complete documentation for PromptDial 3.0 - an enterprise-grade microservices platform for automatic prompt optimization.

## 📚 Documentation Index

### Getting Started
- **[Quick Start Guide](QUICK_START.md)** - Get up and running in minutes
- **[Testing Guide](TESTING_GUIDE.md)** - How to test the system thoroughly
- **[Test Prompts](TEST_PROMPTS.md)** - Example prompts for testing different scenarios

### Deployment & Operations
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment options (Docker, Cloud platforms)
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions

## 🏗️ System Overview

PromptDial 3.0 is a microservices-based platform that automatically optimizes AI prompts using advanced techniques:

- **API Gateway** (Port 3000) - Central orchestration and routing
- **Classifier** (Port 3001) - Task analysis and routing decisions  
- **Technique Engine** (Port 3003) - Implements 6+ optimization strategies
- **Evaluator** (Port 3005) - Quality assessment using multiple methods
- **Safety Guard** (Port 3006) - Security validation and filtering
- **Optimizer** (Port 3007) - Pareto optimization for quality/cost/latency
- **Telemetry** (Port 3002) - Monitoring and metrics collection
- **LLM Runners** (Port 400x) - Model-specific execution engines

## 🎯 Key Features

### Optimization Techniques
- Few-Shot Chain-of-Thought (CoT)
- Self-Consistency 
- ReAct (Reasoning + Acting)
- Tree of Thoughts
- IRCoT (Interleaved Retrieval CoT)
- DSPy Automatic Prompt Engineering

### Multi-Provider Support
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3)
- Google AI (Gemini Pro)
- Extensible to custom models

### Enterprise Features
- Multi-objective optimization (quality, cost, latency)
- 30+ security patterns for prompt injection prevention
- Calibrated evaluation with drift detection
- Production-grade monitoring and telemetry
- Docker and Kubernetes deployment options

## 🚀 Quick Navigation

**New to PromptDial?** Start with the [Quick Start Guide](QUICK_START.md)

**Deploying to production?** See the [Deployment Guide](DEPLOYMENT.md)

**Running into issues?** Check [Troubleshooting](TROUBLESHOOTING.md)

**Want to test thoroughly?** Follow the [Testing Guide](TESTING_GUIDE.md)

## 💡 Use Cases

PromptDial 3.0 is ideal for:

- **Enterprise AI Applications** - Optimize prompts for production workloads
- **Research & Development** - Experiment with different optimization techniques
- **Multi-Model Workflows** - Compare performance across different LLM providers
- **Cost Optimization** - Balance quality and cost for large-scale deployments
- **Security-Critical Applications** - Ensure prompts are safe from injection attacks

## 🤝 Support

- **Issues**: Report bugs and feature requests in the project repository
- **Documentation**: All guides are kept up-to-date in this docs folder
- **API Reference**: Available at `/api/docs` when the server is running

---

**PromptDial 3.0** - Enterprise-grade prompt optimization at scale. 🎯