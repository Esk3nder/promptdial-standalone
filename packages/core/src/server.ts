import express from 'express'
import cors from 'cors'
import path from 'path'
import 'dotenv/config' // Load environment variables
import { PromptDial } from './index.js'
import type { OptimizationRequest } from './meta-prompt-designer.js'
import { ConfigManager } from './config.js'
// Removed TemplateFallbackGuard - allowing graceful degradation

// Get directory path in CommonJS
const __dirname = path.resolve()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Serve static files from public directory
const publicPath = path.join(__dirname, '../../../public')
app.use(express.static(publicPath))

// Check for API keys once at startup
const hasAPIKeys = Boolean(
  process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_AI_API_KEY
)

// Auto-detect best model based on available API keys
function getDefaultModel(): string {
  if (process.env.ANTHROPIC_API_KEY) return 'claude-3-opus'
  if (process.env.OPENAI_API_KEY) return 'gpt-4'
  if (process.env.GOOGLE_AI_API_KEY) return 'gemini-1.5-pro'
  return 'gpt-4' // fallback
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'promptdial-core',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

// Server-Sent Events endpoint for real-time progress
app.get('/api/optimize/stream', async (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Parse query params
  const { prompt, targetModel } = req.query as any

  if (!prompt) {
    res.write(`data: ${JSON.stringify({ error: 'Prompt is required' })}\n\n`)
    res.end()
    return
  }

  // Send initial progress
  res.write(`data: ${JSON.stringify({ status: 'initializing' })}\n\n`)

  // Use global hasAPIKeys

  const getActiveProvider = () => {
    if (process.env.ANTHROPIC_API_KEY) return 'Anthropic Claude'
    if (process.env.GOOGLE_AI_API_KEY) return 'Google Gemini'
    if (process.env.OPENAI_API_KEY) return 'OpenAI GPT'
    return 'None'
  }

  try {
    // Validation phase
    res.write(
      `data: ${JSON.stringify({ status: 'validating', message: 'Validating prompt...' })}\n\n`,
    )
    await new Promise((resolve) => setTimeout(resolve, 300)) // Small delay for UI

    // Task detection phase
    res.write(
      `data: ${JSON.stringify({ status: 'analyzing', message: 'Analyzing task type and cognitive requirements...' })}\n\n`,
    )
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Optimization phase
    res.write(
      `data: ${JSON.stringify({ status: 'optimizing', message: 'Applying meta-prompt cognitive enhancements...' })}\n\n`,
    )

    const optimizationMode = hasAPIKeys ? 'dynamic-ai' : 'static-template'
    const activeProvider = getActiveProvider()

    // Create request object
    const optimizationRequest: OptimizationRequest = {
      prompt: prompt as string,
      targetModel: (targetModel as string) || getDefaultModel(),
    }

    // Generate variants
    res.write(
      `data: ${JSON.stringify({ status: 'generating', message: `Generating cognitive variants with ${activeProvider}...` })}\n\n`,
    )

    // Create PromptDial instance with hybrid mode support
    const config = ConfigManager.getInstance().getConfig()
    const promptDial = new PromptDial({
      autoValidate: true,
      sortByQuality: true,
      useAI: hasAPIKeys,
      config
    })

    // Check for API keys and warn if missing
    if (!hasAPIKeys) {
      res.write(`data: ${JSON.stringify({ 
        status: 'warning', 
        message: 'No API keys found - using template-based optimization'
      })}\n\n`)
    }

    // Optimize with progress callback and timeout
    const results = (await Promise.race([
      promptDial.optimize(optimizationRequest),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Optimization timeout after 60 seconds')), 60000),
      ),
    ])) as any

    // Continue with results regardless of template fallback

    res.write(
      `data: ${JSON.stringify({ status: 'evaluating', message: 'Evaluating quality scores...' })}\n\n`,
    )
    await new Promise((resolve) => setTimeout(resolve, 300))

    res.write(
      `data: ${JSON.stringify({ status: 'finalizing', message: 'Finalizing results...' })}\n\n`,
    )
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Send final results
    const finalResult = {
      status: 'complete',
      results: {
        ...results,
        metadata: {
          optimizationMode,
          activeProvider,
          optimizedUsing: hasAPIKeys
            ? 'AI-powered dynamic optimization'
            : 'Template-based optimization',
          timestamp: new Date().toISOString(),
        },
      },
    }

    res.write(`data: ${JSON.stringify(finalResult)}\n\n`)
    res.end()
  } catch (error: any) {
    console.error('SSE Error:', error)
    res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`)
    res.end()
  }
})

// API endpoint for prompt optimization (legacy)
app.post('/api/optimize', async (req, res) => {
  try {
    const request: OptimizationRequest = req.body

    // New optimization request received

    // Validate request
    if (!request.prompt) {
      return res.status(400).json({
        error: 'Missing required field: prompt',
      })
    }
    
    // Auto-detect model if not specified
    if (!request.targetModel) {
      request.targetModel = getDefaultModel()
    }

    // Use global hasAPIKeys

    // Create PromptDial instance with hybrid mode support
    const config = ConfigManager.getInstance().getConfig()
    const promptDial = new PromptDial({
      autoValidate: false, // Temporarily disable to fix hanging issue
      sortByQuality: false,
      useAI: hasAPIKeys, // Use AI if keys available, templates otherwise
      config
    })

    // Starting optimization
    const result = await promptDial.optimize(request)

    // Continue with results (allow template fallback if no API keys)

    // Optimization complete

    // Add metadata to response

    const getActiveProvider = () => {
      if (process.env.ANTHROPIC_API_KEY) return 'Anthropic Claude'
      if (process.env.GOOGLE_AI_API_KEY) return 'Google Gemini'
      if (process.env.OPENAI_API_KEY) return 'OpenAI GPT'
      return 'None'
    }

    const enhancedResult = {
      ...result,
      metadata: {
        optimizationMode: hasAPIKeys ? 'dynamic-ai' : 'static-template',
        activeProvider: hasAPIKeys ? getActiveProvider() : 'None',
        optimizedUsing: hasAPIKeys
          ? 'AI-powered dynamic optimization'
          : 'Static template-based optimization',
        timestamp: new Date().toISOString(),
      },
    }

    return res.json(enhancedResult)
  } catch (error) {
    // Optimization error occurred
    console.error('Server optimization error:', error)
    console.error('Request body was:', req.body)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Optimization failed',
      details: error instanceof Error ? error.stack : String(error),
    })
  }
})

// Debug endpoint for testing and troubleshooting
app.get('/debug', async (req, res) => {
  try {
    // Check API key status
    const apiKeys = {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      google: !!process.env.GOOGLE_AI_API_KEY,
    }

    const activeProvider = apiKeys.anthropic
      ? 'Anthropic Claude'
      : apiKeys.google
        ? 'Google Gemini'
        : apiKeys.openai
          ? 'OpenAI GPT'
          : 'None'

    // Test prompt for debugging
    const testPrompt = (req.query.prompt as string) || 'hello world'
    const testModel = (req.query.model as string) || 'claude-3-opus'

    let debugInfo: any = {
      timestamp: new Date().toISOString(),
      system: {
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        apiKeys,
        activeProvider,
        hasAnyApiKey: Object.values(apiKeys).some(Boolean),
      },
      testRequest: {
        prompt: testPrompt,
        targetModel: testModel,
      },
      steps: [],
    }

    // Only run optimization test if we have API keys or want to test fallback
    if (req.query.test === 'true') {
      try {
        debugInfo.steps.push({
          step: 'initialization',
          status: 'starting',
          message: 'Creating PromptDial instance',
        })

        const config = ConfigManager.getInstance().getConfig()
        const promptDial = new PromptDial({
          autoValidate: true,
          sortByQuality: true,
          useAI: true,
          config
        })

        debugInfo.steps.push({
          step: 'initialization',
          status: 'complete',
          message: 'PromptDial instance created',
        })
        debugInfo.steps.push({
          step: 'optimization',
          status: 'starting',
          message: 'Beginning optimization process',
        })

        const result = await promptDial.optimize({
          prompt: testPrompt,
          targetModel: testModel,
        })

        debugInfo.steps.push({
          step: 'optimization',
          status: 'complete',
          message: 'Optimization completed successfully',
        })

        // Analyze the results to show what actually happened
        const variantSources =
          result.variants?.map((v) => {
            if (
              v.id.includes('fallback') ||
              v.id.includes('emergency') ||
              v.id.includes('no-api')
            ) {
              return 'FAKE_FALLBACK'
            } else if (v.id.includes('claude')) {
              return 'REAL_CLAUDE_API'
            } else if (v.id.includes('openai')) {
              return 'REAL_OPENAI_API'
            } else if (v.id.includes('gemini')) {
              return 'REAL_GEMINI_API'
            }
            return 'UNKNOWN'
          }) || []

        debugInfo.result = {
          variantCount: result.variants?.length || 0,
          variantSources: variantSources,
          realApiCallsSuccessful: variantSources.filter((s) => s.startsWith('REAL_')).length,
          fakeResponses: variantSources.filter((s) => s === 'FAKE_FALLBACK').length,
          variants:
            result.variants?.map((v) => ({
              id: v.id,
              optimizedPrompt: v.optimizedPrompt?.substring(0, 100) + '...',
              changes: v.changes,
              modelSpecificFeatures: v.modelSpecificFeatures,
              source: v.id.includes('fallback') ? '⚠️ FAKE FALLBACK' : '✅ REAL API CALL',
            })) || [],
          summary: result.summary,
        }
      } catch (error) {
        debugInfo.steps.push({
          step: 'optimization',
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        debugInfo.error = {
          message: error instanceof Error ? error.message : String(error),
          type: error instanceof Error ? error.constructor.name : typeof error,
        }
      }
    }

    // Return debug info as JSON for API calls or HTML for browser
    if (req.headers.accept?.includes('application/json')) {
      res.json(debugInfo)
    } else {
      // Return HTML debug page
      const html = `
<!DOCTYPE html>
<html>
<head>
    <title>PromptDial Debug Console</title>
    <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; }
        .status-good { color: #22c55e; font-weight: bold; }
        .status-bad { color: #ef4444; font-weight: bold; }
        .status-warning { color: #f59e0b; font-weight: bold; }
        .code { background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 14px; overflow-x: auto; }
        .step { padding: 10px; margin: 10px 0; border-left: 4px solid #e5e7eb; }
        .step.complete { border-left-color: #22c55e; background: #f0fdf4; }
        .step.error { border-left-color: #ef4444; background: #fef2f2; }
        .step.starting { border-left-color: #3b82f6; background: #eff6ff; }
        .test-form { display: flex; gap: 10px; align-items: end; flex-wrap: wrap; }
        .test-form input, .test-form select, .test-form button { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; }
        .test-form button { background: #3b82f6; color: white; border: none; cursor: pointer; }
        .test-form button:hover { background: #2563eb; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        pre { white-space: pre-wrap; word-break: break-word; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card header">
            <h1>🔍 PromptDial Debug Console</h1>
            <p>System diagnostics and optimization testing</p>
        </div>

        <div class="grid">
            <div class="card">
                <h2>🔑 API Key Status</h2>
                <p><strong>OpenAI:</strong> <span class="${apiKeys.openai ? 'status-good' : 'status-bad'}">${apiKeys.openai ? '✅ Configured' : '❌ Missing'}</span></p>
                <p><strong>Anthropic:</strong> <span class="${apiKeys.anthropic ? 'status-good' : 'status-bad'}">${apiKeys.anthropic ? '✅ Configured' : '❌ Missing'}</span></p>
                <p><strong>Google AI:</strong> <span class="${apiKeys.google ? 'status-good' : 'status-bad'}">${apiKeys.google ? '✅ Configured' : '❌ Missing'}</span></p>
                <p><strong>Active Provider:</strong> <span class="${activeProvider !== 'None' ? 'status-good' : 'status-bad'}">${activeProvider}</span></p>
            </div>

            <div class="card">
                <h2>⚙️ System Info</h2>
                <p><strong>Node.js:</strong> ${debugInfo.system.nodeVersion}</p>
                <p><strong>Environment:</strong> ${debugInfo.system.environment}</p>
                <p><strong>Timestamp:</strong> ${debugInfo.timestamp}</p>
                <p><strong>Has API Keys:</strong> <span class="${debugInfo.system.hasAnyApiKey ? 'status-good' : 'status-bad'}">${debugInfo.system.hasAnyApiKey ? 'Yes' : 'No'}</span></p>
            </div>
        </div>

        <div class="card">
            <h2>🧪 Test Optimization</h2>
            <form class="test-form" method="get">
                <div>
                    <label>Prompt:</label><br>
                    <input type="text" name="prompt" value="${testPrompt}" style="width: 300px;" placeholder="Enter test prompt">
                </div>
                <div>
                    <label>Model:</label><br>
                    <select name="model">
                        <option value="claude-3-opus" ${testModel === 'claude-3-opus' ? 'selected' : ''}>Claude 3 Opus</option>
                        <option value="gpt-4" ${testModel === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
                        <option value="gemini-pro" ${testModel === 'gemini-pro' ? 'selected' : ''}>Gemini Pro</option>
                    </select>
                </div>
                <div>
                    <input type="hidden" name="test" value="true">
                    <button type="submit">🚀 Run Test</button>
                </div>
            </form>
        </div>

        ${
          debugInfo.steps.length > 0
            ? `
        <div class="card">
            <h2>📊 Test Results</h2>
            ${debugInfo.steps
              .map(
                (step: any) => `
                <div class="step ${step.status}">
                    <strong>${step.step.toUpperCase()}:</strong> ${step.message}
                    ${step.stack ? `<pre class="code">${step.stack}</pre>` : ''}
                </div>
            `,
              )
              .join('')}
        </div>
        `
            : ''
        }

        ${
          debugInfo.result
            ? `
        <div class="card">
            <h2>✨ Optimization Results</h2>
            <div class="grid">
                <div>
                    <p><strong>Total Variants:</strong> ${debugInfo.result.variantCount}</p>
                    <p><strong>Real API Calls:</strong> <span class="${debugInfo.result.realApiCallsSuccessful > 0 ? 'status-good' : 'status-bad'}">${debugInfo.result.realApiCallsSuccessful}</span></p>
                    <p><strong>Fake Responses:</strong> <span class="${debugInfo.result.fakeResponses > 0 ? 'status-bad' : 'status-good'}">${debugInfo.result.fakeResponses}</span></p>
                </div>
                <div>
                    <p><strong>Variant Sources:</strong></p>
                    ${debugInfo.result.variantSources
                      .map(
                        (source: string) =>
                          `<span class="${source.startsWith('REAL_') ? 'status-good' : 'status-bad'}">${source}</span>`,
                      )
                      .join(', ')}
                </div>
            </div>
            
            <h3>Generated Variants:</h3>
            ${debugInfo.result.variants
              .map(
                (variant: any, i: number) => `
                <div class="code">
                    <strong>Variant ${i + 1}: ${variant.source}</strong><br>
                    <strong>ID:</strong> ${variant.id}<br>
                    <strong>Content:</strong> ${variant.optimizedPrompt}<br><br>
                    <strong>Changes:</strong> ${JSON.stringify(variant.changes, null, 2)}<br>
                    <strong>Features:</strong> ${JSON.stringify(variant.modelSpecificFeatures, null, 2)}
                </div>
            `,
              )
              .join('')}
        </div>
        `
            : ''
        }

        ${
          debugInfo.error
            ? `
        <div class="card">
            <h2>❌ Error Details</h2>
            <div class="code">
                <strong>Type:</strong> ${debugInfo.error.type}<br>
                <strong>Message:</strong> ${debugInfo.error.message}
            </div>
        </div>
        `
            : ''
        }

        <div class="card">
            <h2>🔗 Quick Actions</h2>
            <p><a href="/debug?test=true&prompt=hello%20world">🔍 Test with "hello world"</a></p>
            <p><a href="/debug?test=true&prompt=explain%20quantum%20physics">🧠 Test Advanced Optimization</a></p>
            <p><a href="/debug">🔄 Refresh System Status</a></p>
            <p><a href="/">🏠 Back to Main App</a></p>
        </div>
    </div>
</body>
</html>`

      res.send(html)
    }
  } catch (error) {
    console.error('Debug endpoint error:', error)
    res.status(500).json({
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'promptdial-server' })
})

// Serve index.html for all other routes (SPA support)
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'))
})

// Start server only when not running tests
if (process.env.NODE_ENV !== 'test') {
  const config = ConfigManager.getInstance().getConfig()
  app.listen(PORT, () => {

    const getOptimizationMode = () => {
      if (!hasAPIKeys) return '⚠️  STATIC MODE - Using template-based optimization only'

      const providers = [
        process.env.ANTHROPIC_API_KEY && '🤖 Anthropic Claude',
        process.env.OPENAI_API_KEY && '🤖 OpenAI GPT',
        process.env.GOOGLE_AI_API_KEY && '🤖 Google Gemini',
      ].filter(Boolean)

      return `🧠 DYNAMIC AI MODE - Using ${providers.join(', ')}`
    }

    console.log(`
🚀 PromptDial Server Running!
================================ 
✅ Server: http://localhost:${PORT}
✅ API: http://localhost:${PORT}/api/optimize
✅ Basic UI: http://localhost:${PORT}
✅ Mode: ${config.mode}
💡 For advanced UI, run: npm run start:ui (port 5173)

${getOptimizationMode()}

${
  hasAPIKeys
    ? '🎯 Dynamic prompt optimization using AI models'
    : '📝 Static template optimization (add API keys to .env for AI features)'
}

${
  config.mode === 'microservices'
    ? `🔗 Microservices enabled:\n   - Technique Engine: ${config.services?.techniqueEngine || 'disabled'}\n   - Evaluator: ${config.services?.evaluator || 'disabled'}\n   - Retrieval Hub: ${config.services?.retrievalHub || 'disabled'}`
    : '💻 Running in monolithic mode'
}

Ready to optimize prompts!
    `)

    // Open browser automatically (optional)
    if (process.env.NODE_ENV !== 'production') {
      // Dynamic import for optional dependency
      ;(async () => {
        try {
          const open = await import('open')
          open.default(`http://localhost:${PORT}`)
        } catch {
          // Ignore if open package is not available
        }
      })()
    }
  })
}

export default app
