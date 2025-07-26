# PromptDial 3.0 - Deployment Guide

## Overview

PromptDial 3.0 is a microservices-based prompt optimization engine consisting of 8 core services orchestrated by an API Gateway.

## Architecture

```
┌─────────────────┐
│   API Gateway   │ Port 3000
│   (Orchestrator)│
└────────┬────────┘
         │
    ┌────┴────────────────────────────────────┐
    │                                          │
┌───▼────┐ ┌──────────┐ ┌──────────┐ ┌───────▼──┐
│Classifier│ │Technique │ │Retrieval │ │Safety    │
│Port 3001 │ │Port 3003 │ │Port 3004 │ │Port 3006 │
└─────────┘ └──────────┘ └──────────┘ └──────────┘

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Telemetry │ │Evaluator │ │Optimizer │ │LLM Runner│
│Port 3002 │ │Port 3005 │ │Port 3007 │ │Port 400x │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start all services
./scripts/start-services.sh

# Or start individual services
npm run dev:classifier
npm run dev:technique
# etc...
```

### Docker Deployment

```bash
# Start with Docker Compose
docker-compose up

# Or build and run individually
docker build -f Dockerfile.service --build-arg SERVICE=classifier -t promptdial-classifier .
docker run -p 3001:3001 promptdial-classifier
```

## Service Configuration

### Environment Variables

Each service can be configured via environment variables:

#### API Gateway

- `PORT`: Gateway port (default: 3000)
- `RATE_LIMIT`: Requests per minute (default: 60)
- `ALLOWED_ORIGINS`: CORS origins (comma-separated)
- `[SERVICE]_URL`: Override service URLs

#### Classifier Service

- `PORT`: Service port (default: 3001)
- `COMPLEXITY_THRESHOLD`: Task complexity threshold

#### Technique Engine

- `PORT`: Service port (default: 3003)
- `MAX_VARIANTS`: Maximum variants to generate

#### Retrieval Hub

- `PORT`: Service port (default: 3004)
- `VECTOR_STORE_TYPE`: Vector store backend (memory/chroma/pinecone)
- `EMBEDDING_MODEL`: Embedding model to use

#### LLM Runner

- `PORT`: Service port (default: 4001+)
- `PROVIDER`: LLM provider (openai/anthropic/google)
- `API_KEY`: Provider API key
- `DEFAULT_MODEL`: Default model to use

#### Evaluator

- `PORT`: Service port (default: 3005)
- `CALIBRATION_THRESHOLD`: Drift detection threshold

#### Safety Guard

- `PORT`: Service port (default: 3006)
- `BLOCK_THRESHOLD`: Risk score threshold for blocking

#### Optimizer

- `PORT`: Service port (default: 3007)
- `OPTIMIZATION_MODE`: Default optimization mode

## Production Deployment

### Prerequisites

1. **API Keys**: Set up API keys for LLM providers
2. **Monitoring**: Configure telemetry endpoints
3. **Storage**: Set up persistent storage for telemetry and retrieval
4. **Load Balancer**: Configure load balancing for high availability

### Kubernetes Deployment

```yaml
# Example Kubernetes deployment for a service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: promptdial-classifier
spec:
  replicas: 3
  selector:
    matchLabels:
      app: promptdial-classifier
  template:
    metadata:
      labels:
        app: promptdial-classifier
    spec:
      containers:
        - name: classifier
          image: promptdial/classifier:2.0.0
          ports:
            - containerPort: 3001
          env:
            - name: NODE_ENV
              value: 'production'
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
```

### Health Checks

All services expose health endpoints:

- `GET /health` - Service health status
- Returns 200 if healthy, 503 if degraded

The API Gateway aggregates health from all services:

- `GET /health` - Overall system health
- `GET /health/:service` - Individual service health

### Monitoring

1. **Metrics**: Available at `GET /metrics` on each service
2. **Telemetry**: Centralized telemetry service collects all events
3. **Logging**: Structured JSON logging with trace IDs

### Security

1. **Rate Limiting**: Configured at API Gateway level
2. **Safety Checks**: All prompts pass through SafetyGuard
3. **API Keys**: Store securely, never commit to repository
4. **CORS**: Configure allowed origins explicitly

## Scaling Considerations

### Horizontal Scaling

Most services are stateless and can be scaled horizontally:

- Classifier: Scale based on request volume
- Technique Engine: Scale based on generation load
- Evaluator: Scale based on evaluation queue
- Safety Guard: Scale based on check volume
- Optimizer: Scale based on optimization requests

### Stateful Services

- Telemetry: Use external storage for persistence
- Retrieval Hub: Use distributed vector store

### Performance Tuning

1. **Connection Pooling**: Configure for LLM providers
2. **Caching**: Enable for classification and safety checks
3. **Timeouts**: Adjust based on LLM response times
4. **Batch Processing**: Enable for evaluations

## Troubleshooting

### Common Issues

1. **Service Discovery Failed**
   - Check service URLs in environment
   - Verify network connectivity
   - Check service health endpoints

2. **High Latency**
   - Check LLM provider quotas
   - Monitor service CPU/memory
   - Review telemetry for bottlenecks

3. **Safety Blocks**
   - Review safety guard logs
   - Check security patterns
   - Adjust thresholds if needed

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
export NODE_ENV=development
```

### Service Logs

Access logs for each service:

```bash
# Docker
docker logs promptdial-classifier

# Kubernetes
kubectl logs -l app=promptdial-classifier
```

## Maintenance

### Updates

1. Build new images with version tags
2. Update one service at a time
3. Verify health before proceeding
4. Roll back if issues detected

### Backup

- Telemetry data: Regular snapshots
- Vector store: Backup embeddings
- Configuration: Version control

### Monitoring Checklist

- [ ] All services healthy
- [ ] API Gateway accessible
- [ ] Telemetry collecting data
- [ ] Safety checks passing
- [ ] LLM providers connected
- [ ] Error rates within threshold
- [ ] Response times acceptable
