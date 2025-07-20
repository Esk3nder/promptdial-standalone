/**
 * PromptDial 2.0 - Task+Risk Classifier Service
 * 
 * Classifies prompts by task type, domain, complexity, and safety risk
 */

import {
  TaskType,
  Domain,
  TaskClassification,
  ServiceRequest,
  ServiceResponse,
  createServiceError,
  createServiceResponse,
  createLogger,
  ERROR_CODES,
  TECHNIQUES
} from '@promptdial/shared'

const logger = createLogger('classifier')

// ============= Pattern Definitions =============

const TASK_PATTERNS: Record<TaskType, RegExp[]> = {
  math_reasoning: [
    /\b(solve|calculate|compute|find|determine)\b.*\b(equation|math|number|value|result)\b/i,
    /\b(if|given|when).*\b(equals?|=)\b/i,
    /\b\d+\s*[\+\-\*\/]\s*\d+\b/,
    /\b(algebra|geometry|calculus|arithmetic)\b/i
  ],
  code_generation: [
    /\b(write|create|implement|code|program)\b.*\b(function|class|method|algorithm|script)\b/i,
    /\b(python|javascript|java|cpp|golang|rust)\b/i,
    /\b(debug|fix|refactor|optimize)\s+.*code\b/i,
    /\b(api|database|server|frontend|backend)\b.*\bimplement/i
  ],
  creative_writing: [
    /\b(write|create|compose)\b.*\b(story|poem|essay|article|blog|narrative)\b/i,
    /\b(creative|fiction|imaginative|narrative)\b/i,
    /\b(character|plot|theme|setting)\b.*\b(develop|create)\b/i
  ],
  data_analysis: [
    /\b(analyze|interpret|examine)\b.*\b(data|statistics|metrics|trends)\b/i,
    /\b(correlation|regression|distribution|visualization)\b/i,
    /\b(insights?|patterns?|findings?)\b.*\bdata\b/i
  ],
  summarization: [
    /\b(summarize|summary|brief|condense|shorten)\b/i,
    /\b(key\s+points?|main\s+ideas?|highlights?)\b/i,
    /\btl;?dr\b/i
  ],
  translation: [
    /\b(translate|translation)\b.*\b(from|to|into)\b/i,
    /\b(english|spanish|french|german|chinese|japanese)\b.*\b(to|into)\b/i,
    /\bconvert.*language\b/i
  ],
  general_qa: [] // Default fallback
}

const DOMAIN_PATTERNS: Record<Domain, RegExp[]> = {
  academic: [
    /\b(research|study|thesis|dissertation|paper|journal)\b/i,
    /\b(professor|student|university|college|academic)\b/i,
    /\b(hypothesis|methodology|literature\s+review)\b/i
  ],
  business: [
    /\b(business|company|corporate|enterprise|startup)\b/i,
    /\b(revenue|profit|market|strategy|customer|client)\b/i,
    /\b(roi|kpi|b2b|b2c|saas)\b/i
  ],
  technical: [
    /\b(technical|engineering|software|hardware|system)\b/i,
    /\b(api|database|server|cloud|devops|infrastructure)\b/i,
    /\b(architecture|scalability|performance|security)\b/i
  ],
  creative: [
    /\b(creative|artistic|design|aesthetic|imaginative)\b/i,
    /\b(art|music|film|literature|poetry)\b/i,
    /\b(inspiration|expression|creativity)\b/i
  ],
  general: [] // Default fallback
}

const COMPLEXITY_INDICATORS = {
  high: [
    /\b(complex|complicated|advanced|sophisticated|intricate)\b/i,
    /\b(multi-?step|multiple\s+parts?|several\s+components?)\b/i,
    /\b(analyze\s+and\s+synthesize|compare\s+and\s+contrast)\b/i,
    /\b(comprehensive|exhaustive|detailed\s+analysis)\b/i
  ],
  medium: [
    /\b(explain|describe|discuss|elaborate)\b/i,
    /\b(pros?\s+and\s+cons?|advantages?\s+and\s+disadvantages?)\b/i,
    /\b(how\s+does?.*work|what\s+are\s+the\s+differences?)\b/i
  ],
  low: [
    /\b(what\s+is|define|list|name|identify)\b/i,
    /\b(yes\s+or\s+no|true\s+or\s+false)\b/i,
    /\b(simple|basic|straightforward|easy)\b/i
  ]
}

const SAFETY_RISK_PATTERNS = [
  /\b(hack|exploit|vulnerability|injection|malware)\b/i,
  /\b(illegal|illicit|prohibited|banned)\b/i,
  /\b(harm|hurt|damage|destroy|kill)\b/i,
  /\b(personal\s+information|private\s+data|credentials|password)\b/i,
  /\b(discriminate|bias|hate|offensive)\b/i
]

// ============= Classifier Implementation =============

export class TaskRiskClassifier {
  async classify(prompt: string): Promise<TaskClassification> {
    const startTime = Date.now()
    
    try {
      // Detect task type
      const taskType = this.detectTaskType(prompt)
      
      // Detect domain
      const domain = this.detectDomain(prompt)
      
      // Calculate complexity
      const complexity = this.calculateComplexity(prompt)
      
      // Assess safety risk
      const safetyRisk = this.assessSafetyRisk(prompt)
      
      // Determine if retrieval is needed
      const needsRetrieval = this.needsRetrieval(prompt, taskType)
      
      // Suggest techniques based on classification
      const suggestedTechniques = this.suggestTechniques(taskType, complexity, needsRetrieval)
      
      const classification: TaskClassification = {
        task_type: taskType,
        domain,
        complexity,
        safety_risk: safetyRisk,
        needs_retrieval: needsRetrieval,
        suggested_techniques: suggestedTechniques
      }
      
      const latency = Date.now() - startTime
      logger.info(`Classified prompt in ${latency}ms`, { classification })
      
      return classification
    } catch (error) {
      logger.error('Classification failed', error as Error)
      throw error
    }
  }
  
