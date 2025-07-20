# 🌐 PromptDial Web Testing Guide

## No CLI Required! Test Everything from Your Browser

PromptDial 2.0 now includes a complete web-based testing interface. You can run all tests, monitor services, and optimize prompts directly from your browser - no command line needed!

## 🚀 Quick Start (2 Steps)

### Step 1: Start the Services
```bash
# In your terminal, run just this one command:
./scripts/deploy-local.sh
```

### Step 2: Open the Web Interface
```bash
# Start the web server:
./status-server.js

# Then open in your browser:
http://localhost:8080/test
```

That's it! Everything else happens in the browser.

## 🧪 Complete Testing Dashboard

Visit **http://localhost:8080/test** to access the full testing interface:

### Main Features:

1. **Prompt Optimization Testing**
   - Enter any prompt you want to optimize
   - Configure optimization preferences (quality, cost, latency)
   - Select which techniques to use
   - See real-time results with scores and recommendations

2. **Quick Test Scenarios**
   - **Code Generation**: Test programming prompts
   - **Creative Writing**: Optimize creative content prompts
   - **Data Analysis**: Enhance analytical prompts
   - **Q&A**: Improve question-answering
   - **Math Problems**: Optimize mathematical reasoning
   - **Safety Test**: Verify security filtering

3. **Service Monitoring**
   - Real-time health status for all 11 microservices
   - Latency measurements
   - Visual indicators (green = healthy, red = offline)
   - One-click refresh

4. **Test History**
   - All your tests are saved locally
   - Review previous optimizations
   - Re-run tests with one click
   - Export results

## 📱 Interface Overview

### Testing a Prompt

1. **Basic Test**:
   - Type your prompt in the text area
   - Click "Optimize Prompt"
   - View results in real-time

2. **Advanced Options**:
   - Click "Advanced Options" to expand
   - Adjust quality/cost/latency weights
   - Select specific optimization techniques
   - Set max number of variants

3. **Using Test Scenarios**:
   - Click any scenario card
   - The form auto-fills with example data
   - Modify as needed
   - Run the test

### Understanding Results

When you run a test, you'll see:

- **Task Classification**: How PromptDial categorized your prompt
- **Generated Variants**: Multiple optimized versions
- **Scores & Metrics**: Quality scores, cost estimates, token counts
- **Recommended Variant**: The best option based on your preferences
- **Evaluation Details**: Breakdown of scoring criteria

## 🎯 Example Test Flow

1. **Open Testing Dashboard**: http://localhost:8080/test

2. **Try a Quick Scenario**:
   - Click "Code Generation" scenario
   - Review the auto-filled prompt
   - Click "Optimize Prompt"

3. **View Results**:
   - See 3 optimized variants
   - Compare scores and costs
   - Copy the recommended variant
   - Use it in your application

## 🔧 Service Management

In the web interface, navigate to "Service Status" to:

- View all running services
- Check health status
- Monitor response times
- Identify any issues

## 💡 Tips for Best Results

1. **Start Simple**: Use the pre-built scenarios first
2. **Adjust Weights**: Experiment with quality/cost/latency preferences
3. **Multiple Techniques**: Try different optimization techniques
4. **Save Good Results**: Copy optimized prompts for future use
5. **Monitor Costs**: Keep an eye on API usage in results

## 🚨 Troubleshooting

### "Optimization Failed" Error
- Check Service Status tab - all services should be green
- Ensure you have API keys configured in `.env`
- Verify services started successfully

### Services Show as Offline
- Make sure you ran `./scripts/deploy-local.sh`
- Check terminal for any startup errors
- Try refreshing the page

### No LLM Provider Configured
- Add at least one API key to `.env`:
  ```
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=sk-ant-...
  GOOGLE_AI_API_KEY=AIza...
  ```
- Restart services after adding keys

## 🎉 No More CLI Testing!

Everything you need is now in the web interface:

- ✅ Run optimization tests
- ✅ View real-time results
- ✅ Monitor service health
- ✅ Track test history
- ✅ Export results
- ✅ Copy optimized prompts

Just open **http://localhost:8080/test** and start optimizing!

## 📊 Other Available Dashboards

- **http://localhost:8080/test** - Complete testing interface (recommended)
- **http://localhost:8080/dashboard** - Service monitoring dashboard
- **http://localhost:8080** - Simple status page

## 🔄 Auto-Save & History

All your tests are automatically saved in browser storage:
- Access previous tests in the "Test History" section
- Re-run any test with one click
- Results persist between sessions
- Export data as JSON

---

**Ready to test?** Just run `./status-server.js` and open http://localhost:8080/test in your browser!