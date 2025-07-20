# PromptDial Live Test Dashboard

A real-time dashboard for testing prompt performance across multiple AI providers with live streaming updates.

## Features

- 🚀 **Live Testing**: Real-time updates as prompts are tested
- 📊 **Performance Metrics**: Response time and token usage comparisons
- 🎯 **Multi-Provider**: Test with OpenAI, Anthropic, and Google simultaneously
- 📈 **Visual Analytics**: Charts showing performance improvements
- 💾 **Export Results**: Save test results for later analysis

## Setup

### 1. Install Dependencies

From the root directory:
```bash
npm install
```

### 2. Start the API Server

In one terminal, start the backend server:
```bash
cd packages/core
npm run server
```

The server will start on http://localhost:3001

### 3. Start the UI Development Server

In another terminal, start the frontend:
```bash
cd packages/ui
npm run dev
```

Then navigate to: http://localhost:5173/test-dashboard.html

## Usage

1. **Enter a Prompt**: Type your prompt in the text area
2. **Select Options**: 
   - Target Model: GPT-4, Claude 3 Opus, or Gemini Pro
   - Optimization Level: Basic, Advanced, or Expert
3. **Start Test**: Click "Start Test" to begin
4. **Watch Live Updates**: See real-time progress as each provider is tested
5. **View Results**: 
   - Performance comparisons
   - Token usage analytics
   - Best optimized prompt with quality score

## Architecture

### Backend (Express + SSE)
- `/api/test` - POST endpoint to start a test
- `/api/test-stream/:testId` - SSE endpoint for live updates
- Event-driven architecture using EventEmitter

### Frontend (React + TypeScript)
- `TestDashboard.tsx` - Main orchestrator component
- `LiveTestStatus.tsx` - Real-time status updates
- `ProviderCard.tsx` - Individual provider results
- `ComparisonChart.tsx` - Performance visualizations
- `OptimizedPromptViewer.tsx` - Display optimized prompts

### Real-time Flow
1. User submits prompt
2. Backend starts test and returns test ID
3. Frontend connects to SSE stream
4. Backend emits events as tests progress
5. Frontend updates UI in real-time
6. Final results displayed with analytics

## API Events

The SSE stream emits these events:

- `test_started` - Test initiated
- `provider_test_started` - Starting test with a specific provider
- `provider_test_completed` - Provider test finished with results
- `optimization_started` - Prompt optimization beginning
- `optimization_completed` - Optimization finished
- `test_completed` - All tests complete
- `test_error` - Error occurred

## Customization

### Adding New Providers
1. Add provider client in `packages/core/src/testing/clients/`
2. Update `ModelProvider` type
3. Add provider icon/name in `ProviderCard.tsx`

### Styling
Edit `packages/ui/src/TestDashboard.css` for custom styling

## Troubleshooting

- **CORS Issues**: Ensure the server is running on port 3001
- **Connection Lost**: Check if the server is still running
- **No Results**: Verify API keys are set in `.env` file