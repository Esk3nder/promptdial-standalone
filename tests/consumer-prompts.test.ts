import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';

// Load test fixtures
const creditCardFixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/credit-card-selector.json'), 'utf-8')
);
const tokyoTripFixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/tokyo-trip-planner.json'), 'utf-8')
);
const spanishB1Fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/spanish-b1-accelerator.json'), 'utf-8')
);

describe('Consumer-Grade Prompt Tests', () => {
  let apiUrl: string;

  beforeAll(() => {
    apiUrl = process.env.API_GATEWAY_URL || 'http://localhost:3000';
  });

  describe('Credit Card Selector', () => {
    it('should optimize credit card selection prompt with all required features', async () => {
      const response = await request(apiUrl)
        .post('/optimize')
        .send(creditCardFixture.request)
        .expect(200);

      const result = response.body;

      // Verify response structure
      expect(result).toHaveProperty('trace_id');
      expect(result).toHaveProperty('variants');
      expect(result).toHaveProperty('frontier');

      // Check that we got multiple variants
      expect(result.variants.length).toBeGreaterThanOrEqual(4);

      // Verify each variant has required fields
      result.variants.forEach((variant: any) => {
        expect(variant).toHaveProperty('id');
        expect(variant).toHaveProperty('technique');
        expect(variant).toHaveProperty('prompt');
        expect(variant).toHaveProperty('estimated_tokens');
        expect(variant).toHaveProperty('score');
        expect(variant).toHaveProperty('cost_usd');
        expect(variant).toHaveProperty('latency_ms');
        expect(variant).toHaveProperty('safety');
      });

      // Check that at least one variant uses expected techniques
      const techniques = result.variants.map((v: any) => v.technique);
      expect(techniques).toContain('FewShot_CoT_SC');

      // Verify cost cap compliance
      result.variants.forEach((variant: any) => {
        expect(variant.cost_usd).toBeLessThanOrEqual(creditCardFixture.request.cost_cap_usd);
      });

      // Check for retrieval augmentation in at least one variant
      const hasRetrieval = result.variants.some((v: any) => 
        v.prompt.includes('LOOKUP') || v.technique.includes('Retrieval')
      );
      expect(hasRetrieval).toBe(true);
    });

    it('should include self-consistency and evaluation rubric', async () => {
      const response = await request(apiUrl)
        .post('/optimize')
        .send(creditCardFixture.request)
        .expect(200);

      const result = response.body;

      // Check for self-consistency patterns
      const hasSelfConsistency = result.variants.some((v: any) => 
        v.prompt.includes('Rank A') && v.prompt.includes('Rank B')
      );
      expect(hasSelfConsistency).toBe(true);

      // Check for evaluation rubric
      const hasRubric = result.variants.some((v: any) => 
        v.prompt.includes('Data currency') && v.prompt.includes('Calculation accuracy')
      );
      expect(hasRubric).toBe(true);
    });
  });

  describe('Tokyo Trip Planner', () => {
    it('should optimize travel planning with constraints', async () => {
      const response = await request(apiUrl)
        .post('/optimize')
        .send(tokyoTripFixture.request)
        .expect(200);

      const result = response.body;

      // Verify constraint handling
      const hasConstraints = result.variants.some((v: any) => 
        v.prompt.includes('8 k steps/day') && v.prompt.includes('2 500')
      );
      expect(hasConstraints).toBe(true);

      // Check for multi-plan generation
      const hasMultiplePlans = result.variants.some((v: any) => 
        v.prompt.includes('Plan A') && v.prompt.includes('Plan B')
      );
      expect(hasMultiplePlans).toBe(true);

      // Verify budget verification logic
      const hasBudgetCheck = result.variants.some((v: any) => 
        v.prompt.includes('total <= 2500')
      );
      expect(hasBudgetCheck).toBe(true);
    });

    it('should include accessibility considerations', async () => {
      const response = await request(apiUrl)
        .post('/optimize')
        .send(tokyoTripFixture.request)
        .expect(200);

      const result = response.body;

      // Check for walking distance flags
      const hasWalkingFlags = result.variants.some((v: any) => 
        v.prompt.includes('2 km walking')
      );
      expect(hasWalkingFlags).toBe(true);

      // Check for AM/PM breakdown
      const hasTimeBlocks = result.variants.some((v: any) => 
        v.prompt.includes('AM / PM blocks')
      );
      expect(hasTimeBlocks).toBe(true);
    });
  });

  describe('Spanish B1 Accelerator', () => {
    it('should optimize language learning curriculum', async () => {
      const response = await request(apiUrl)
        .post('/optimize')
        .send(spanishB1Fixture.request)
        .expect(200);

      const result = response.body;

      // Check for CEFR alignment
      const hasCEFR = result.variants.some((v: any) => 
        v.prompt.includes('CEFR') && v.prompt.includes('B1')
      );
      expect(hasCEFR).toBe(true);

      // Verify spaced repetition
      const hasSpacedRepetition = result.variants.some((v: any) => 
        v.prompt.includes('+2 days') && v.prompt.includes('+7 days') && v.prompt.includes('+30 days')
      );
      expect(hasSpacedRepetition).toBe(true);

      // Check for monitoring algorithm
      const hasMonitoring = result.variants.some((v: any) => 
        v.prompt.includes('pseudocode') || v.prompt.includes('Monitoring Algorithm')
      );
      expect(hasMonitoring).toBe(true);
    });

    it('should include dual pacing strategies', async () => {
      const response = await request(apiUrl)
        .post('/optimize')
        .send(spanishB1Fixture.request)
        .expect(200);

      const result = response.body;

      // Check for pacing strategies
      const hasPacingStrategies = result.variants.some((v: any) => 
        v.prompt.includes('Linear') && v.prompt.includes('Sprint‑Rest')
      );
      expect(hasPacingStrategies).toBe(true);

      // Verify 26-week structure
      const hasWeeklyStructure = result.variants.some((v: any) => 
        v.prompt.includes('26‑week') || v.prompt.includes('26-week')
      );
      expect(hasWeeklyStructure).toBe(true);
    });
  });

  describe('Cross-Prompt Quality Checks', () => {
    it('should enforce security levels appropriately', async () => {
      // Test strict security for financial prompt
      const creditResponse = await request(apiUrl)
        .post('/optimize')
        .send(creditCardFixture.request)
        .expect(200);

      creditResponse.body.variants.forEach((v: any) => {
        expect(v.safety).toBe('safe');
      });

      // Test moderate security for travel/education
      const tokyoResponse = await request(apiUrl)
        .post('/optimize')
        .send(tokyoTripFixture.request)
        .expect(200);

      tokyoResponse.body.variants.forEach((v: any) => {
        expect(['safe', 'moderate']).toContain(v.safety);
      });
    });

    it('should respect latency caps', async () => {
      const fixtures = [creditCardFixture, tokyoTripFixture, spanishB1Fixture];

      for (const fixture of fixtures) {
        const response = await request(apiUrl)
          .post('/optimize')
          .send(fixture.request)
          .expect(200);

        response.body.variants.forEach((v: any) => {
          expect(v.latency_ms).toBeLessThanOrEqual(fixture.request.latency_cap_ms);
        });
      }
    });

    it('should provide Pareto-optimal frontier', async () => {
      const response = await request(apiUrl)
        .post('/optimize')
        .send(creditCardFixture.request)
        .expect(200);

      const frontier = response.body.frontier;
      expect(frontier).toBeDefined();
      expect(Array.isArray(frontier)).toBe(true);

      // Verify frontier points are non-dominated
      for (let i = 0; i < frontier.length; i++) {
        for (let j = 0; j < frontier.length; j++) {
          if (i !== j) {
            const dominates = 
              frontier[i].score >= frontier[j].score && 
              frontier[i].cost_usd <= frontier[j].cost_usd &&
              (frontier[i].score > frontier[j].score || frontier[i].cost_usd < frontier[j].cost_usd);
            
            expect(dominates).toBe(false);
          }
        }
      }
    });
  });
});