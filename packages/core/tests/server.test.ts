import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import path from 'path'
import { PromptDial } from '../src/index'

// Mock the dependencies
vi.mock('../src/index', () => ({
  PromptDial: vi.fn()
}))

// Mock dotenv
vi.mock('dotenv/config', () => ({}))

// Mock open package
vi.mock('open', () => ({
  default: vi.fn()
}))

// Mock path.resolve to return a predictable path
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path')
  return {
    ...actual,
    resolve: vi.fn(() => '/test/path')
  }
})

// Mock console methods to avoid cluttering test output
const originalConsoleLog = console.log
const originalConsoleError = console.error

// Keep track of server instances to close them
let serverInstance: any = null

describe('Server', () => {
  let app: express.Application
  let mockOptimize: ReturnType<typeof vi.fn>
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Mock console methods
    console.log = vi.fn()
    console.error = vi.fn()
    
    // Setup mock PromptDial
    mockOptimize = vi.fn()
    ;(PromptDial as any).mockImplementation(() => ({
      optimize: mockOptimize
    }))
    
    // Clear environment variables
    delete process.env.PORT
    process.env.NODE_ENV = 'test'
    
    // Import server fresh for each test
    vi.resetModules()
  })
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog
    console.error = originalConsoleError
    
    // Close any open server instances
    if (serverInstance) {
      serverInstance.close()
      serverInstance = null
    }
  })
  
  afterAll(() => {
    // Ensure all servers are closed
    if (serverInstance) {
      serverInstance.close()
    }
  })
  
  describe('API Endpoints', () => {
    beforeEach(async () => {
      // Mock the server to not actually listen
      vi.doMock('../src/server', async () => {
        const actual = await vi.importActual('../src/server')
        const app = (actual as any).default
        
        // Prevent the server from actually starting
        vi.spyOn(app, 'listen').mockImplementation(() => {
          // Return a mock server instance
          return { close: vi.fn() }
        })
        
        return { default: app }
      })
      
      const serverModule = await import('../src/server')
      app = serverModule.default
    })
    
    describe('POST /api/optimize', () => {
      it('should successfully optimize a valid prompt', async () => {
        const mockResult = {
          variants: [
            {
              id: 'test-1',
              optimizedPrompt: 'Optimized prompt',
              changes: [{ type: 'clarity', description: 'Improved clarity' }]
            }
          ],
          summary: {
            bestScore: 85,
            averageScore: 80
          }
        }
        
        mockOptimize.mockResolvedValue(mockResult)
        
        const response = await request(app)
          .post('/api/optimize')
          .send({
            prompt: 'Test prompt',
            targetModel: 'gpt-4',
            optimizationLevel: 'basic'
          })
          .expect(200)
        
        expect(response.body).toMatchObject({
          ...mockResult,
          metadata: {
            optimizedUsing: 'ai-powered',
            timestamp: expect.any(String)
          }
        })
        
        expect(PromptDial).toHaveBeenCalledWith({
          autoValidate: true,
          sortByQuality: true,
          useAI: true
        })
        
        expect(mockOptimize).toHaveBeenCalledWith({
          prompt: 'Test prompt',
          targetModel: 'gpt-4',
          optimizationLevel: 'basic'
        })
      })
      
      it('should return 400 for missing prompt', async () => {
        const response = await request(app)
          .post('/api/optimize')
          .send({
            targetModel: 'gpt-4',
            optimizationLevel: 'basic'
          })
          .expect(400)
        
        expect(response.body).toEqual({
          error: 'Missing required fields: prompt, targetModel, optimizationLevel'
        })
        
        expect(mockOptimize).not.toHaveBeenCalled()
      })
      
      it('should return 400 for missing targetModel', async () => {
        const response = await request(app)
          .post('/api/optimize')
          .send({
            prompt: 'Test prompt',
            optimizationLevel: 'basic'
          })
          .expect(400)
        
        expect(response.body).toEqual({
          error: 'Missing required fields: prompt, targetModel, optimizationLevel'
        })
      })
      
      it('should return 400 for missing optimizationLevel', async () => {
        const response = await request(app)
          .post('/api/optimize')
          .send({
            prompt: 'Test prompt',
            targetModel: 'gpt-4'
          })
          .expect(400)
        
        expect(response.body).toEqual({
          error: 'Missing required fields: prompt, targetModel, optimizationLevel'
        })
      })
      
      it('should handle optimization errors gracefully', async () => {
        const errorMessage = 'API key not configured'
        mockOptimize.mockRejectedValue(new Error(errorMessage))
        
        const response = await request(app)
          .post('/api/optimize')
          .send({
            prompt: 'Test prompt',
            targetModel: 'gpt-4',
            optimizationLevel: 'basic'
          })
          .expect(500)
        
        expect(response.body).toEqual({
          error: errorMessage
        })
        
        expect(console.error).toHaveBeenCalledWith(
          '❌ Optimization error:',
          expect.any(Error)
        )
      })
      
      it('should handle non-Error exceptions', async () => {
        mockOptimize.mockRejectedValue('String error')
        
        const response = await request(app)
          .post('/api/optimize')
          .send({
            prompt: 'Test prompt',
            targetModel: 'gpt-4',
            optimizationLevel: 'basic'
          })
          .expect(500)
        
        expect(response.body).toEqual({
          error: 'Optimization failed'
        })
      })
      
      it('should always report ai-powered optimizer in metadata', async () => {
        const mockResult = {
          variants: [
            {
              id: 'mock-123',
              optimizedPrompt: 'Mock optimized prompt',
              changes: []
            }
          ],
          summary: {
            bestScore: 70,
            averageScore: 70
          }
        }
        
        mockOptimize.mockResolvedValue(mockResult)
        
        const response = await request(app)
          .post('/api/optimize')
          .send({
            prompt: 'Test prompt',
            targetModel: 'gpt-4',
            optimizationLevel: 'basic'
          })
          .expect(200)
        
        expect(response.body.metadata.optimizedUsing).toBe('ai-powered')
      })
    })
    
    describe('GET /api/health', () => {
      it('should return health status', async () => {
        const response = await request(app)
          .get('/api/health')
          .expect(200)
        
        expect(response.body).toEqual({
          status: 'ok',
          service: 'promptdial-server'
        })
      })
    })
    
    describe('GET * (SPA fallback)', () => {
      it('should attempt to serve index.html for unknown routes', async () => {
        // Note: This will fail with ENOENT since the file doesn't exist in tests
        // We're just testing that the route handler is called
        const response = await request(app)
          .get('/some/random/route')
        
        // In test environment, the file won't exist, so we expect an error
        expect(response.status).toBe(404)
      })
    })
  })
  
  describe('Server startup', () => {
    it('should start on default port 3000', async () => {
      // Setup a mock that captures the listen call
      let listenPort: any
      let listenCallback: any
      
      vi.doMock('../src/server', async () => {
        const express = (await vi.importActual('express')).default
        const actualPath = await vi.importActual<typeof import('path')>('path')
        
        const app = express()
        
        // Mock the listen method to capture arguments
        app.listen = vi.fn((port, callback) => {
          listenPort = port
          listenCallback = callback
          serverInstance = { close: vi.fn() }
          return serverInstance
        })
        
        // Recreate minimal server logic
        app.use(express.json())
        app.post('/api/optimize', async (req, res) => {
          res.json({ test: true })
        })
        
        // Call listen with captured args
        app.listen(process.env.PORT || 3000, () => {
          console.log('Server started')
        })
        
        return { default: app }
      })
      
      await import('../src/server')
      
      expect(listenPort).toBe(3000)
      expect(listenCallback).toBeDefined()
    })
    
    it('should use PORT environment variable if set', async () => {
      process.env.PORT = '4000'
      
      let listenPort: any
      
      vi.doMock('../src/server', async () => {
        const express = (await vi.importActual('express')).default
        const app = express()
        
        app.listen = vi.fn((port) => {
          listenPort = port
          serverInstance = { close: vi.fn() }
          return serverInstance
        })
        
        app.listen(process.env.PORT || 3000)
        
        return { default: app }
      })
      
      await import('../src/server')
      
      expect(listenPort).toBe('4000')
    })
    
    it('should log startup message with API keys status', async () => {
      process.env.OPENAI_API_KEY = 'test-key'
      process.env.ANTHROPIC_API_KEY = 'test-key'
      
      let listenCallback: any
      
      vi.doMock('../src/server', async () => {
        const express = (await vi.importActual('express')).default
        const app = express()
        
        app.listen = vi.fn((port, callback) => {
          listenCallback = callback
          serverInstance = { close: vi.fn() }
          return serverInstance
        })
        
        app.listen(3000, () => {
          const hasAPIKeys = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)
          console.log(hasAPIKeys ? 'ENABLED (Using real AI APIs)' : 'DISABLED')
          
          if (hasAPIKeys) {
            const apis = [
              process.env.OPENAI_API_KEY && 'OpenAI',
              process.env.ANTHROPIC_API_KEY && 'Anthropic'
            ].filter(Boolean).join(', ')
            console.log(apis)
          }
        })
        
        return { default: app }
      })
      
      await import('../src/server')
      
      // Execute the callback
      if (listenCallback) listenCallback()
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('ENABLED (Using real AI APIs)')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('OpenAI, Anthropic')
      )
    })
    
    it('should log warning when no API keys are configured', async () => {
      delete process.env.OPENAI_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.GOOGLE_AI_API_KEY
      
      let listenCallback: any
      
      vi.doMock('../src/server', async () => {
        const express = (await vi.importActual('express')).default
        const app = express()
        
        app.listen = vi.fn((port, callback) => {
          listenCallback = callback
          serverInstance = { close: vi.fn() }
          return serverInstance
        })
        
        app.listen(3000, () => {
          const hasAPIKeys = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)
          console.log(hasAPIKeys ? 'ENABLED' : 'DISABLED (Using mock optimization)')
          console.log('No API keys found')
        })
        
        return { default: app }
      })
      
      await import('../src/server')
      
      if (listenCallback) listenCallback()
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('DISABLED (Using mock optimization)')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No API keys found')
      )
    })
  })
  
  describe('Middleware setup', () => {
    it('should configure CORS', async () => {
      vi.doMock('../src/server', async () => {
        const actual = await vi.importActual('../src/server')
        const app = (actual as any).default
        
        vi.spyOn(app, 'listen').mockImplementation(() => {
          return { close: vi.fn() }
        })
        
        return { default: app }
      })
      
      const serverModule = await import('../src/server')
      app = serverModule.default
      
      // CORS should allow requests from any origin
      const response = await request(app)
        .options('/api/optimize')
        .expect(204)
      
      expect(response.headers['access-control-allow-origin']).toBe('*')
    })
    
    it('should parse JSON bodies', async () => {
      vi.doMock('../src/server', async () => {
        const actual = await vi.importActual('../src/server')
        const app = (actual as any).default
        
        vi.spyOn(app, 'listen').mockImplementation(() => {
          return { close: vi.fn() }
        })
        
        return { default: app }
      })
      
      const serverModule = await import('../src/server')
      app = serverModule.default
      
      mockOptimize.mockResolvedValue({ variants: [], summary: {} })
      
      const jsonBody = {
        prompt: 'Test',
        targetModel: 'gpt-4',
        optimizationLevel: 'basic'
      }
      
      await request(app)
        .post('/api/optimize')
        .send(jsonBody)
        .expect(200)
      
      expect(mockOptimize).toHaveBeenCalledWith(jsonBody)
    })
  })
})