  private detectTaskType(prompt: string): TaskType {
    const lowerPrompt = prompt.toLowerCase()
    
    // Check each task type's patterns
    for (const [taskType, patterns] of Object.entries(TASK_PATTERNS)) {
      if (taskType === 'general_qa') continue // Skip default
      
      for (const pattern of patterns) {
        if (pattern.test(lowerPrompt)) {
          return taskType as TaskType
        }
      }
    }
    
    // Default to general Q&A
    return 'general_qa'
  }
  
  private detectDomain(prompt: string): Domain {
    const lowerPrompt = prompt.toLowerCase()
    
    for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
      if (domain === 'general') continue
      
      for (const pattern of patterns) {
        if (pattern.test(lowerPrompt)) {
          return domain as Domain
        }
      }
    }
    
    return 'general'
  }
  
  private calculateComplexity(prompt: string): number {
    const lowerPrompt = prompt.toLowerCase()
    let complexityScore = 0.5 // Start with medium
    
    // Check high complexity indicators
    for (const pattern of COMPLEXITY_INDICATORS.high) {
      if (pattern.test(lowerPrompt)) {
        complexityScore = Math.max(complexityScore, 0.8)
      }
    }
    
    // Check low complexity indicators
    for (const pattern of COMPLEXITY_INDICATORS.low) {
      if (pattern.test(lowerPrompt)) {
        complexityScore = Math.min(complexityScore, 0.3)
      }
    }
    
    // Adjust based on prompt length
    const wordCount = prompt.split(/\s+/).length
    if (wordCount > 100) {
      complexityScore += 0.1
    } else if (wordCount < 20) {
      complexityScore -= 0.1
    }
    
    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, complexityScore))
  }
  
  private assessSafetyRisk(prompt: string): number {
    const lowerPrompt = prompt.toLowerCase()
    let riskScore = 0
    
    for (const pattern of SAFETY_RISK_PATTERNS) {
      if (pattern.test(lowerPrompt)) {
        riskScore += 0.3
      }
    }
    
    // Cap at 1.0
    return Math.min(1, riskScore)
  }
  
  private needsRetrieval(prompt: string, taskType: TaskType): boolean {
    const retrievalIndicators = [
      /\b(based\s+on|according\s+to|referring\s+to|using)\b.*\b(document|article|paper|source)\b/i,
      /\b(latest|recent|current|up-to-date)\s+information\b/i,
      /\b(fact-check|verify|confirm|validate)\b/i,
      /\b(cite|reference|source|evidence)\b/i
    ]
    
    // Some task types are more likely to need retrieval
    if (['data_analysis', 'summarization'].includes(taskType)) {
      return true
    }
    
    // Check for explicit retrieval indicators
    const lowerPrompt = prompt.toLowerCase()
    return retrievalIndicators.some(pattern => pattern.test(lowerPrompt))
  }
  
  private suggestTechniques(
    taskType: TaskType,
    complexity: number,
    needsRetrieval: boolean
  ): string[] {
    const techniques: string[] = []
    
    // Base technique selection on task type
    switch (taskType) {
      case 'math_reasoning':
        techniques.push(TECHNIQUES.FEW_SHOT_COT)
        techniques.push(TECHNIQUES.SELF_CONSISTENCY)
        if (complexity > 0.7) {
          techniques.push(TECHNIQUES.TREE_OF_THOUGHT)
        }
        break
        
      case 'code_generation':
        techniques.push(TECHNIQUES.FEW_SHOT_COT)
        techniques.push(TECHNIQUES.REACT)
        if (complexity > 0.6) {
          techniques.push(TECHNIQUES.DSPY_APE)
        }
        break
        
      case 'creative_writing':
        techniques.push(TECHNIQUES.TREE_OF_THOUGHT)
        techniques.push(TECHNIQUES.UNIVERSAL_SELF_PROMPT)
        break
        
      case 'data_analysis':
        techniques.push(TECHNIQUES.AUTO_DICOT)
        techniques.push(TECHNIQUES.SELF_CONSISTENCY)
        break
        
      default:
        techniques.push(TECHNIQUES.FEW_SHOT_COT)
    }
    
    // Add retrieval-based technique if needed
    if (needsRetrieval) {
      techniques.push(TECHNIQUES.IRCOT)
    }
    
    // Add advanced techniques for high complexity
    if (complexity > 0.8 && !techniques.includes(TECHNIQUES.DSPY_GRIPS)) {
      techniques.push(TECHNIQUES.DSPY_GRIPS)
    }
    
    return techniques
  }
}

// ============= Service API =============

export async function handleClassifyRequest(
  request: ServiceRequest<{ prompt: string }>
): Promise<ServiceResponse<TaskClassification>> {
  const classifier = new TaskRiskClassifier()
  
  try {
    const classification = await classifier.classify(request.payload.prompt)
    return createServiceResponse(request, classification)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.INTERNAL_ERROR,
      'Classification failed',
      true
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

// ============= Standalone Service =============

if (require.main === module) {
  const express = require('express')
  const app = express()
  const PORT = process.env.PORT || 3001
  
  app.use(express.json())
  
  app.post('/classify', async (req: any, res: any) => {
    const response = await handleClassifyRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })
  
  app.get('/health', (_req: any, res: any) => {
    res.json({ status: 'healthy', service: 'classifier' })
  })
  
  app.listen(PORT, () => {
    logger.info(`Classifier service running on port ${PORT}`)
  })
}