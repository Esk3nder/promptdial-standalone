/**
 * PromptDial 2.0 - Technique Registry
 *
 * Central export and registration of all optimization techniques
 */

export { BaseTechnique } from './base'
export { FewShotCoTTechnique } from './few-shot-cot'
export { SelfConsistencyTechnique, SELF_CONSISTENCY_VOTE_PROMPT } from './self-consistency'
export { ReActTechnique } from './react'
export { TreeOfThoughtTechnique } from './tree-of-thought'
export { IRCoTTechnique, IRCOT_RETRIEVAL_INSTRUCTION } from './ircot'
export { DSPyAPETechnique } from './dspy-ape'

// Re-export all techniques as a collection
import { FewShotCoTTechnique } from './few-shot-cot'
import { SelfConsistencyTechnique } from './self-consistency'
import { ReActTechnique } from './react'
import { TreeOfThoughtTechnique } from './tree-of-thought'
import { IRCoTTechnique } from './ircot'
import { DSPyAPETechnique } from './dspy-ape'

export const ALL_TECHNIQUES = [
  FewShotCoTTechnique,
  SelfConsistencyTechnique,
  ReActTechnique,
  TreeOfThoughtTechnique,
  IRCoTTechnique,
  DSPyAPETechnique,
]

export const TECHNIQUE_REGISTRY = new Map(
  ALL_TECHNIQUES.map((TechniqueClass) => {
    const instance = new TechniqueClass()
    return [instance.name, TechniqueClass]
  }),
)
