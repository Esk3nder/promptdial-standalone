# PromptDial - Quick Start Guide

## 🚀 Running Locally (2 commands)

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

## 🌐 Deploying to Vercel

1. Push to GitHub
2. Import to Vercel
3. Deploy (no configuration needed)

## 📁 File Structure

```
promptdial-standalone/
├── index.js          # Main server file
├── package.json      # Dependencies
├── vercel.json       # Vercel config
└── public/
    └── index.html    # Web UI
```

## 🔧 What's Included

- Simple Express server
- Beautiful web UI
- Mock optimization engine
- 3 optimization levels
- 5 AI model targets
- Zero configuration needed

## 🎯 API Usage

```bash
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a sorting algorithm",
    "targetModel": "gpt-4",
    "optimizationLevel": "advanced"
  }'
```

## ✅ Features

- **Easy Setup**: Just `npm install` and `npm start`
- **Vercel Ready**: Deploy with one click
- **No Workspaces**: Standalone package.json
- **Beautiful UI**: Modern, responsive interface
- **Mock Engine**: Works without API keys
