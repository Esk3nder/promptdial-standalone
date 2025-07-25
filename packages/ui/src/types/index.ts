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

// Model options grouped by provider (cheapest models first as defaults)
export const MODEL_OPTIONS_BY_PROVIDER = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', cost: 0.00015, isDefault: true },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', cost: 0.0005, isDefault: false },
    { value: 'gpt-4o', label: 'GPT-4o', cost: 0.005, isDefault: false },
    { value: 'gpt-4', label: 'GPT-4', cost: 0.01, isDefault: false },
  ],
  anthropic: [
    { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', cost: 0.003, isDefault: true },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', cost: 0.003, isDefault: false },
    { value: 'claude-3-opus', label: 'Claude 3 Opus', cost: 0.015, isDefault: false },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', cost: 0.0001, isDefault: true },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', cost: 0.00125, isDefault: false },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', cost: 0.00125, isDefault: false },
    { value: 'gemini-pro', label: 'Gemini Pro', cost: 0.00125, isDefault: false },
  ],
} as const

// Flat model options for backward compatibility
export const MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o Mini (Default)' },
  { value: 'gpt-3.5-turbo', label: 'OpenAI GPT-3.5 Turbo' },
  { value: 'gpt-4o', label: 'OpenAI GPT-4o' },
  { value: 'gpt-4', label: 'OpenAI GPT-4' },
  { value: 'claude-3.5-sonnet', label: 'Anthropic Claude 3.5 Sonnet (Default)' },
  { value: 'claude-sonnet-4', label: 'Anthropic Claude Sonnet 4' },
  { value: 'claude-3-opus', label: 'Anthropic Claude 3 Opus' },
  { value: 'gemini-2.0-flash', label: 'Google Gemini 2.0 Flash (Default)' },
  { value: 'gemini-1.5-flash', label: 'Google Gemini 1.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Google Gemini 2.5 Pro' },
  { value: 'gemini-pro', label: 'Google Gemini Pro' },
] as const

// Provider display names
export const PROVIDER_NAMES = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
} as const

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
