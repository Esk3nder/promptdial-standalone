# 🚀 Run the Live Dashboard

Follow these steps to launch the PromptDial Live Testing Dashboard:

## Step 1: Start the API Server

Open a terminal and run:

```bash
cd packages/core
npm run server
```

You should see:
```
🚀 PromptDial API server running on http://localhost:3001
📡 SSE endpoint: http://localhost:3001/api/test-stream/:testId
```

Keep this terminal running!

## Step 2: Start the UI Development Server

Open a **new terminal** and run:

```bash
cd packages/ui
npm run dev
```

You should see Vite start up:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

## Step 3: Open the Dashboard

Open your browser and go to:

**http://localhost:5173/test-dashboard.html**

## How to Use the Dashboard

1. **Enter a prompt** in the text area
2. **Select options**:
   - Target Model: GPT-4, Claude 3 Opus, or Gemini Pro
   - Optimization Level: Basic, Advanced, or Expert
3. **Click "Start Test"**
4. **Watch the live updates** as each provider is tested
5. **View results**:
   - Real-time status updates
   - Performance comparisons
   - Token usage metrics
   - Best optimized prompt

## Example Prompts to Try

```
# Simple prompt
What is machine learning?

# Complex prompt
Create a Python function that implements a binary search tree with insert, delete, and search operations

# Creative prompt
Write a haiku about programming

# Analytical prompt
Analyze the pros and cons of renewable energy sources
```

## Troubleshooting

- **Server not starting?** Make sure you're in the `packages/core` directory
- **UI not loading?** Make sure you're in the `packages/ui` directory
- **Connection errors?** Ensure the server is running on port 3001
- **No API responses?** Check that your `.env` file has valid API keys

## Features You'll See

- ✅ **Live Progress Updates** - See each test as it happens
- 📊 **Performance Charts** - Visual comparisons of response times
- 🎯 **Quality Scores** - See how well each prompt was optimized
- 📋 **Copy Optimized Prompts** - One-click copy to clipboard
- 🔄 **Real-time Streaming** - Server-Sent Events for instant updates

Enjoy testing your prompts with real-time feedback!