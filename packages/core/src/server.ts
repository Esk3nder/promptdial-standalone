import express from 'express'
import cors from 'cors'
import path from 'path'
import 'dotenv/config' // Load environment variables
import { PromptDial } from './index.js'
import type { OptimizationRequest } from './meta-prompt-designer.js'

// Get directory path in CommonJS
const __dirname = path.resolve()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Serve static files from public directory
const publicPath = path.join(__dirname, '../../../tianjin/public')
app.use(express.static(publicPath))

// Server-Sent Events endpoint for real-time progress
app.get('/api/optimize/stream', async (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  // Parse query params
  const { prompt, targetModel, optimizationLevel } = req.query as any
  
  if (!prompt) {
    res.write(`data: ${JSON.stringify({ error: 'Prompt is required' })}\n\n`)
    res.end()
    return
  }

  // Send initial progress
  res.write(`data: ${JSON.stringify({ status: 'initializing', progress: 0 })}\n\n`)

  // Check for API keys
  const hasAPIKeys = Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GOOGLE_AI_API_KEY
  )
  
  const getActiveProvider = () => {
    if (process.env.ANTHROPIC_API_KEY) return 'Anthropic Claude'
    if (process.env.GOOGLE_AI_API_KEY) return 'Google Gemini'
    if (process.env.OPENAI_API_KEY) return 'OpenAI GPT'
    return 'None'
  }

  try {
    // Validation phase
    res.write(`data: ${JSON.stringify({ status: 'validating', progress: 10, message: 'Validating prompt...' })}\n\n`)
    await new Promise(resolve => setTimeout(resolve, 300)) // Small delay for UI
    
    // Task detection phase
    res.write(`data: ${JSON.stringify({ status: 'analyzing', progress: 25, message: 'Analyzing task type and cognitive requirements...' })}\n\n`)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Optimization phase
    res.write(`data: ${JSON.stringify({ status: 'optimizing', progress: 40, message: 'Applying Ultra-Think cognitive enhancements...' })}\n\n`)
    
    const optimizationMode = hasAPIKeys ? 'dynamic-ai' : 'static-template'
    const activeProvider = getActiveProvider()

    // Create request object
    const optimizationRequest: OptimizationRequest = {
      prompt: prompt as string,
      targetModel: targetModel as string || 'claude-3-opus',
      optimizationLevel: (optimizationLevel as any) || 'advanced',
    }
    
    // Generate variants
    res.write(`data: ${JSON.stringify({ status: 'generating', progress: 60, message: `Generating cognitive variants with ${activeProvider}...` })}\n\n`)
    
    // Create PromptDial instance
    const promptDial = new PromptDial({
      autoValidate: true,
      sortByQuality: true,
      useAI: true,
    })
    
    // Optimize with progress callback
    const results = await promptDial.optimize(optimizationRequest)
    
    res.write(`data: ${JSON.stringify({ status: 'evaluating', progress: 85, message: 'Evaluating quality scores...' })}\n\n`)
    await new Promise(resolve => setTimeout(resolve, 300))
    
    res.write(`data: ${JSON.stringify({ status: 'finalizing', progress: 95, message: 'Finalizing results...' })}\n\n`)
    await new Promise(resolve => setTimeout(resolve, 200))

    // Send final results
    const finalResult = {
      status: 'complete',
      progress: 100,
      results: {
        ...results,
        metadata: {
          optimizationMode,
          activeProvider,
          optimizedUsing: hasAPIKeys ? 'AI-powered dynamic optimization' : 'Template-based optimization',
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
    if (!request.prompt || !request.targetModel || !request.optimizationLevel) {
      return res.status(400).json({
        error: 'Missing required fields: prompt, targetModel, optimizationLevel',
      })
    }

    // Create PromptDial instance and optimize
    const promptDial = new PromptDial({
      autoValidate: true,
      sortByQuality: true,
      useAI: true, // Enable AI-powered optimization
    })

    // Starting optimization
    const result = await promptDial.optimize(request)

    // Optimization complete

    // Add metadata to response
    const hasAPIKeys = !!(
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GOOGLE_AI_API_KEY
    )
    
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
        optimizedUsing: hasAPIKeys ? 'AI-powered dynamic optimization' : 'Static template-based optimization',
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
      details: error instanceof Error ? error.stack : String(error)
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

// Start server
app.listen(PORT, () => {
  const hasAPIKeys = !!(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GOOGLE_AI_API_KEY
  )

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
✅ UI: http://localhost:${PORT}

${getOptimizationMode()}

${hasAPIKeys 
  ? '🎯 Dynamic prompt optimization using AI models'
  : '📝 Static template optimization (add API keys to .env for AI features)'
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

export default app
