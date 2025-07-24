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
const publicPath = path.join(__dirname, '../../../public')
app.use(express.static(publicPath))

// API endpoint for prompt optimization
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
    const enhancedResult = {
      ...result,
      metadata: {
        optimizedUsing: 'ai-powered',
        timestamp: new Date().toISOString(),
      },
    }

    return res.json(enhancedResult)
  } catch (error) {
    // Optimization error occurred
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Optimization failed',
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

  console.log(`
🚀 PromptDial Server Running!
================================
✅ Server: http://localhost:${PORT}
✅ API: http://localhost:${PORT}/api/optimize
✅ UI: http://localhost:${PORT}
✅ AI Mode: ${hasAPIKeys ? 'ENABLED' : 'DISABLED'}
${
  hasAPIKeys
    ? `✅ Available APIs: ${[
        process.env.OPENAI_API_KEY && 'OpenAI',
        process.env.ANTHROPIC_API_KEY && 'Anthropic',
        process.env.GOOGLE_AI_API_KEY && 'Google AI',
      ]
        .filter(Boolean)
        .join(', ')}`
    : '⚠️  No API keys found - Add them to .env file'
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
