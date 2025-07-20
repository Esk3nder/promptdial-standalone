/**
 * PromptDial 2.0 - Evaluator Registry
 */

export { BaseEvaluator } from './base'
export { GEvalEvaluator } from './g-eval'
export { ChatEvalEvaluator } from './chat-eval'
export { RoleDebateEvaluator } from './role-debate'
export { SelfConsistencyEvaluator } from './self-consistency-eval'

import { BaseEvaluator } from './base'
import { GEvalEvaluator } from './g-eval'
import { ChatEvalEvaluator } from './chat-eval'
import { RoleDebateEvaluator } from './role-debate'
import { SelfConsistencyEvaluator } from './self-consistency-eval'

export const ALL_EVALUATORS = [
  GEvalEvaluator,
  ChatEvalEvaluator,
  RoleDebateEvaluator,
  SelfConsistencyEvaluator
]

export function createEvaluatorRegistry(): Map<string, BaseEvaluator> {
  const registry = new Map<string, BaseEvaluator>()
  
  for (const EvaluatorClass of ALL_EVALUATORS) {
    const evaluator = new EvaluatorClass()
    registry.set(evaluator.getName(), evaluator)
  }
  
  return registry
}