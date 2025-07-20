/**
 * Tests for Task+Risk Classifier
 */

import { describe, it, expect } from 'vitest'
import { TaskRiskClassifier } from '../src'
import { TECHNIQUES } from '@promptdial/shared'

describe('TaskRiskClassifier', () => {
  const classifier = new TaskRiskClassifier()
  
  describe('Task Type Detection', () => {
    it('should detect math reasoning tasks', async () => {
      const prompts = [
        'Solve: If 3x + 5 = 20, what is x?',
        'Calculate the area of a circle with radius 5',
        'Find the derivative of x^2 + 3x',
        'Determine the value of y when 2y - 8 = 10'
      ]
      
      for (const prompt of prompts) {
        const result = await classifier.classify(prompt)
        expect(result.task_type).toBe('math_reasoning')
      }
    })
    
    it('should detect code generation tasks', async () => {
      const prompts = [
        'Write a Python function to sort an array',
        'Create a JavaScript class for a todo list',
        'Implement a binary search algorithm in Java',
        'Debug this code that throws a null pointer exception'
      ]
      
      for (const prompt of prompts) {
        const result = await classifier.classify(prompt)
        expect(result.task_type).toBe('code_generation')
      }
    })
    
    it('should detect creative writing tasks', async () => {
      const prompts = [
        'Write a short story about a robot learning to love',
        'Create a poem about the ocean',
        'Compose a blog post about sustainable living',
        'Develop a character for a fantasy novel'
      ]
      
      for (const prompt of prompts) {
        const result = await classifier.classify(prompt)
        expect(result.task_type).toBe('creative_writing')
      }
    })
    
    it('should detect data analysis tasks', async () => {
      const prompts = [
        'Analyze the correlation between temperature and ice cream sales',
        'Interpret these sales metrics and identify trends',
        'Examine the data distribution and find outliers',
        'What insights can you derive from this customer data?'
      ]
      
      for (const prompt of prompts) {
        const result = await classifier.classify(prompt)
        expect(result.task_type).toBe('data_analysis')
      }
    })
    
    it('should default to general Q&A for unclear prompts', async () => {
      const prompts = [
        'What is the capital of France?',
        'Tell me about photosynthesis',
        'How does machine learning work?',
        'Explain quantum computing'
      ]
      
      for (const prompt of prompts) {
        const result = await classifier.classify(prompt)
        expect(result.task_type).toBe('general_qa')
      }
    })
  })
  
  describe('Domain Detection', () => {
    it('should detect academic domain', async () => {
      const prompt = 'Write a research paper on climate change impacts'
      const result = await classifier.classify(prompt)
      expect(result.domain).toBe('academic')
    })
    
    it('should detect business domain', async () => {
      const prompt = 'Analyze our company revenue and create a growth strategy'
      const result = await classifier.classify(prompt)
      expect(result.domain).toBe('business')
    })
    
    it('should detect technical domain', async () => {
      const prompt = 'Design a scalable microservices architecture for our API'
      const result = await classifier.classify(prompt)
      expect(result.domain).toBe('technical')
    })
  })
  
  describe('Complexity Calculation', () => {
    it('should rate simple prompts as low complexity', async () => {
      const prompt = 'What is 2 + 2?'
      const result = await classifier.classify(prompt)
      expect(result.complexity).toBeLessThan(0.4)
    })
    
    it('should rate complex prompts as high complexity', async () => {
      const prompt = `
        Analyze the multi-step process of photosynthesis, including the light-dependent 
        and light-independent reactions. Compare and contrast the efficiency of C3, C4, 
        and CAM photosynthesis pathways, and discuss their evolutionary advantages in 
        different environmental conditions. Provide a comprehensive analysis with examples.
      `
      const result = await classifier.classify(prompt)
      expect(result.complexity).toBeGreaterThan(0.7)
    })
  })
  
  describe('Safety Risk Assessment', () => {
    it('should detect low risk for normal prompts', async () => {
      const prompt = 'Explain how machine learning works'
      const result = await classifier.classify(prompt)
      expect(result.safety_risk).toBeLessThan(0.3)
    })
    
    it('should detect high risk for potentially harmful prompts', async () => {
      const prompt = 'How to hack into a computer system'
      const result = await classifier.classify(prompt)
      expect(result.safety_risk).toBeGreaterThan(0.3)
    })
  })
  
  describe('Retrieval Detection', () => {
    it('should detect when retrieval is needed', async () => {
      const prompts = [
        'Based on the latest research, what are the effects of climate change?',
        'According to the document, what are the main findings?',
        'Fact-check this claim about vaccine effectiveness',
        'Cite sources for the benefits of meditation'
      ]
      
      for (const prompt of prompts) {
        const result = await classifier.classify(prompt)
        expect(result.needs_retrieval).toBe(true)
      }
    })
    
    it('should not need retrieval for self-contained prompts', async () => {
      const prompt = 'Write a function to calculate factorial'
      const result = await classifier.classify(prompt)
      expect(result.needs_retrieval).toBe(false)
    })
  })
  
  describe('Technique Suggestions', () => {
    it('should suggest appropriate techniques for math reasoning', async () => {
      const prompt = 'Solve this complex equation: x^3 + 2x^2 - 5x + 1 = 0'
      const result = await classifier.classify(prompt)
      
      expect(result.suggested_techniques).toContain(TECHNIQUES.FEW_SHOT_COT)
      expect(result.suggested_techniques).toContain(TECHNIQUES.SELF_CONSISTENCY)
    })
    
    it('should suggest Tree of Thought for high complexity tasks', async () => {
      const prompt = `
        Design a comprehensive solution for reducing carbon emissions in urban areas,
        considering multiple stakeholders, budget constraints, and implementation timeline.
        Analyze trade-offs between different approaches.
      `
      const result = await classifier.classify(prompt)
      
      expect(result.complexity).toBeGreaterThan(0.7)
      expect(result.suggested_techniques).toContain(TECHNIQUES.TREE_OF_THOUGHT)
    })
    
    it('should suggest IRCoT when retrieval is needed', async () => {
      const prompt = 'Based on recent studies, analyze the effectiveness of remote work'
      const result = await classifier.classify(prompt)
      
      expect(result.needs_retrieval).toBe(true)
      expect(result.suggested_techniques).toContain(TECHNIQUES.IRCOT)
    })
  })
  
  describe('Performance', () => {
    it('should classify prompts within 50ms', async () => {
      const prompt = 'Solve this math problem step by step'
      const start = Date.now()
      
      await classifier.classify(prompt)
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(50)
    })
  })
})