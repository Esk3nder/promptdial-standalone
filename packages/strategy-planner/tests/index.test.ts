import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Strategy Planner API', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'strategy-planner',
        version: '3.0.0'
      });
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('GET /metrics', () => {
    it('should return metrics', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('requests_total');
      expect(response.body).toHaveProperty('requests_failed');
      expect(response.body).toHaveProperty('average_latency_ms');
      expect(response.body).toHaveProperty('baseline_responses');
    });
  });

  describe('POST /plan', () => {
    it('should reject requests without prompt', async () => {
      const response = await request(app)
        .post('/plan')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required field: prompt');
    });

    it('should handle valid planning requests', async () => {
      // Mock the LLM call to avoid external dependencies in tests
      const response = await request(app)
        .post('/plan')
        .send({
          prompt: 'Explain machine learning concepts',
          context: {
            taskType: 'explanation'
          }
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('suggested_techniques');
      expect(response.body).toHaveProperty('rationale');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('trace_id');
    });

    it('should include trace ID from headers', async () => {
      const traceId = 'test-trace-123';
      
      const response = await request(app)
        .post('/plan')
        .set('x-trace-id', traceId)
        .send({
          prompt: 'Test prompt'
        });
      
      expect(response.body.trace_id).toBe(traceId);
    });

    it('should handle planning with full context', async () => {
      const response = await request(app)
        .post('/plan')
        .send({
          prompt: 'Write a function to calculate fibonacci numbers',
          context: {
            taskType: 'coding',
            modelName: 'gpt-4',
            optimizationLevel: 'explore',
            metadata: {
              language: 'python',
              complexity: 'medium'
            }
          }
        });
      
      expect(response.status).toBe(200);
      expect(response.body.suggested_techniques).toBeInstanceOf(Array);
      expect(response.body.suggested_techniques.length).toBeGreaterThan(0);
      expect(response.body.suggested_techniques.length).toBeLessThanOrEqual(3);
    });
  });

  describe('POST /plan/quick', () => {
    it('should handle quick planning requests', async () => {
      const response = await request(app)
        .post('/plan/quick')
        .send({
          task_type: 'reasoning'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.suggested_techniques).toBeInstanceOf(Array);
      expect(response.body.metadata?.modelUsed).toBe('rule-based');
    });

    it('should use default for missing task type', async () => {
      const response = await request(app)
        .post('/plan/quick')
        .send({});
      
      expect(response.status).toBe(200);
      expect(response.body.suggested_techniques).toContain('chain_of_thought');
    });

    it('should complete quickly', async () => {
      const startTime = Date.now();
      
      await request(app)
        .post('/plan/quick')
        .send({ task_type: 'coding' });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');
      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/plan')
        .set('Content-Type', 'application/json')
        .send('{ invalid json');
      
      expect(response.status).toBe(400);
    });
  });
});