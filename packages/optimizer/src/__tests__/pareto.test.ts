/**
 * PromptDial 2.0 - Pareto Optimizer Tests
 */

import { ParetoOptimizer } from '../pareto'
import { OptimizationObjective, ParetoSolution } from '../types'

describe('ParetoOptimizer', () => {
  let optimizer: ParetoOptimizer
  
  beforeEach(() => {
    optimizer = new ParetoOptimizer()
  })
  
  describe('dominance checking', () => {
    it('should correctly identify dominated solutions', () => {
      const solution1: ParetoSolution = {
        variant_id: 'v1',
        objectives: {
          quality: 0.8,
          cost: 0.3,
          latency: 0.4
        }
      }
      
      const solution2: ParetoSolution = {
        variant_id: 'v2',
        objectives: {
          quality: 0.7,  // worse
          cost: 0.4,     // worse
          latency: 0.5   // worse
        }
      }
      
      expect(optimizer.dominates(solution1, solution2)).toBe(true)
      expect(optimizer.dominates(solution2, solution1)).toBe(false)
    })
    
    it('should handle non-dominated solutions', () => {
      const solution1: ParetoSolution = {
        variant_id: 'v1',
        objectives: {
          quality: 0.9,  // better
          cost: 0.5,     // worse
          latency: 0.3
        }
      }
      
      const solution2: ParetoSolution = {
        variant_id: 'v2',
        objectives: {
          quality: 0.8,  // worse
          cost: 0.3,     // better
          latency: 0.3
        }
      }
      
      expect(optimizer.dominates(solution1, solution2)).toBe(false)
      expect(optimizer.dominates(solution2, solution1)).toBe(false)
    })
  })
  
  describe('Pareto frontier calculation', () => {
    it('should find correct Pareto frontier', () => {
      const solutions: ParetoSolution[] = [
        { variant_id: 'v1', objectives: { quality: 0.9, cost: 0.8, latency: 0.2 } },
        { variant_id: 'v2', objectives: { quality: 0.8, cost: 0.5, latency: 0.3 } },
        { variant_id: 'v3', objectives: { quality: 0.7, cost: 0.3, latency: 0.4 } },
        { variant_id: 'v4', objectives: { quality: 0.6, cost: 0.6, latency: 0.5 } }, // dominated
        { variant_id: 'v5', objectives: { quality: 0.95, cost: 0.9, latency: 0.1 } }
      ]
      
      const frontier = optimizer.findParetoFrontier(solutions)
      
      expect(frontier).toHaveLength(4)
      expect(frontier.map(s => s.variant_id)).toContain('v1')
      expect(frontier.map(s => s.variant_id)).toContain('v2')
      expect(frontier.map(s => s.variant_id)).toContain('v3')
      expect(frontier.map(s => s.variant_id)).toContain('v5')
      expect(frontier.map(s => s.variant_id)).not.toContain('v4')
    })
    
    it('should handle empty solution set', () => {
      const frontier = optimizer.findParetoFrontier([])
      expect(frontier).toHaveLength(0)
    })
    
    it('should handle single solution', () => {
      const solution: ParetoSolution = {
        variant_id: 'v1',
        objectives: { quality: 0.8, cost: 0.3, latency: 0.4 }
      }
      
      const frontier = optimizer.findParetoFrontier([solution])
      expect(frontier).toHaveLength(1)
      expect(frontier[0]).toBe(solution)
    })
  })
  
  describe('preference-based selection', () => {
    const solutions: ParetoSolution[] = [
      { variant_id: 'high-quality', objectives: { quality: 0.95, cost: 0.8, latency: 0.3 } },
      { variant_id: 'low-cost', objectives: { quality: 0.7, cost: 0.2, latency: 0.4 } },
      { variant_id: 'fast', objectives: { quality: 0.8, cost: 0.5, latency: 0.1 } },
      { variant_id: 'balanced', objectives: { quality: 0.85, cost: 0.5, latency: 0.3 } }
    ]
    
    it('should select based on quality preference', () => {
      const preferences = {
        quality: 0.8,
        cost: 0.1,
        latency: 0.1
      }
      
      const selected = optimizer.selectByPreference(solutions, preferences)
      expect(selected.variant_id).toBe('high-quality')
    })
    
    it('should select based on cost preference', () => {
      const preferences = {
        quality: 0.1,
        cost: 0.8,
        latency: 0.1
      }
      
      const selected = optimizer.selectByPreference(solutions, preferences)
      expect(selected.variant_id).toBe('low-cost')
    })
    
    it('should select based on latency preference', () => {
      const preferences = {
        quality: 0.1,
        cost: 0.1,
        latency: 0.8
      }
      
      const selected = optimizer.selectByPreference(solutions, preferences)
      expect(selected.variant_id).toBe('fast')
    })
    
    it('should handle balanced preferences', () => {
      const preferences = {
        quality: 0.33,
        cost: 0.33,
        latency: 0.34
      }
      
      const selected = optimizer.selectByPreference(solutions, preferences)
      expect(['balanced', 'fast']).toContain(selected.variant_id)
    })
  })
  
  describe('constraint handling', () => {
    it('should filter solutions by constraints', () => {
      const solutions: ParetoSolution[] = [
        { variant_id: 'v1', objectives: { quality: 0.9, cost: 0.8, latency: 0.2 } },
        { variant_id: 'v2', objectives: { quality: 0.8, cost: 0.3, latency: 0.5 } },
        { variant_id: 'v3', objectives: { quality: 0.7, cost: 0.2, latency: 0.3 } }
      ]
      
      const constraints = {
        max_cost: 0.5,
        min_quality: 0.75,
        max_latency: 0.4
      }
      
      const filtered = optimizer.applyConstraints(solutions, constraints)
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].variant_id).toBe('v1')
    })
  })
  
  describe('utility function', () => {
    it('should calculate correct utility scores', () => {
      const solution: ParetoSolution = {
        variant_id: 'v1',
        objectives: {
          quality: 0.8,
          cost: 0.3,
          latency: 0.4
        }
      }
      
      const weights = {
        quality: 0.5,
        cost: 0.3,
        latency: 0.2
      }
      
      const utility = optimizer.calculateUtility(solution, weights)
      
      // quality contributes: 0.8 * 0.5 = 0.4
      // cost contributes: (1 - 0.3) * 0.3 = 0.21 (inverted because lower is better)
      // latency contributes: (1 - 0.4) * 0.2 = 0.12 (inverted)
      // total: 0.4 + 0.21 + 0.12 = 0.73
      expect(utility).toBeCloseTo(0.73, 2)
    })
  })
})