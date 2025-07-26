export type ServiceName =
  | 'api-gateway'
  | 'classifier'
  | 'telemetry'
  | 'technique-engine'
  | 'retrieval-hub'
  | 'evaluator'
  | 'safety-guard'
  | 'optimizer'
  | 'llm-runner'

export type EventType =
  | 'test_started'
  | 'service_request'
  | 'service_response'
  | 'optimization_started'
  | 'optimization_completed'
  | 'technique_selected'
  | 'variant_generated'
  | 'provider_test_started'
  | 'provider_test_completed'
  | 'evaluation_started'
  | 'evaluation_completed'
  | 'safety_check_started'
  | 'safety_check_completed'
  | 'test_completed'
  | 'error'
  | 'final_results'

export interface BaseEvent {
  type: EventType
  timestamp: Date
  testId: string
}

export interface TestStartedEvent extends BaseEvent {
  type: 'test_started'
  prompt: string
  targetModel: string
  optimizationLevel: string
}

export interface ServiceRequestEvent extends BaseEvent {
  type: 'service_request'
  service: ServiceName
  method: string
  requestData: any
}

export interface ServiceResponseEvent extends BaseEvent {
  type: 'service_response'
  service: ServiceName
  method: string
  responseData: any
  responseTime: number
  statusCode?: number
}

export interface TechniqueSelectedEvent extends BaseEvent {
  type: 'technique_selected'
  techniques: string[]
  taskType: string
  reasoning?: string
}

export interface VariantGeneratedEvent extends BaseEvent {
  type: 'variant_generated'
  variantId: string
  techniques: string[]
  quality: number
  optimizedPrompt: string
}

export interface OptimizationStartedEvent extends BaseEvent {
  type: 'optimization_started'
}

export interface OptimizationCompletedEvent extends BaseEvent {
  type: 'optimization_completed'
  variantCount: number
  totalTime: number
}

export interface ProviderTestStartedEvent extends BaseEvent {
  type: 'provider_test_started'
  provider: string
  variant: string | number
}

export interface ProviderTestCompletedEvent extends BaseEvent {
  type: 'provider_test_completed'
  provider: string
  variant: string | number
  result: {
    responseTime: number
    tokenCount: number
    error?: string
  }
}

export interface EvaluationStartedEvent extends BaseEvent {
  type: 'evaluation_started'
  variantId: string
  evaluationMethods: string[]
}

export interface EvaluationCompletedEvent extends BaseEvent {
  type: 'evaluation_completed'
  variantId: string
  scores: {
    clarity: number
    specificity: number
    coherence: number
    overall: number
  }
}

export interface SafetyCheckStartedEvent extends BaseEvent {
  type: 'safety_check_started'
  variantId: string
}

export interface SafetyCheckCompletedEvent extends BaseEvent {
  type: 'safety_check_completed'
  variantId: string
  passed: boolean
  issues?: string[]
}

export interface TestCompletedEvent extends BaseEvent {
  type: 'test_completed'
  duration: number
}

export interface ErrorEvent extends BaseEvent {
  type: 'error'
  error: string
  service?: ServiceName
}

export interface FinalResultsEvent extends BaseEvent {
  type: 'final_results'
  results: any
}

export type PerformanceTestEvent =
  | TestStartedEvent
  | ServiceRequestEvent
  | ServiceResponseEvent
  | TechniqueSelectedEvent
  | VariantGeneratedEvent
  | OptimizationStartedEvent
  | OptimizationCompletedEvent
  | ProviderTestStartedEvent
  | ProviderTestCompletedEvent
  | EvaluationStartedEvent
  | EvaluationCompletedEvent
  | SafetyCheckStartedEvent
  | SafetyCheckCompletedEvent
  | TestCompletedEvent
  | ErrorEvent
  | FinalResultsEvent
