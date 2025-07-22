import express from 'express'
import cors from 'cors'
import path from 'path'
import 'dotenv/config'  // Load environment variables
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
const publicPath = path.join(__dirname, '../public')
app.use(express.static(publicPath))

// API endpoint for prompt optimization
app.post('/api/optimize', async (req, res) => {
  try {
    const request: OptimizationRequest = req.body
    
    console.log('\n🚀 New optimization request received:', {
      prompt: request.prompt?.substring(0, 50) + '...',
      targetModel: request.targetModel,
      optimizationLevel: request.optimizationLevel
    })
    
    // Validate request
    if (!request.prompt || !request.targetModel || !request.optimizationLevel) {
      return res.status(400).json({
        error: 'Missing required fields: prompt, targetModel, optimizationLevel'
      })
    }
    
    // Create PromptDial instance and optimize
    const promptDial = new PromptDial({
      autoValidate: true,
      sortByQuality: true,
      useAI: true  // Enable AI-powered optimization
    })
    
    console.log('⚡ Starting optimization...')
    const result = await promptDial.optimize(request)
    
    // Log optimization result
    console.log(`✅ Optimization complete:`, {
      variantsGenerated: result.variants.length,
      bestScore: result.summary.bestScore,
      averageScore: result.summary.averageScore,
      firstVariantChanges: result.variants[0]?.changes?.length || 0
    })
    
    // Add metadata to response
    const enhancedResult = {
      ...result,
      metadata: {
        optimizedUsing: result.variants[0]?.id?.includes('mock') ? 'mock-optimizer' : 'ai-powered',
        timestamp: new Date().toISOString()
      }
    }
    
    return res.json(enhancedResult)
  } catch (error) {
    console.error('❌ Optimization error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Optimization failed'
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
  const hasAPIKeys = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_AI_API_KEY)
  
  console.log(`
🚀 PromptDial Server Running!
================================
✅ Server: http://localhost:${PORT}
✅ API: http://localhost:${PORT}/api/optimize
✅ UI: http://localhost:${PORT}
✅ AI Mode: ${hasAPIKeys ? 'ENABLED (Using real AI APIs)' : 'DISABLED (Using mock optimization)'}
${hasAPIKeys ? `✅ Available APIs: ${[
  process.env.OPENAI_API_KEY && 'OpenAI',
  process.env.ANTHROPIC_API_KEY && 'Anthropic', 
  process.env.GOOGLE_AI_API_KEY && 'Google AI'
].filter(Boolean).join(', ')}` : '⚠️  No API keys found - Add them to .env file'}

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