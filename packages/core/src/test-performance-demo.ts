#!/usr/bin/env node

import 'dotenv/config'
import { runPerformanceTest, formatTestResults } from './testing/runner'

// Demo mode - simulates a test without requiring the server
async function runDemo() {
  console.log('\n🎬 PromptDial Performance Test Demo')
  console.log('=' .repeat(50))
  console.log('Note: This is a demo showing what the live dashboard would display')
  console.log('=' .repeat(50))

  const prompt = "Explain quantum computing in simple terms"
  
  console.log(`\nTesting prompt: "${prompt}"`)
  console.log('Target Model: gpt-4')
  console.log('Optimization Level: advanced\n')

  try {
    console.log('🔍 Starting test...\n')
    
    const results = await runPerformanceTest(prompt, {
      targetModel: 'gpt-4',
      optimizationLevel: 'advanced'
    })
    
    console.log(formatTestResults(results))
    
    // Show what the live dashboard would display
    console.log('\n' + '=' .repeat(50))
    console.log('🖥️  Live Dashboard Features:')
    console.log('=' .repeat(50))
    console.log('\n1. Real-time Progress Updates:')
    console.log('   ✅ Original prompt tested (3/3 providers)')
    console.log('   ⏳ Testing variant 2/3...')
    console.log('   └─ ✅ OpenAI (1.2s)')
    console.log('   └─ ⏳ Anthropic (testing...)')
    console.log('   └─ ⏱️  Google (pending)')
    
    console.log('\n2. Visual Performance Charts:')
    console.log('   📊 Bar charts comparing response times')
    console.log('   📈 Token usage visualizations')
    console.log('   🎯 Quality score indicators')
    
    console.log('\n3. Best Optimized Prompt Display:')
    console.log('   📝 Syntax highlighting for changes')
    console.log('   📋 One-click copy functionality')
    console.log('   🏆 Quality score breakdown')
    
    console.log('\n' + '=' .repeat(50))
    console.log('To see the full live dashboard:')
    console.log('1. Fix dependencies: npm install express cors')
    console.log('2. Start server: npm run server')
    console.log('3. Start UI: npm run dev (in packages/ui)')
    console.log('4. Open: http://localhost:5173/test-dashboard.html')
    console.log('=' .repeat(50))
    
  } catch (error) {
    console.error('❌ Error:', error)
    console.log('\nMake sure you have API keys set in your .env file!')
  }
}

runDemo().catch(console.error)