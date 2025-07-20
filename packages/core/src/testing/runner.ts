import { PromptDial } from '../index'
import { testAllProviders } from './clients'
import type { TestResult, ModelProvider } from './types'

interface TestRunResult {
  original: Record<ModelProvider, TestResult>
  optimized: Array<{
    variant: string
    results: Record<ModelProvider, TestResult>
    quality: number
  }>
  summary: {
    bestVariantIndex: number
    averageImprovement: {
      responseTime: number
      tokenCount: number
    }
  }
}

export async function runPerformanceTest(
  prompt: string,
  options: {
    targetModel?: 'gpt-4' | 'claude-3-opus' | 'gemini-pro'
    optimizationLevel?: 'basic' | 'advanced' | 'expert'
  } = {}
): Promise<TestRunResult> {
  const promptDial = new PromptDial()
  
  // Test original prompt
  console.log('🔍 Testing original prompt...')
  const originalResults = await testAllProviders(prompt)
  
  // Optimize prompt
  console.log('✨ Optimizing prompt...')
  const optimizationResult = await promptDial.optimize({
    prompt,
    targetModel: options.targetModel || 'gpt-4',
    optimizationLevel: options.optimizationLevel || 'advanced'
  })
  
  // Test optimized variants
  console.log(`📊 Testing ${optimizationResult.variants.length} optimized variants...`)
  const optimizedResults = await Promise.all(
    optimizationResult.variants.map(async (variant) => ({
      variant: variant.optimizedPrompt,
      results: await testAllProviders(variant.optimizedPrompt),
      quality: variant.quality?.score || 0
    }))
  )
  
  // Calculate improvements
  const improvements = optimizedResults.map(opt => {
    const providers: ModelProvider[] = ['openai', 'anthropic', 'google']
    let totalTimeImprovement = 0
    let totalTokenImprovement = 0
    let validComparisons = 0
    
    providers.forEach(provider => {
      const original = originalResults[provider]
      const optimized = opt.results[provider]
      
      if (!original.error && !optimized.error) {
        totalTimeImprovement += (original.responseTime - optimized.responseTime) / original.responseTime * 100
        totalTokenImprovement += (original.tokenCount - optimized.tokenCount) / original.tokenCount * 100
        validComparisons++
      }
    })
    
    return {
      responseTime: validComparisons > 0 ? totalTimeImprovement / validComparisons : 0,
      tokenCount: validComparisons > 0 ? totalTokenImprovement / validComparisons : 0
    }
  })
  
  // Find best variant
  const bestVariantIndex = optimizedResults.reduce((best, current, index) => 
    current.quality > optimizedResults[best].quality ? index : best, 0)
  
  // Calculate average improvement
  const avgImprovement = improvements.reduce((acc, imp) => ({
    responseTime: acc.responseTime + imp.responseTime / improvements.length,
    tokenCount: acc.tokenCount + imp.tokenCount / improvements.length
  }), { responseTime: 0, tokenCount: 0 })
  
  return {
    original: originalResults,
    optimized: optimizedResults,
    summary: {
      bestVariantIndex,
      averageImprovement: avgImprovement
    }
  }
}

export function formatTestResults(results: TestRunResult): string {
  const output: string[] = []
  
  output.push('\n📊 Performance Test Results')
  output.push('=' .repeat(50))
  
  // Original results
  output.push('\n🔵 Original Prompt Performance:')
  const providers: ModelProvider[] = ['openai', 'anthropic', 'google']
  
  providers.forEach(provider => {
    const result = results.original[provider]
    if (result.error) {
      output.push(`  ${provider}: ❌ Error - ${result.error}`)
    } else {
      output.push(`  ${provider}: ${result.responseTime}ms, ${result.tokenCount} tokens`)
    }
  })
  
  // Best optimized variant
  const best = results.optimized[results.summary.bestVariantIndex]
  output.push(`\n🟢 Best Optimized Variant (Quality: ${best.quality}/100):`)
  
  providers.forEach(provider => {
    const result = best.results[provider]
    const original = results.original[provider]
    
    if (result.error) {
      output.push(`  ${provider}: ❌ Error - ${result.error}`)
    } else if (!original.error) {
      const timeChange = ((original.responseTime - result.responseTime) / original.responseTime * 100).toFixed(1)
      const tokenChange = ((original.tokenCount - result.tokenCount) / original.tokenCount * 100).toFixed(1)
      
      output.push(`  ${provider}: ${result.responseTime}ms (${timeChange}%), ${result.tokenCount} tokens (${tokenChange}%)`)
    } else {
      output.push(`  ${provider}: ${result.responseTime}ms, ${result.tokenCount} tokens`)
    }
  })
  
  // Summary
  output.push('\n📈 Summary:')
  output.push(`  Average Response Time Improvement: ${results.summary.averageImprovement.responseTime.toFixed(1)}%`)
  output.push(`  Average Token Count Improvement: ${results.summary.averageImprovement.tokenCount.toFixed(1)}%`)
  output.push(`  Total Variants Tested: ${results.optimized.length}`)
  
  return output.join('\n')
}