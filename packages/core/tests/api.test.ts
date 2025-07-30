import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, server } from '../src/server';

describe('API Endpoint Tests', () => {
  beforeAll(async () => {
    // Ensure server is not already listening
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  afterAll(async () => {
    // Close server after tests
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('POST /api/optimize', () => {
    it('should optimize a prompt successfully', async () => {
      const response = await request(app)
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
      const response = await request(app)
        .post('/api/optimize')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle cost cap option', async () => {
      const response = await request(app)
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
    it('should stream optimization progress', async () => {
      const response = await request(app)
        .get('/api/optimize/stream')
        .query({ prompt: 'Explain machine learning' })
        .expect(200)
        .expect('Content-Type', /text\/event-stream/);
      
      // Check that we received SSE data
      expect(response.text).toContain('data:');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
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
      await request(app)
        .post('/api/optimize')
        .send({ prompt: 'Test prompt 1' });
      
      await request(app)
        .post('/api/optimize')
        .send({ prompt: 'Test prompt 2' });

      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.requests_total).toBeGreaterThanOrEqual(2);
      expect(response.body.average_response_time_ms).toBeDefined();
      expect(response.body.cache_hit_rate).toBeDefined();
    });
  });
});