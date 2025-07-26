import { z } from 'zod';

// Input contract
export interface StrategyPlannerRequest {
  prompt: string;
  context?: {
    taskType?: string;
    modelName?: string;
    optimizationLevel?: 'cheap' | 'normal' | 'explore';
    metadata?: Record<string, unknown>;
  };
}

// Technique categories from spec
export enum TechniqueCategory {
  REASONING_PATHS = 'reasoning_paths',
  VARIANCE_DAMPERS = 'variance_dampers',
  META_OPTIMIZERS = 'meta_optimizers',
  CRITIQUE_LOOPS = 'critique_loops',
  GUARD_HELPERS = 'guard_helpers'
}

// Allowed techniques (2025-Q3 allow-list)
export enum Technique {
  // Reasoning paths
  CHAIN_OF_THOUGHT = 'chain_of_thought',
  TREE_OF_THOUGHT = 'tree_of_thought',
  LEAST_TO_MOST = 'least_to_most',
  
  // Variance dampers
  SELF_CONSISTENCY = 'self_consistency',
  UNIVERSAL_SELF_CONSISTENCY = 'universal_self_consistency',
  
  // Meta optimizers
  DSPY_BOOTSTRAP_FEWSHOT = 'dspy_bootstrap_fewshot',
  GRIPS = 'grips',
  
  // Critique loops
  SELF_REFINE = 'self_refine',
  SELF_CALIBRATION = 'self_calibration',
  
  // Guard helpers
  SYCOPHANCY_FILTER = 'sycophancy_filter',
  JAILBREAK_REGEX_BANK = 'jailbreak_regex_bank'
}

// Output contract
export interface StrategyPlannerResponse {
  suggested_techniques: Technique[];
  rationale: string;
  confidence: number; // [0,1]
  metadata?: {
    processingTimeMs: number;
    modelUsed?: string;
    failedValidations?: string[];
  };
}

// Technique metadata
export interface TechniqueMetadata {
  name: Technique;
  category: TechniqueCategory;
  description: string;
  rationale: string;
  applicableTo: string[];
  incompatibleWith?: Technique[];
}

// Allow-list configuration
export const TECHNIQUE_ALLOW_LIST: Record<Technique, TechniqueMetadata> = {
  [Technique.CHAIN_OF_THOUGHT]: {
    name: Technique.CHAIN_OF_THOUGHT,
    category: TechniqueCategory.REASONING_PATHS,
    description: 'Step-by-step reasoning decomposition',
    rationale: 'Still top-2 cited for accuracy uplift',
    applicableTo: ['reasoning', 'math', 'logic', 'analysis']
  },
  [Technique.TREE_OF_THOUGHT]: {
    name: Technique.TREE_OF_THOUGHT,
    category: TechniqueCategory.REASONING_PATHS,
    description: 'Branching exploration of solution paths',
    rationale: 'Still top-2 cited for accuracy uplift',
    applicableTo: ['complex_reasoning', 'planning', 'strategy']
  },
  [Technique.LEAST_TO_MOST]: {
    name: Technique.LEAST_TO_MOST,
    category: TechniqueCategory.REASONING_PATHS,
    description: 'Build up from simple to complex',
    rationale: 'Still top-2 cited for accuracy uplift',
    applicableTo: ['math', 'decomposable_tasks']
  },
  [Technique.SELF_CONSISTENCY]: {
    name: Technique.SELF_CONSISTENCY,
    category: TechniqueCategory.VARIANCE_DAMPERS,
    description: 'Multiple sampling with majority vote',
    rationale: 'Majority-vote beats single-path; handles free-form tasks',
    applicableTo: ['reasoning', 'creative', 'open_ended']
  },
  [Technique.UNIVERSAL_SELF_CONSISTENCY]: {
    name: Technique.UNIVERSAL_SELF_CONSISTENCY,
    category: TechniqueCategory.VARIANCE_DAMPERS,
    description: 'Self-consistency across formats',
    rationale: 'Majority-vote beats single-path; handles free-form tasks',
    applicableTo: ['diverse_outputs', 'multi_format']
  },
  [Technique.DSPY_BOOTSTRAP_FEWSHOT]: {
    name: Technique.DSPY_BOOTSTRAP_FEWSHOT,
    category: TechniqueCategory.META_OPTIMIZERS,
    description: 'Automated few-shot example generation',
    rationale: 'Auto-search greatly outperforms hand tuning in case studies',
    applicableTo: ['tasks_with_examples', 'classification', 'extraction']
  },
  [Technique.GRIPS]: {
    name: Technique.GRIPS,
    category: TechniqueCategory.META_OPTIMIZERS,
    description: 'Gradient-free prompt search',
    rationale: 'Auto-search greatly outperforms hand tuning in case studies',
    applicableTo: ['optimization', 'tuning']
  },
  [Technique.SELF_REFINE]: {
    name: Technique.SELF_REFINE,
    category: TechniqueCategory.CRITIQUE_LOOPS,
    description: 'Iterative self-improvement',
    rationale: 'Proven gain on reasoning & coding tasks',
    applicableTo: ['coding', 'writing', 'reasoning']
  },
  [Technique.SELF_CALIBRATION]: {
    name: Technique.SELF_CALIBRATION,
    category: TechniqueCategory.CRITIQUE_LOOPS,
    description: 'Confidence adjustment through reflection',
    rationale: 'Proven gain on reasoning & coding tasks',
    applicableTo: ['uncertainty_aware', 'calibrated_outputs']
  },
  [Technique.SYCOPHANCY_FILTER]: {
    name: Technique.SYCOPHANCY_FILTER,
    category: TechniqueCategory.GUARD_HELPERS,
    description: 'Prevent agreement bias',
    rationale: 'Must run pre & post every LLM call',
    applicableTo: ['all'],
    incompatibleWith: []
  },
  [Technique.JAILBREAK_REGEX_BANK]: {
    name: Technique.JAILBREAK_REGEX_BANK,
    category: TechniqueCategory.GUARD_HELPERS,
    description: 'Pattern matching for known exploits',
    rationale: 'Must run pre & post every LLM call',
    applicableTo: ['all'],
    incompatibleWith: []
  }
};

// Validation schema
export const StrategyPlannerResponseSchema = z.object({
  suggested_techniques: z.array(z.nativeEnum(Technique)).max(3),
  rationale: z.string().min(10).max(500),
  confidence: z.number().min(0).max(1),
  metadata: z.object({
    processingTimeMs: z.number(),
    modelUsed: z.string().optional(),
    failedValidations: z.array(z.string()).optional()
  }).optional()
});

// Error types
export class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PlannerError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'PlannerError';
  }
}