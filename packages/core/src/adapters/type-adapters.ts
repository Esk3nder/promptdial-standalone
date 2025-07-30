// Type adapters to bridge between core and shared types
import { 
  PromptVariant, 
  EvaluationMethod,
  OptimizationObjective,
  RetrievalTechnique,
  EvaluationResponse,
  OptimizerResponse,
  RetrievalResponse,
  TechniqueResponse
} from '@promptdial/shared'
import { OptimizedVariant } from '../meta-prompt-designer'

// Add these exports to shared package if they don't exist
export { EvaluationMethod, OptimizationObjective, RetrievalTechnique }

// Convert OptimizedVariant to PromptVariant
export function toPromptVariant(variant: OptimizedVariant, _index: number = 0): PromptVariant {
  return {
    id: variant.id,
    technique: extractTechniqueName(variant),
    prompt: variant.optimizedPrompt,
    temperature: 0.7,
    est_tokens: variant.estimatedTokens,
    cost_usd: 0.001,
    model: 'gpt-3.5-turbo'
  }
}

// Extract technique name from variant
function extractTechniqueName(variant: OptimizedVariant): string {
  const techniqueChange = variant.changes.find(c => 
    c.type.toLowerCase().includes('technique') || 
    c.type.toLowerCase().includes('optimization')
  )
  
  if (techniqueChange) {
    if (techniqueChange.description.toLowerCase().includes('chain') && 
        techniqueChange.description.toLowerCase().includes('thought')) {
      return 'chain_of_thought'
    }
    if (techniqueChange.description.toLowerCase().includes('few-shot')) {
      return 'few_shot'
    }
    if (techniqueChange.description.toLowerCase().includes('step')) {
      return 'zero_shot_cot'
    }
  }
  
  if (variant.optimizedPrompt.toLowerCase().includes('step by step')) {
    return 'chain_of_thought'
  }
  if (variant.optimizedPrompt.includes('Example') || variant.optimizedPrompt.includes('Q:')) {
    return 'few_shot'
  }
  
  return 'instruction'
}

// Convert string to EvaluationMethod enum
export function toEvaluationMethod(method: string): EvaluationMethod {
  switch (method) {
    case 'g-eval':
    case 'g_eval':
      return EvaluationMethod.G_EVAL
    case 'chat-eval':
    case 'chat_eval':
      return EvaluationMethod.CHAT_EVAL
    case 'role-debate':
    case 'role_debate':
      return EvaluationMethod.ROLE_DEBATE
    default:
      return EvaluationMethod.AUTOMATED_METRICS
  }
}

// Convert string to OptimizationObjective enum
export function toOptimizationObjective(objective: string): OptimizationObjective {
  switch (objective) {
    case 'quality':
      return OptimizationObjective.QUALITY
    case 'cost':
      return OptimizationObjective.COST
    case 'latency':
      return OptimizationObjective.LATENCY
    case 'diversity':
      return OptimizationObjective.DIVERSITY
    default:
      return OptimizationObjective.QUALITY
  }
}

// Convert string to RetrievalTechnique enum
export function toRetrievalTechnique(technique: string): RetrievalTechnique {
  switch (technique) {
    case 'ircot':
    case 'semantic':
      return RetrievalTechnique.SEMANTIC
    case 'keyword':
      return RetrievalTechnique.KEYWORD
    case 'hybrid':
      return RetrievalTechnique.HYBRID
    case 'multi_modal':
      return RetrievalTechnique.MULTI_MODAL
    default:
      return RetrievalTechnique.SEMANTIC
  }
}

// Extract variants from TechniqueResponse
export function extractVariants(response: TechniqueResponse): PromptVariant[] {
  if (response.success && response.data) {
    return response.data.variants || []
  }
  return []
}

// Extract evaluation result from EvaluationResponse
export function extractEvaluationResult(response: EvaluationResponse) {
  if (response.success && response.data) {
    return {
      score: response.data.final_score || 0,
      confidence: response.data.confidence_interval?.[1] || 1,
      explanation: `Evaluation score: ${response.data.final_score}`
    }
  }
  return {
    score: 0,
    confidence: 0,
    explanation: 'Evaluation failed'
  }
}

// Extract pareto optimal variants from OptimizerResponse
export function extractParetoOptimal(response: OptimizerResponse): PromptVariant[] {
  if (response.success && response.data) {
    return response.data.pareto_optimal || []
  }
  return []
}

// Extract documents from RetrievalResponse
export function extractDocuments(response: RetrievalResponse) {
  if (response.success && response.data) {
    return response.data.documents || []
  }
  return []
}