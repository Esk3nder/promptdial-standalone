# PromptDial Deployment Guide

## Quick Start (Local)

```bash
# 1. Clone the repository
git clone <repo-url>
cd promptdial-standalone

# 2. Add your API key to .env
echo "ANTHROPIC_API_KEY=your-key-here" > packages/core/.env

# 3. Install and run
cd packages/core
npm install
npm start
```

## Docker Deployment

### Option 1: Docker Compose (Recommended)

```bash
# 1. Create .env file with your API keys
cat > .env << EOF
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
GOOGLE_AI_API_KEY=your-google-key
EOF

# 2. Build and run
docker-compose -f docker-compose.simple.yml up -d

# 3. Check health
curl http://localhost:3000/health
```

### Option 2: Docker Run

```bash
# 1. Build the image
docker build -t promptdial .

# 2. Run the container
docker run -d \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=your-key \
  --name promptdial \
  promptdial

# 3. Check logs
docker logs promptdial
```

## Cloud Deployment

### Railway (One-Click Deploy)

1. Fork this repository
2. Connect Railway to your GitHub
3. Create new project from repo
4. Add environment variables:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY` (optional)
   - `GOOGLE_AI_API_KEY` (optional)
5. Deploy!

### Render

```yaml
# render.yaml
services:
  - type: web
    name: promptdial
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: PORT
        value: 3000
      - key: ANTHROPIC_API_KEY
        sync: false
```

### Fly.io

```toml
# fly.toml
app = "promptdial"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
  
  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.http_checks]]
    interval = 30000
    timeout = 3000
    path = "/health"
```

### Google Cloud Run

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT-ID/promptdial

# Deploy to Cloud Run
gcloud run deploy promptdial \
  --image gcr.io/PROJECT-ID/promptdial \
  --platform managed \
  --port 3000 \
  --set-env-vars ANTHROPIC_API_KEY=your-key
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | One of these | Anthropic Claude API key |
| `OPENAI_API_KEY` | One of these | OpenAI GPT API key |
| `GOOGLE_AI_API_KEY` | One of these | Google Gemini API key |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (default: production) |

## API Usage

### Basic Optimization

```bash
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain quantum computing"}'
```

### With Options

```bash
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a blog post about AI",
    "options": {
      "maxVariants": 3,
      "taskType": "creative"
    }
  }'
```

### Health Check

```bash
curl http://localhost:3000/health
```

## Monitoring

### Basic Health Check

The `/health` endpoint returns:
```json
{
  "status": "healthy",
  "service": "promptdial-core",
  "version": "1.0.0",
  "uptime": 123.456,
  "timestamp": "2025-07-28T12:34:56.789Z"
}
```

### Logs

- **Docker**: `docker logs promptdial`
- **PM2**: `pm2 logs promptdial`
- **Systemd**: `journalctl -u promptdial`

## Production Checklist

- [ ] Set strong API keys
- [ ] Configure rate limiting
- [ ] Set up monitoring/alerts
- [ ] Enable HTTPS (use reverse proxy)
- [ ] Configure backup strategy
- [ ] Set resource limits
- [ ] Enable access logging

## Troubleshooting

### No Variants Returned

- Check API keys are valid
- Ensure model names match (e.g., `claude-3-opus`, `gpt-4`)
- Check server logs for errors

### High Latency

- API calls to LLMs can take 5-30 seconds
- Consider implementing caching
- Use streaming endpoint for progress updates

### Memory Issues

- Default Node.js heap: 512MB
- Increase if needed: `node --max-old-space-size=2048 dist/server.js`

## Support

- GitHub Issues: [repo-url]/issues
- Documentation: See `/docs` folder