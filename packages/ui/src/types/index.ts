// Re-export types from PromptDial for convenience
export type {
  OptimizationRequest,
  OptimizedVariant,
  OptimizedResult,
  ValidationResult,
  QualityFactors,
  PromptDialOptions,
} from './promptdial'

// UI-specific types
export interface UIConfig {
  model: string
  level: 'basic' | 'advanced' | 'expert'
  taskType?: 'creative' | 'analytical' | 'coding' | 'general'
}

export interface CopyState {
  [variantId: string]: boolean
}

// Model options
export const MODEL_OPTIONS = [
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'gemini-pro', label: 'Gemini Pro' },
] as const

export const LEVEL_OPTIONS = [
  { value: 'basic', label: 'Basic' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
] as const

export const TASK_TYPE_OPTIONS = [
  { value: undefined, label: 'Auto-detect' },
  { value: 'creative', label: 'Creative' },
  { value: 'analytical', label: 'Analytical' },
  { value: 'coding', label: 'Coding' },
  { value: 'general', label: 'General' },
] as const
