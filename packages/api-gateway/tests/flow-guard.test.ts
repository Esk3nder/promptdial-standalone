import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FlowGuard } from '../src/flow-guard'

describe('FlowGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateResponse', () => {
    it('should pass validation for valid response', () => {
      const validResponse = {
        result: {
          variants: [
            { technique: 'chain_of_thought', prompt: 'Test prompt 1' },
            { technique: 'few_shot', prompt: 'Test prompt 2' }
          ],
          recommended_variant: { technique: 'chain_of_thought', prompt: 'Test prompt 1' },
          optimization_metadata: {
            techniques_used: ['chain_of_thought', 'few_shot'],
            suggested_techniques: ['chain_of_thought', 'few_shot'],
            total_variants_generated: 2,
            pareto_frontier_size: 2,
            safety_modifications: false
          }
        }
      }

      const result = FlowGuard.validateResponse(validResponse)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.receipt).toBeDefined()
      expect(result.receipt?.flow_version).toBe('3.0.0')
    })

    it('should fail validation when no techniques are used', () => {
      const invalidResponse = {
        result: {
          variants: [{ technique: 'basic', prompt: 'Test' }],
          optimization_metadata: {
            techniques_used: [], // Empty array
            suggested_techniques: ['chain_of_thought']
          }
        }
      }

      const result = FlowGuard.validateResponse(invalidResponse)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('No techniques applied')
    })

    it('should fail validation when no variants generated', () => {
      const invalidResponse = {
        result: {
          variants: [], // Empty array
          optimization_metadata: {
            techniques_used: ['chain_of_thought'],
            suggested_techniques: ['chain_of_thought']
          }
        }
      }

      const result = FlowGuard.validateResponse(invalidResponse)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('No variants generated')
    })

    it('should fail validation when strategy planner output missing', () => {
      const invalidResponse = {
        result: {
          variants: [{ technique: 'basic', prompt: 'Test' }],
          optimization_metadata: {
            techniques_used: ['basic'],
            suggested_techniques: [] // Empty array
          }
        }
      }

      const result = FlowGuard.validateResponse(invalidResponse)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('No suggested techniques from strategy planner')
    })

    it('should fail validation when variants missing required fields', () => {
      const invalidResponse = {
        result: {
          variants: [
            { technique: 'chain_of_thought' }, // Missing prompt
            { prompt: 'Test' } // Missing technique
          ],
          optimization_metadata: {
            techniques_used: ['chain_of_thought'],
            suggested_techniques: ['chain_of_thought']
          }
        }
      }

      const result = FlowGuard.validateResponse(invalidResponse)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Variant 0 missing prompt')
      expect(result.errors).toContain('Variant 1 missing technique')
    })
  })

  describe('receipt generation and verification', () => {
    it('should generate and verify valid receipt', () => {
      const result = {
        optimization_metadata: {
          techniques_used: ['chain_of_thought', 'few_shot'],
          suggested_techniques: ['chain_of_thought', 'few_shot']
        },
        recommended_variant: { model: 'gpt-4' }
      }
      const traceId = 'test-trace-123'

      const receipt = FlowGuard.generateReceipt(result, traceId)
      
      expect(receipt.flow_version).toBe('3.0.0')
      expect(receipt.planner_hash).toBeDefined()
      expect(receipt.builder_hash).toBeDefined()
      expect(receipt.runner_model).toBe('gpt-4')
      expect(receipt.timestamp).toBeDefined()
      expect(receipt.sig).toBeDefined()

      // Verify the receipt
      const isValid = FlowGuard.verifyReceipt(receipt, traceId)
      expect(isValid).toBe(true)

      // Tampered receipt should fail
      const tamperedReceipt = { ...receipt, flow_version: '2.0.0' }
      const isTampered = FlowGuard.verifyReceipt(tamperedReceipt, traceId)
      expect(isTampered).toBe(false)
    })

    it('should fail verification with wrong trace ID', () => {
      const result = {
        optimization_metadata: {
          techniques_used: ['chain_of_thought'],
          suggested_techniques: ['chain_of_thought']
        },
        recommended_variant: { model: 'gpt-4' }
      }
      const traceId = 'test-trace-123'

      const receipt = FlowGuard.generateReceipt(result, traceId)
      
      // Verify with wrong trace ID
      const isValid = FlowGuard.verifyReceipt(receipt, 'wrong-trace-id')
      expect(isValid).toBe(false)
    })
  })

  describe('hashData', () => {
    it('should generate consistent hashes for same data', () => {
      const data = ['technique1', 'technique2']
      
      const hash1 = FlowGuard.hashData(data)
      const hash2 = FlowGuard.hashData(data)
      
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(8)
    })

    it('should generate different hashes for different data', () => {
      const data1 = ['technique1']
      const data2 = ['technique2']
      
      const hash1 = FlowGuard.hashData(data1)
      const hash2 = FlowGuard.hashData(data2)
      
      expect(hash1).not.toBe(hash2)
    })
  })
})