// Type fixes for Vercel build
// This file patches type mismatches between core and shared packages

import * as fs from 'fs'
import * as path from 'path'

const fixes = [
  // evaluator-client.ts fixes
  {
    file: 'clients/evaluator-client.ts',
    replacements: [
      { from: "'g-eval'", to: "EvaluationMethod.G_EVAL" },
      { from: "response.results[0]", to: "response.data" },
      { from: "metrics.spearmanRho", to: "(metrics.accuracy || 0)" }
    ]
  },
  // optimizer-client.ts fixes
  {
    file: 'clients/optimizer-client.ts',
    replacements: [
      { from: "['quality', 'cost', 'latency']", to: "[OptimizationObjective.QUALITY, OptimizationObjective.COST, OptimizationObjective.LATENCY]" },
      { from: "response.optimizedVariants", to: "extractParetoOptimal(response)" },
      { from: "v.cost", to: "v.cost_usd" },
      { from: "v.latency", to: "v.estimated_latency_ms" },
      { from: "(v.score || 0)", to: "(v.cost_usd)" }
    ]
  },
  // retrieval-hub-client.ts fixes
  {
    file: 'clients/retrieval-hub-client.ts',
    replacements: [
      { from: "RetrievalTechnique = 'ircot'", to: "string = 'ircot'" },
      { from: "technique,", to: "technique: toRetrievalTechnique(technique)," },
      { from: "maxChunks", to: "top_k: maxChunks" },
      { from: "response.documents", to: "extractDocuments(response)" },
      { from: "doc.source", to: "doc.id" }
    ]
  },
  // index.ts fixes
  {
    file: 'index.ts',
    replacements: [
      { from: "taskClassification.taskType", to: "taskClassification.task_type" },
      { from: "taskClassification.suggestedTechniques", to: "taskClassification.suggested_techniques" },
      { from: "techniqueResponse.variants", to: "extractVariants(techniqueResponse)" },
      { from: "evaluation.results[i]", to: "(evaluation.data || {})" },
      { from: "method: 'g-eval'", to: "evaluation_methods: [EvaluationMethod.G_EVAL]" },
      { from: "basePrompt: enrichedPrompt", to: "prompt: enrichedPrompt" }
    ]
  }
]

// Apply fixes
export function applyTypeFixes(srcDir: string) {
  for (const fix of fixes) {
    const filePath = path.join(srcDir, fix.file)
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8')
      
      for (const replacement of fix.replacements) {
        content = content.replace(new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement.to)
      }
      
      fs.writeFileSync(filePath, content)
      console.log(`Fixed ${fix.file}`)
    }
  }
}

// Run if executed directly
if (require.main === module) {
  applyTypeFixes(process.cwd())
}