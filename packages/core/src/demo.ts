#!/usr/bin/env node

/**
 * PromptDial Demo
 * 
 * Run with: npm run dev
 */

import { PromptDial } from './index'

async function runDemo() {
  const promptDial = new PromptDial()

  console.log('🚀 PromptDial Demo\n')
  console.log('='.repeat(50))

  const examples = [
    {
      name: 'Basic Example',
      request: {
        prompt: 'Explain quantum computing',
        targetModel: 'gpt-4' as const,
        optimizationLevel: 'basic' as const
      }
    },
    {
      name: 'Coding Task',
      request: {
        prompt: 'Write a function to reverse a string',
        targetModel: 'claude-3-opus' as const,
        optimizationLevel: 'advanced' as const,
        taskType: 'coding' as const
      }
    },
    {
      name: 'Creative Writing',
      request: {
        prompt: 'Write a story about time travel',
        targetModel: 'gemini-pro' as const,
        optimizationLevel: 'expert' as const,
        taskType: 'creative' as const,
        constraints: {
          tone: 'engaging',
          maxLength: 1000
        }
      }
    }
  ]

  for (const example of examples) {
    console.log(`\n📝 ${example.name}`)
    console.log('-'.repeat(40))
    console.log(`Original: "${example.request.prompt}"`)
    console.log(`Model: ${example.request.targetModel}`)
    console.log(`Level: ${example.request.optimizationLevel}`)
    
    try {
      const result = await promptDial.optimize(example.request)
      
      console.log(`\n✨ Generated ${result.variants.length} variants`)
      
      // Show best variant
      const best = result.variants[0]
      console.log(`\nBest variant (Score: ${best.quality?.score}/100):`)
      console.log('-'.repeat(40))
      console.log(best.optimizedPrompt)
      console.log('-'.repeat(40))
      
      console.log('\n📊 Improvements:')
      best.changes.forEach(change => {
        console.log(`  • ${change.type}: ${change.description}`)
      })
      
      if (best.quality) {
        console.log('\n📈 Quality Metrics:')
        console.log(`  • Clarity: ${best.quality.factors.clarity}%`)
        console.log(`  • Specificity: ${best.quality.factors.specificity}%`)
        console.log(`  • Structure: ${best.quality.factors.structure}%`)
        console.log(`  • Completeness: ${best.quality.factors.completeness}%`)
      }
      
    } catch (error) {
      console.error('❌ Error:', error)
    }
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('✅ Demo completed!')
}

// Run the demo
runDemo().catch(console.error)