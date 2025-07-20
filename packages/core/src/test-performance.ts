#!/usr/bin/env node

import 'dotenv/config'
import { runPerformanceTest, formatTestResults } from './testing/runner'

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.error('❌ Error: Please provide a prompt to test')
    console.log('\nUsage: npm run test:performance "Your prompt here"')
    console.log('\nOptions:')
    console.log('  --model <model>     Target model: gpt-4, claude-3-opus, gemini-pro (default: gpt-4)')
    console.log('  --level <level>     Optimization level: basic, advanced, expert (default: advanced)')
    console.log('\nExample:')
    console.log('  npm run test:performance "Explain quantum computing" --model claude-3-opus --level expert')
    process.exit(1)
  }
  
  // Parse arguments
  const prompt = args.find(arg => !arg.startsWith('--')) || ''
  const modelIndex = args.indexOf('--model')
  const levelIndex = args.indexOf('--level')
  
  const targetModel = modelIndex >= 0 ? args[modelIndex + 1] as any : 'gpt-4'
  const optimizationLevel = levelIndex >= 0 ? args[levelIndex + 1] as any : 'advanced'
  
  // Validate environment
  const requiredEnvVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_AI_API_KEY']
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.warn('⚠️  Warning: Missing API keys in environment:')
    missingVars.forEach(varName => console.warn(`   - ${varName}`))
    console.warn('\nTests will be skipped for providers without API keys.')
    console.warn('See .env.example for setup instructions.\n')
  }
  
  console.log('🚀 PromptDial Performance Test')
  console.log('=' .repeat(50))
  console.log(`Prompt: "${prompt}"`)
  console.log(`Target Model: ${targetModel}`)
  console.log(`Optimization Level: ${optimizationLevel}`)
  console.log('=' .repeat(50))
  
  try {
    const results = await runPerformanceTest(prompt, {
      targetModel,
      optimizationLevel
    })
    
    console.log(formatTestResults(results))
    
    // Show the best optimized prompt
    const bestVariant = results.optimized[results.summary.bestVariantIndex]
    console.log('\n🎯 Best Optimized Prompt:')
    console.log('-'.repeat(50))
    console.log(bestVariant.variant)
    console.log('-'.repeat(50))
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main().catch(console.error)