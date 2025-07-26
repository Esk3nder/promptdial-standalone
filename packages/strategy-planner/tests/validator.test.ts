import { describe, it, expect, beforeEach } from 'vitest';
import { Validator } from '../src/validator';
import { Technique, ValidationError } from '../src/types';

describe('Validator', () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
  });

  describe('validate', () => {
    it('should validate a correct response', async () => {
      const validResponse = {
        suggested_techniques: [Technique.CHAIN_OF_THOUGHT, Technique.SELF_CONSISTENCY],
        rationale: 'Using CoT for reasoning and self-consistency for reliability',
        confidence: 0.85,
        metadata: {
          processingTimeMs: 50
        }
      };

      const result = await validator.validate(validResponse);
      expect(result).toEqual(validResponse);
    });

    it('should reject response with invalid techniques', async () => {
      const invalidResponse = {
        suggested_techniques: ['invalid_technique', Technique.CHAIN_OF_THOUGHT],
        rationale: 'Test rationale',
        confidence: 0.5
      };

      await expect(validator.validate(invalidResponse)).rejects.toThrow(ValidationError);
    });

    it('should reject response with more than 3 techniques', async () => {
      const tooManyTechniques = {
        suggested_techniques: [
          Technique.CHAIN_OF_THOUGHT,
          Technique.TREE_OF_THOUGHT,
          Technique.SELF_CONSISTENCY,
          Technique.SELF_REFINE
        ],
        rationale: 'Too many techniques',
        confidence: 0.7
      };

      await expect(validator.validate(tooManyTechniques)).rejects.toThrow(ValidationError);
    });

    it('should reject response with invalid confidence', async () => {
      const invalidConfidence = {
        suggested_techniques: [Technique.CHAIN_OF_THOUGHT],
        rationale: 'Test rationale',
        confidence: 1.5 // Out of bounds
      };

      await expect(validator.validate(invalidConfidence)).rejects.toThrow(ValidationError);
    });

    it('should reject response with missing required fields', async () => {
      const missingFields = {
        suggested_techniques: [Technique.CHAIN_OF_THOUGHT]
        // Missing rationale and confidence
      };

      await expect(validator.validate(missingFields)).rejects.toThrow(ValidationError);
    });

    it('should complete validation within 100ms', async () => {
      const validResponse = {
        suggested_techniques: [Technique.CHAIN_OF_THOUGHT],
        rationale: 'Quick validation test',
        confidence: 0.5
      };

      const startTime = Date.now();
      await validator.validate(validResponse);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('quickValidate', () => {
    it('should quickly validate valid techniques', () => {
      const techniques = ['chain_of_thought', 'self_consistency'];
      expect(validator.quickValidate(techniques)).toBe(true);
    });

    it('should reject invalid techniques', () => {
      const techniques = ['chain_of_thought', 'invalid_tech'];
      expect(validator.quickValidate(techniques)).toBe(false);
    });

    it('should handle empty array', () => {
      expect(validator.quickValidate([])).toBe(true);
    });
  });
});