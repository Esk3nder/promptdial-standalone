import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

describe('API Endpoint Tests', () => {
  let serverProcess: ChildProcess;
  const apiUrl = 'http://localhost:3000';

  beforeAll(async () => {
    // Start the server
    serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: '3000' },
      detached: false
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
  }, 10000);

  afterAll(async () => {
    // Kill the server process
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('POST /api/optimize', () => {
    it('should optimize a prompt successfully', async () => {
      const response = await request(apiUrl)
        .post('/api/optimize')
        .send({
          prompt: 'Explain how AI works',
          options: {
            maxVariants: 3
          }
        })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.variants).toBeDefined();
      expect(Array.isArray(response.body.variants)).toBe(true);
      expect(response.body.variants.length).toBeGreaterThan(0);
      expect(response.body.variants.length).toBeLessThanOrEqual(3);
    });

    it('should return 400 for missing prompt', async () => {
      const response = await request(apiUrl)
        .post('/api/optimize')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle cost cap option', async () => {
      const response = await request(apiUrl)
        .post('/api/optimize')
        .send({
          prompt: 'Write a haiku about coding',
          options: {
            maxCost: 0.05
          }
        })
        .expect(200);

      expect(response.body).toBeDefined();
      // Should include cost estimation
      response.body.variants.forEach((variant: any) => {
        expect(variant.estimatedCost).toBeDefined();
        expect(variant.estimatedCost).toBeLessThanOrEqual(0.05);
      });
    });
  });

  describe('GET /api/optimize/stream', () => {
    it('should stream optimization progress', (done) => {
      request(apiUrl)
        .get('/api/optimize/stream')
        .query({ prompt: 'Explain machine learning' })
        .expect(200)
        .expect('Content-Type', /text\/event-stream/)
        .end((err, res) => {
          if (err) return done(err);
          
          // Check that we received SSE data
          expect(res.text).toContain('data:');
          done();
        });
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(apiUrl)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        service: 'promptdial-core',
        version: expect.any(String)
      });
    });
  });

  describe('GET /metrics', () => {
    it('should return basic metrics', async () => {
      // Make a few requests first
      await request(apiUrl)
        .post('/api/optimize')
        .send({ prompt: 'Test prompt 1' });
      
      await request(apiUrl)
        .post('/api/optimize')
        .send({ prompt: 'Test prompt 2' });

      const response = await request(apiUrl)
        .get('/metrics')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.requests_total).toBeGreaterThanOrEqual(2);
      expect(response.body.average_response_time_ms).toBeDefined();
      expect(response.body.cache_hit_rate).toBeDefined();
    });
  });
});