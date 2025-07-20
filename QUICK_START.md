# PromptDial Quick Start Guide

## 🚀 One-Command Setup

To run PromptDial with the web UI:

```bash
# First time only - install dependencies
npm install

# Start the server
npm start
```

This will:
1. Start the PromptDial server on `http://localhost:3000`
2. Serve the web UI automatically
3. Open your browser to the UI

## 📱 What You Get

Once running, you can:
- Enter prompts to optimize
- Select target AI models (GPT-4, Claude, Gemini)
- Choose optimization levels (Basic, Advanced, Expert)
- See quality scores and improvements
- Copy optimized prompts with one click

## 🛠️ Alternative Commands

### Run the server manually:
```bash
cd packages/core
npm run server
```

### Development mode (with hot reload):
```bash
# Terminal 1: Run the UI dev server
cd packages/ui
npm run dev

# Terminal 2: Run the API server
cd packages/core
npm run server:dev
```

## 🔧 Configuration

The server runs on port 3000 by default. To change:
```bash
PORT=8080 npm start
```

## 📝 API Endpoint

The optimization API is available at:
```
POST http://localhost:3000/api/optimize

Body:
{
  "prompt": "Your prompt here",
  "targetModel": "gpt-4",
  "optimizationLevel": "advanced",
  "taskType": "general" // optional
}
```

## 🎯 That's It!

No complex setup, no multiple terminals - just `npm start` and you're ready to optimize prompts!