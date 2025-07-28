import { describe, it, expect, beforeAll } from 'vitest';
import { PromptDial } from '../src/index.js';
import type { OptimizationRequest } from '../src/meta-prompt-designer.js';

describe('Core Optimization Tests', () => {
  let promptDial: PromptDial;

  beforeAll(() => {
    // Initialize with AI enabled if keys are available
    promptDial = new PromptDial({
      autoValidate: true,
      sortByQuality: true,
      useAI: Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
    });
  });

  describe('Basic Optimization', () => {
    it('should optimize a simple prompt', async () => {
      const request: OptimizationRequest = {
        prompt: 'Explain quantum computing',
        targetModel: 'gpt-4'
      };

      const result = await promptDial.optimize(request);
      
      expect(result).toBeDefined();
      expect(result.variants).toBeDefined();
      expect(result.variants.length).toBeGreaterThan(0);
      
      // Each variant should have required fields
      result.variants.forEach(variant => {
        expect(variant.optimizedPrompt).toBeDefined();
        expect(variant.optimizedPrompt.length).toBeGreaterThan(request.prompt.length);
        expect(variant.changes).toBeDefined();
        expect(Array.isArray(variant.changes)).toBe(true);
      });
    });

    it('should handle prompts without API keys gracefully', async () => {
      const noKeyPromptDial = new PromptDial({
        autoValidate: true,
        sortByQuality: true,
        useAI: false // Force template mode
      });

      const request: OptimizationRequest = {
        prompt: 'Write a blog post about AI',
        targetModel: 'gpt-4'
      };

      const result = await noKeyPromptDial.optimize(request);
      
      expect(result).toBeDefined();
      expect(result.variants).toBeDefined();
      expect(result.variants.length).toBeGreaterThan(0);
    });

    it('should respect maxVariants option', async () => {
      const request: OptimizationRequest = {
        prompt: 'What is machine learning?',
        targetModel: 'gpt-4'
      };

      const result = await promptDial.optimize(request, { maxVariants: 3 });
      
      expect(result.variants.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Quality Validation', () => {
    it('should include quality scores when autoValidate is true', async () => {
      const request: OptimizationRequest = {
        prompt: 'Create a marketing strategy',
        targetModel: 'gpt-4'
      };

      const result = await promptDial.optimize(request);
      
      result.variants.forEach(variant => {
        if (variant.qualityAssessment) {
          expect(variant.qualityAssessment.overallScore).toBeDefined();
          expect(variant.qualityAssessment.overallScore).toBeGreaterThanOrEqual(0);
          expect(variant.qualityAssessment.overallScore).toBeLessThanOrEqual(100);
        }
      });
    });

    it('should sort by quality when sortByQuality is true', async () => {
      const request: OptimizationRequest = {
        prompt: 'Design a mobile app',
        targetModel: 'gpt-4'
      };

      const result = await promptDial.optimize(request);
      
      // Check if variants are sorted by quality score (descending)
      for (let i = 1; i < result.variants.length; i++) {
        const prevScore = result.variants[i-1].qualityAssessment?.overallScore || 0;
        const currScore = result.variants[i].qualityAssessment?.overallScore || 0;
        expect(prevScore).toBeGreaterThanOrEqual(currScore);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty prompts', async () => {
      const request: OptimizationRequest = {
        prompt: '',
        targetModel: 'gpt-4'
      };

      await expect(promptDial.optimize(request)).rejects.toThrow();
    });

    it('should handle extremely long prompts', async () => {
      const request: OptimizationRequest = {
        prompt: 'a'.repeat(10000), // 10k characters
        targetModel: 'gpt-4'
      };

      const result = await promptDial.optimize(request);
      expect(result).toBeDefined();
      expect(result.variants.length).toBeGreaterThan(0);
    });
  });
});