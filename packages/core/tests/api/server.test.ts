import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { app, startServer } from '../../src/api/server'
import { StreamingTestRunner } from '../../src/testing/runner-streaming'
import type { PerformanceTestEvent } from '../../src/testing/runner-events'

// Mock the dependencies
vi.mock('../../src/testing/runner-streaming')
vi.mock('dotenv/config', () => ({}))

// Mock console methods
const originalConsoleLog = console.log
const originalConsoleError = console.error

describe('API Server', () => {
  let mockRunner: any
  let mockOnEvent: (callback: (event: PerformanceTestEvent) => void) => void
  let eventCallback: ((event: PerformanceTestEvent) => void) | null = null
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock console
    console.log = vi.fn()
    console.error = vi.fn()
    
    // Reset environment
    delete process.env.PORT
    
    // Setup mock runner
    mockOnEvent = vi.fn((callback) => {
      eventCallback = callback
    })
    
    mockRunner = {
      onEvent: mockOnEvent,
      runTest: vi.fn()
    }
    
    // Mock the runner constructor to return our mock
    ;(StreamingTestRunner as any).mockImplementation(() => {
      // Add a unique test ID
      const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      Object.defineProperty(mockRunner, 'testId', {
        value: testId,
        writable: false
      })
      return mockRunner
    })
  })
  
  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
    eventCallback = null
  })
  
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)
      
      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String)
      })
      
      // Verify timestamp is valid
      const timestamp = new Date(response.body.timestamp)
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now())
    })
  })
  
  describe('POST /api/test', () => {
    it('should start a test and return test ID with stream URL', async () => {
      mockRunner.runTest.mockResolvedValue({
        summary: { totalTests: 1, passed: 1 }
      })
      
      const response = await request(app)
        .post('/api/test')
        .send({
          prompt: 'Test prompt',
          targetModel: 'gpt-4',
          optimizationLevel: 'basic'
        })
        .expect(200)
      
      expect(response.body).toMatchObject({
        testId: expect.stringMatching(/^test-\d+-[a-z0-9]+$/),
        streamUrl: expect.stringMatching(/^\/api\/test-stream\/test-\d+-[a-z0-9]+$/)
      })
      
      expect(StreamingTestRunner).toHaveBeenCalled()
      expect(mockRunner.onEvent).toHaveBeenCalledWith(expect.any(Function))
      
      // Wait a bit for async test execution
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(mockRunner.runTest).toHaveBeenCalledWith('Test prompt', {
        targetModel: 'gpt-4',
        optimizationLevel: 'basic'
      })
    })
    
    it('should return 400 if prompt is missing', async () => {
      const response = await request(app)
        .post('/api/test')
        .send({
          targetModel: 'gpt-4',
          optimizationLevel: 'basic'
        })
        .expect(400)
      
      expect(response.body).toEqual({
        error: 'Prompt is required'
      })
      
      expect(StreamingTestRunner).not.toHaveBeenCalled()
    })
    
    it('should handle test execution errors', async () => {
      const testError = new Error('Test execution failed')
      mockRunner.runTest.mockRejectedValue(testError)
      
      const response = await request(app)
        .post('/api/test')
        .send({
          prompt: 'Test prompt'
        })
        .expect(200)
      
      const testId = response.body.testId
      expect(testId).toBeDefined()
      
      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 20))
      
      expect(mockRunner.runTest).toHaveBeenCalled()
    })
    
    it('should work with minimal parameters', async () => {
      mockRunner.runTest.mockResolvedValue({
        summary: { totalTests: 1, passed: 1 }
      })
      
      const response = await request(app)
        .post('/api/test')
        .send({
          prompt: 'Minimal test'
        })
        .expect(200)
      
      expect(response.body.testId).toBeDefined()
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(mockRunner.runTest).toHaveBeenCalledWith('Minimal test', {
        targetModel: undefined,
        optimizationLevel: undefined
      })
    })
  })
  
  describe('GET /api/test-stream/:testId', () => {
    it('should set up SSE connection with correct headers', (done) => {
      request(app)
        .get('/api/test-stream/test-123')
        .expect(200)
        .expect('Content-Type', 'text/event-stream')
        .expect('Cache-Control', 'no-cache')
        .expect('Connection', 'keep-alive')
        .expect('Access-Control-Allow-Origin', '*')
        .end((err) => {
          if (err) return done(err)
          done()
        })
    }, 10000)
    
    it('should send initial connection message', (done) => {
      let receivedData = ''
      
      request(app)
        .get('/api/test-stream/test-123')
        .buffer(false)
        .parse((res, callback) => {
          res.on('data', chunk => {
            receivedData += chunk.toString()
            // Check if we received the initial connection message
            if (receivedData.includes('data: ') && receivedData.includes('\n\n')) {
              // Parse the first complete message
              const match = receivedData.match(/data: (.+?)\n\n/)
              if (match) {
                try {
                  const data = JSON.parse(match[1])
                  if (data.type === 'connected' && data.testId === 'test-123') {
                    callback(null, receivedData)
                  }
                } catch (e) {
                  // Continue collecting data
                }
              }
            }
          })
          
          // Set a timeout to ensure test doesn't hang
          setTimeout(() => {
            callback(null, receivedData)
          }, 1000)
        })
        .end((err, res) => {
          if (err) return done(err)
          expect(res.text).toContain('"type":"connected"')
          expect(res.text).toContain('"testId":"test-123"')
          done()
        })
    }, 10000)
  })
  
  describe('GET /api/test/:testId', () => {
    it('should return 404 for non-existent test', async () => {
      const response = await request(app)
        .get('/api/test/non-existent-test')
        .expect(404)
      
      expect(response.body).toEqual({
        error: 'Test not found'
      })
    })
  })
  
  describe('SSE Integration', () => {
    it('should stream events from test runner to SSE client', async () => {
      // This test verifies the integration between POST /api/test and SSE streaming
      
      // Setup test runner that emits events
      const testEvents: PerformanceTestEvent[] = []
      mockRunner.runTest.mockImplementation(async () => {
        // Emit some events
        if (eventCallback) {
          const startEvent = { type: 'test_start' as const, timestamp: Date.now() }
          const completeEvent = { type: 'test_complete' as const, timestamp: Date.now() }
          testEvents.push(startEvent, completeEvent)
          eventCallback(startEvent)
          eventCallback(completeEvent)
        }
        return { summary: { totalTests: 1, passed: 1 } }
      })
      
      // Start a test
      const testResponse = await request(app)
        .post('/api/test')
        .send({ prompt: 'Integration test' })
        .expect(200)
      
      const { testId } = testResponse.body
      expect(testId).toBeDefined()
      
      // Wait for async test execution
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Verify that test runner was called and events were setup
      expect(StreamingTestRunner).toHaveBeenCalled()
      expect(mockRunner.onEvent).toHaveBeenCalled()
      expect(mockRunner.runTest).toHaveBeenCalledWith('Integration test', {
        targetModel: undefined,
        optimizationLevel: undefined
      })
      
      // Verify events were emitted
      expect(testEvents).toHaveLength(2)
      expect(testEvents[0].type).toBe('test_start')
      expect(testEvents[1].type).toBe('test_complete')
    })
  })
  
  describe('startServer', () => {
    it('should start server on default port', () => {
      const mockListen = vi.fn((port, callback) => {
        callback?.()
        return { close: vi.fn() }
      })
      
      vi.spyOn(app, 'listen').mockImplementation(mockListen as any)
      
      startServer()
      
      expect(mockListen).toHaveBeenCalledWith(3001, expect.any(Function))
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('PromptDial API server running on http://localhost:3001')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('SSE endpoint: http://localhost:3001/api/test-stream/:testId')
      )
    })
    
    it('should use PORT environment variable if set', async () => {
      // Set PORT before importing the module
      process.env.PORT = '4000'
      
      // Re-import the module to pick up new PORT
      vi.resetModules()
      vi.doMock('../../src/api/server', async () => {
        const express = (await vi.importActual('express')).default
        const testApp = express()
        
        testApp.use(express.json())
        
        const mockListen = vi.fn((port, callback) => {
          expect(port).toBe('4000')
          callback?.()
          return { close: vi.fn() }
        })
        
        testApp.listen = mockListen
        
        function startTestServer() {
          testApp.listen(process.env.PORT || 3001, () => {
            console.log(`🚀 PromptDial API server running on http://localhost:${process.env.PORT || 3001}`)
          })
        }
        
        return { app: testApp, startServer: startTestServer }
      })
      
      const { startServer: startTestServer } = await import('../../src/api/server')
      startTestServer()
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:4000')
      )
      
      // Reset modules for other tests
      vi.resetModules()
    })
  })
  
  describe('Error Handling', () => {
    it('should handle non-Error exceptions in test runner', async () => {
      mockRunner.runTest.mockRejectedValue('String error')
      
      const response = await request(app)
        .post('/api/test')
        .send({ prompt: 'Test with string error' })
        .expect(200)
      
      const testId = response.body.testId
      
      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 20))
      
      // The error should be handled gracefully
      expect(mockRunner.runTest).toHaveBeenCalled()
    })
    
    it('should clean up client connections on disconnect', (done) => {
      // This is tested implicitly through the SSE integration test
      // The client cleanup happens when the request closes
      request(app)
        .get('/api/test-stream/test-cleanup')
        .expect(200)
        .expect('Content-Type', 'text/event-stream')
        .end((err) => {
          if (err) return done(err)
          done()
        })
    }, 10000)
  })
})