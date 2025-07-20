import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { StreamingTestRunner } from '../testing/runner-streaming'
import type { PerformanceTestEvent } from '../testing/runner-events'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Store active connections for SSE
const clients = new Map<string, express.Response>()

// SSE endpoint
app.get('/api/test-stream/:testId', (req, res) => {
  const { testId } = req.params

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Store client connection
  clients.set(testId, res)

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', testId })}\n\n`)

  // Handle client disconnect
  req.on('close', () => {
    clients.delete(testId)
  })
})

// Start test endpoint
app.post('/api/test', async (req, res) => {
  const { prompt, targetModel, optimizationLevel } = req.body

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' })
  }

  const runner = new StreamingTestRunner()
  const testId = runner['testId'] // Access private property

  // Send events to SSE client
  runner.onEvent((event: PerformanceTestEvent) => {
    const client = clients.get(testId)
    if (client) {
      client.write(`data: ${JSON.stringify(event)}\n\n`)
    }
  })

  // Return test ID immediately
  res.json({ testId, streamUrl: `/api/test-stream/${testId}` })

  // Run test in background
  try {
    const results = await runner.runTest(prompt, {
      targetModel,
      optimizationLevel
    })

    // Send final results
    const client = clients.get(testId)
    if (client) {
      client.write(`data: ${JSON.stringify({ 
        type: 'final_results', 
        results,
        testId 
      })}\n\n`)
      client.end()
    }
  } catch (error) {
    const client = clients.get(testId)
    if (client) {
      client.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        testId 
      })}\n\n`)
      client.end()
    }
  } finally {
    clients.delete(testId)
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() })
})

// Test results endpoint (for history)
const testResults = new Map()

app.get('/api/test/:testId', (req, res) => {
  const { testId } = req.params
  const result = testResults.get(testId)
  
  if (!result) {
    return res.status(404).json({ error: 'Test not found' })
  }
  
  res.json(result)
})

// Start server
export function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 PromptDial API server running on http://localhost:${PORT}`)
    console.log(`📡 SSE endpoint: http://localhost:${PORT}/api/test-stream/:testId`)
  })
}

// Export for testing
export { app }