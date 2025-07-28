/**
 * PromptDial 3.0 - Task+Risk Classifier Service
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
  TECHNIQUES,
} from '@promptdial/shared'

const logger = createLogger('classifier')

// ============= Pattern Definitions =============

const TASK_PATTERNS: Record<TaskType, RegExp[]> = {
  math_reasoning: [
    /\b(solve|calculate|compute|find|determine)\b.*\b(equation|math|number|value|result)\b/i,
    /\b(if|given|when).*\b(equals?|=)\b/i,
    /\b\d+\s*[\+\-\*\/]\s*\d+\b/,
    /\b(algebra|geometry|calculus|arithmetic|statistics|probability)\b/i,
    /\b(prove|derive|demonstrate|verify)\b.*\b(theorem|formula|equation)\b/i,
    /\b(optimize|minimize|maximize|constraint)\b/i,
  ],
  code_generation: [
    /\b(write|create|implement|code|program|develop)\b.*\b(function|class|method|algorithm|script|app)\b/i,
    /\b(python|javascript|typescript|java|cpp|golang|rust|react|node)\b/i,
    /\b(debug|fix|refactor|optimize|test)\s+.*code\b/i,
    /\b(api|database|server|frontend|backend|fullstack)\b.*\b(implement|create|build)\b/i,
    /\b(architecture|design\s+pattern|microservice|monolith)\b/i,
    /\b(unit\s+test|integration|e2e|testing)\b/i,
  ],
  creative_writing: [
    /\b(write|create|compose|craft|author)\b.*\b(story|poem|essay|article|blog|narrative|script)\b/i,
    /\b(creative|fiction|imaginative|narrative|literary)\b/i,
    /\b(character|plot|theme|setting|dialogue|scene)\b.*\b(develop|create|write)\b/i,
    /\b(tone|voice|style|mood|atmosphere)\b/i,
    /\b(metaphor|simile|imagery|symbolism)\b/i,
  ],
  data_analysis: [
    /\b(analyze|interpret|examine|explore|investigate)\b.*\b(data|statistics|metrics|trends|patterns)\b/i,
    /\b(correlation|regression|distribution|visualization|clustering)\b/i,
    /\b(insights?|patterns?|findings?|anomalies?)\b.*\bdata\b/i,
    /\b(machine\s+learning|ml|ai|predictive|model)\b/i,
    /\b(dashboard|report|visualization|chart|graph)\b/i,
  ],
  summarization: [
    /\b(summarize|summary|brief|condense|shorten|distill|synthesize)\b/i,
    /\b(key\s+points?|main\s+ideas?|highlights?|takeaways?)\b/i,
    /\btl;?dr\b/i,
    /\b(abstract|overview|synopsis|digest)\b/i,
    /\b(essence|gist|core\s+message)\b/i,
  ],
  translation: [
    /\b(translate|translation|convert)\b.*\b(from|to|into|between)\b/i,
    /\b(english|spanish|french|german|chinese|japanese|korean|arabic)\b.*\b(to|into|from)\b/i,
    /\bconvert.*language\b/i,
    /\b(localize|localization|internationalize)\b/i,
    /\b(interpret|interpretation)\b.*\blanguages?\b/i,
  ],
  general_qa: [], // Default fallback
  classification: [
    /\b(classify|categorize|identify|label|group|sort|organize)\b/i,
    /\b(type|category|class|kind|sort|taxonomy)\s+of\b/i,
    /\bwhich\s+(type|category|class|kind|group)\b/i,
    /\b(taxonomy|ontology|hierarchy|clustering)\b/i,
    /\b(detect|recognize|distinguish)\b.*\b(pattern|type|category)\b/i,
  ],
  general: [], // Most generic fallback
}

const DOMAIN_PATTERNS: Record<Domain, RegExp[]> = {
  academic: [
    /\b(research|study|thesis|dissertation|paper|journal)\b/i,
    /\b(professor|student|university|college|academic)\b/i,
    /\b(hypothesis|methodology|literature\s+review)\b/i,
  ],
  business: [
    /\b(business|company|corporate|enterprise|startup)\b/i,
    /\b(revenue|profit|market|strategy|customer|client)\b/i,
    /\b(roi|kpi|b2b|b2c|saas)\b/i,
  ],
  technical: [
    /\b(technical|engineering|software|hardware|system)\b/i,
    /\b(api|database|server|cloud|devops|infrastructure)\b/i,
    /\b(architecture|scalability|performance|security)\b/i,
  ],
  creative: [
    /\b(creative|artistic|design|aesthetic|imaginative)\b/i,
    /\b(art|music|film|literature|poetry)\b/i,
    /\b(inspiration|expression|creativity)\b/i,
  ],
  general: [], // Default fallback
}

const COMPLEXITY_INDICATORS = {
  high: [
    /\b(complex|complicated|advanced|sophisticated|intricate)\b/i,
    /\b(multi-?step|multiple\s+parts?|several\s+components?)\b/i,
    /\b(analyze\s+and\s+synthesize|compare\s+and\s+contrast)\b/i,
    /\b(comprehensive|exhaustive|detailed\s+analysis)\b/i,
  ],
  medium: [
    /\b(explain|describe|discuss|elaborate)\b/i,
    /\b(pros?\s+and\s+cons?|advantages?\s+and\s+disadvantages?)\b/i,
    /\b(how\s+does?.*work|what\s+are\s+the\s+differences?)\b/i,
  ],
  low: [
    /\b(what\s+is|define|list|name|identify)\b/i,
    /\b(yes\s+or\s+no|true\s+or\s+false)\b/i,
    /\b(simple|basic|straightforward|easy)\b/i,
  ],
}

const SAFETY_RISK_PATTERNS = [
  /\b(hack|exploit|vulnerability|injection|malware)\b/i,
  /\b(illegal|illicit|prohibited|banned)\b/i,
  /\b(harm|hurt|damage|destroy|kill)\b/i,
  /\b(personal\s+information|private\s+data|credentials|password)\b/i,
  /\b(discriminate|bias|hate|offensive)\b/i,
]

// ============= Classifier Implementation =============

export class TaskRiskClassifier {
  async classify(prompt: string): Promise<TaskClassification> {
    const startTime = Date.now()

    try {
      // Detect task type with cognitive profiling
      const taskType = this.detectTaskType(prompt)

      // Analyze cognitive requirements
      const cognitiveProfile = this.analyzeCognitiveProfile(prompt, taskType)

      // Detect domain
      const domain = this.detectDomain(prompt)

      // Calculate complexity with enhanced metrics
      const complexity = this.calculateComplexity(prompt, cognitiveProfile)

      // Assess safety risk
      const safetyRisk = this.assessSafetyRisk(prompt)

      // Determine if retrieval is needed
      const needsRetrieval = this.needsRetrieval(prompt, taskType)

      // Suggest techniques based on cognitive profile
      const suggestedTechniques = this.suggestTechniques(
        taskType,
        complexity,
        needsRetrieval,
        cognitiveProfile,
      )

      const classification: TaskClassification = {
        task_type: taskType,
        domain,
        complexity,
        safety_risk: safetyRisk,
        needs_retrieval: needsRetrieval,
        suggested_techniques: suggestedTechniques,
      }

      const latency = Date.now() - startTime
      logger.info(`Classified prompt in ${latency}ms`, { classification, cognitiveProfile })

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

  private calculateComplexity(prompt: string, cognitiveProfile: string): number {
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

    // Adjust based on cognitive profile
    const profileComplexity: Record<string, number> = {
      'full-spectrum-cognitive': 0.9,
      'analytical-synthetic': 0.8,
      'creative-abstract': 0.75,
      'critical-analytical': 0.7,
      'generative-creative': 0.65,
      'analytical-exploratory': 0.6,
      'task-focused': 0.5,
    }

    const profileScore = profileComplexity[cognitiveProfile] || 0.5
    complexityScore = (complexityScore + profileScore) / 2

    // Adjust based on prompt length
    const wordCount = prompt.split(/\s+/).length
    if (wordCount > 100) {
      complexityScore += 0.1
    } else if (wordCount < 20) {
      complexityScore -= 0.1
    }

    // Check for multi-step or conditional logic
    if (/\b(then|after|before|first|second|finally|step)\b/i.test(lowerPrompt)) {
      complexityScore += 0.1
    }

    // Check for abstract concepts
    if (/\b(concept|theory|principle|philosophy|abstract)\b/i.test(lowerPrompt)) {
      complexityScore += 0.05
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
      /\b(cite|reference|source|evidence)\b/i,
    ]

    // Some task types are more likely to need retrieval
    if (['data_analysis', 'summarization'].includes(taskType)) {
      return true
    }

    // Check for explicit retrieval indicators
    const lowerPrompt = prompt.toLowerCase()
    return retrievalIndicators.some((pattern) => pattern.test(lowerPrompt))
  }

  private analyzeCognitiveProfile(prompt: string, taskType: TaskType): string {
    const lowerPrompt = prompt.toLowerCase()

    // Analyze thinking patterns required
    const requiresAnalysis = /\b(analyze|examine|investigate|explore|understand|explain)\b/i.test(
      lowerPrompt,
    )
    const requiresSynthesis = /\b(create|generate|design|build|compose|combine)\b/i.test(
      lowerPrompt,
    )
    const requiresEvaluation = /\b(evaluate|assess|judge|compare|critique|review)\b/i.test(
      lowerPrompt,
    )
    const requiresAbstraction = /\b(conceptualize|abstract|generalize|theorize|model)\b/i.test(
      lowerPrompt,
    )

    // Determine cognitive profile
    if (requiresAnalysis && requiresSynthesis && requiresEvaluation) {
      return 'full-spectrum-cognitive'
    } else if (requiresAnalysis && requiresSynthesis) {
      return 'analytical-synthetic'
    } else if (requiresSynthesis && requiresAbstraction) {
      return 'creative-abstract'
    } else if (requiresAnalysis && requiresEvaluation) {
      return 'critical-analytical'
    } else if (requiresSynthesis) {
      return 'generative-creative'
    } else if (requiresAnalysis) {
      return 'analytical-exploratory'
    } else {
      return 'task-focused'
    }
  }

  private suggestTechniques(
    taskType: TaskType,
    complexity: number,
    needsRetrieval: boolean,
    cognitiveProfile: string,
  ): string[] {
    const techniques: string[] = []

    // Meta-prompt cognitive technique mapping
    const cognitiveMapping: Record<string, string[]> = {
      'full-spectrum-cognitive': [
        TECHNIQUES.TREE_OF_THOUGHT,
        TECHNIQUES.SELF_CONSISTENCY,
        TECHNIQUES.DSPY_GRIPS,
      ],
      'analytical-synthetic': [TECHNIQUES.FEW_SHOT_COT, TECHNIQUES.AUTO_DICOT, TECHNIQUES.REACT],
      'creative-abstract': [
        TECHNIQUES.TREE_OF_THOUGHT,
        TECHNIQUES.UNIVERSAL_SELF_PROMPT,
        TECHNIQUES.DSPY_APE,
      ],
      'critical-analytical': [
        TECHNIQUES.SELF_CONSISTENCY,
        TECHNIQUES.FEW_SHOT_COT,
        TECHNIQUES.AUTO_DICOT,
      ],
      'generative-creative': [TECHNIQUES.TREE_OF_THOUGHT, TECHNIQUES.UNIVERSAL_SELF_PROMPT],
      'analytical-exploratory': [TECHNIQUES.FEW_SHOT_COT, TECHNIQUES.REACT],
      'task-focused': [TECHNIQUES.FEW_SHOT_COT],
    }

    // Apply cognitive profile techniques
    const profileTechniques = cognitiveMapping[cognitiveProfile] || []
    techniques.push(...profileTechniques)

    // Enhanced task-specific techniques
    switch (taskType) {
      case 'math_reasoning':
        if (!techniques.includes(TECHNIQUES.SELF_CONSISTENCY)) {
          techniques.push(TECHNIQUES.SELF_CONSISTENCY)
        }
        if (complexity > 0.7 && !techniques.includes(TECHNIQUES.TREE_OF_THOUGHT)) {
          techniques.push(TECHNIQUES.TREE_OF_THOUGHT)
        }
        break

      case 'code_generation':
        if (!techniques.includes(TECHNIQUES.REACT)) {
          techniques.push(TECHNIQUES.REACT)
        }
        if (complexity > 0.6 && !techniques.includes(TECHNIQUES.DSPY_APE)) {
          techniques.push(TECHNIQUES.DSPY_APE)
        }
        break

      case 'creative_writing':
        if (!techniques.includes(TECHNIQUES.TREE_OF_THOUGHT)) {
          techniques.push(TECHNIQUES.TREE_OF_THOUGHT)
        }
        if (!techniques.includes(TECHNIQUES.UNIVERSAL_SELF_PROMPT)) {
          techniques.push(TECHNIQUES.UNIVERSAL_SELF_PROMPT)
        }
        break

      case 'data_analysis':
        if (!techniques.includes(TECHNIQUES.AUTO_DICOT)) {
          techniques.push(TECHNIQUES.AUTO_DICOT)
        }
        if (complexity > 0.7 && !techniques.includes(TECHNIQUES.DSPY_GRIPS)) {
          techniques.push(TECHNIQUES.DSPY_GRIPS)
        }
        break
    }

    // Add retrieval-based technique if needed
    if (needsRetrieval && !techniques.includes(TECHNIQUES.IRCOT)) {
      techniques.push(TECHNIQUES.IRCOT)
    }

    // Add advanced techniques for high complexity
    if (complexity > 0.85 && !techniques.includes(TECHNIQUES.DSPY_GRIPS)) {
      techniques.push(TECHNIQUES.DSPY_GRIPS)
    }

    // Remove duplicates and limit techniques
    return [...new Set(techniques)].slice(0, 5)
  }
}

// ============= Service API =============

export async function handleClassifyRequest(
  request: ServiceRequest<{ prompt: string }>,
): Promise<ServiceResponse<TaskClassification>> {
  const classifier = new TaskRiskClassifier()

  try {
    const classification = await classifier.classify(request.payload.prompt)
    return createServiceResponse(request, classification)
  } catch (error) {
    logger.error('Classification failed', error as Error)
    const serviceError = createServiceError(
      ERROR_CODES.INTERNAL_ERROR,
      'Classification failed',
      true,
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

// ============= Standalone Service =============

if (require.main === module) {
  const express = require('express')
  const app = express()
  const PORT = process.env.PORT || 3001

  // Error handling middleware
  const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }

  const errorHandler = (err: any, req: any, res: any, next: any) => {
    logger.error('Request failed', err, {
      path: req.path,
      method: req.method,
      body: req.body,
    })
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        retryable: true,
      },
    })
  }

  app.use(express.json({ limit: '10mb' }))

  app.post('/classify', asyncHandler(async (req: any, res: any) => {
    if (!req.body || !req.body.payload || !req.body.payload.prompt) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required field: payload.prompt',
          retryable: false,
        },
      })
    }

    const response = await handleClassifyRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  }))

  app.get('/health', asyncHandler(async (_req: any, res: any) => {
    res.json({ status: 'healthy', service: 'classifier', timestamp: new Date().toISOString() })
  }))

  // Apply error handling middleware
  app.use(errorHandler)

  app.listen(PORT, () => {
    logger.info(`Classifier service running on port ${PORT}`)
  })
}
