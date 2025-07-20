import { EventEmitter } from 'events'
import type { TestResult, ModelProvider } from './types'

export interface TestEvent {
  timestamp: Date
  testId: string
}

export interface TestStartedEvent extends TestEvent {
  type: 'test_started'
  prompt: string
  targetModel: string
  optimizationLevel: string
}

export interface ProviderTestStartedEvent extends TestEvent {
  type: 'provider_test_started'
  provider: ModelProvider
  variant: 'original' | number
}

export interface ProviderTestCompletedEvent extends TestEvent {
  type: 'provider_test_completed'
  provider: ModelProvider
  variant: 'original' | number
  result: TestResult
}

export interface OptimizationStartedEvent extends TestEvent {
  type: 'optimization_started'
}

export interface OptimizationCompletedEvent extends TestEvent {
  type: 'optimization_completed'
  variantCount: number
}

export interface TestCompletedEvent extends TestEvent {
  type: 'test_completed'
  summary: {
    bestVariantIndex: number
    averageImprovement: {
      responseTime: number
      tokenCount: number
    }
  }
}

export interface TestErrorEvent extends TestEvent {
  type: 'test_error'
  error: string
}

export type PerformanceTestEvent = 
  | TestStartedEvent
  | ProviderTestStartedEvent
  | ProviderTestCompletedEvent
  | OptimizationStartedEvent
  | OptimizationCompletedEvent
  | TestCompletedEvent
  | TestErrorEvent

export class TestEventEmitter extends EventEmitter {
  emit(event: PerformanceTestEvent['type'], data: PerformanceTestEvent): boolean {
    return super.emit(event, data)
  }

  on(event: PerformanceTestEvent['type'], listener: (data: PerformanceTestEvent) => void): this {
    return super.on(event, listener)
  }
}