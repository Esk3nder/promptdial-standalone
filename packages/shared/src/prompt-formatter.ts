/**
 * PromptDial 3.0 - Prompt Formatter
 * 
 * Formats prompts with proper markdown structure and technique identification
 */

import { PromptVariant } from './types'

export interface FormattedPrompt {
  markdown: string
  sections: {
    technique: string
    description: string
    transformations: string[]
    prompt: string
    metadata?: Record<string, any>
  }
}

/**
 * Technique metadata for formatting
 */
const TECHNIQUE_INFO: Record<string, { name: string; description: string; category: string }> = {
  // Zero-Shot Techniques
  'zero_shot': {
    name: 'Zero-Shot',
    description: 'Direct prompting without examples',
    category: 'Zero-Shot'
  },
  'instruction': {
    name: 'Instruction Following',
    description: 'Clear step-by-step instructions',
    category: 'Zero-Shot'
  },
  'role_prompting': {
    name: 'Role Prompting',
    description: 'Assigning a specific role or persona',
    category: 'Zero-Shot'
  },
  'style_prompting': {
    name: 'Style Prompting',
    description: 'Specifying output style and format',
    category: 'Zero-Shot'
  },
  
  // Few-Shot Techniques
  'few_shot': {
    name: 'Few-Shot Learning',
    description: 'Learning from a few examples',
    category: 'Few-Shot'
  },
  'few_shot_cot': {
    name: 'Few-Shot Chain-of-Thought',
    description: 'Examples with step-by-step reasoning',
    category: 'Few-Shot'
  },
  'few_shot_cot_basic': {
    name: 'Few-Shot CoT (Basic)',
    description: 'Basic few-shot learning with reasoning steps',
    category: 'Few-Shot'
  },
  'few_shot_cot_extended': {
    name: 'Few-Shot CoT (Extended)',
    description: 'Extended examples with detailed reasoning',
    category: 'Few-Shot'
  },
  'few_shot_cot_formatted': {
    name: 'Few-Shot CoT (Formatted)',
    description: 'Structured format with clear sections',
    category: 'Few-Shot'
  },
  
  // Thought Generation Techniques
  'chain_of_thought': {
    name: 'Chain-of-Thought (CoT)',
    description: 'Step-by-step reasoning process',
    category: 'Thought Generation'
  },
  'zero_shot_cot': {
    name: 'Zero-Shot Chain-of-Thought',
    description: '"Let\'s think step by step" prompting',
    category: 'Thought Generation'
  },
  'tree_of_thought': {
    name: 'Tree of Thoughts (ToT)',
    description: 'Exploring multiple reasoning paths',
    category: 'Thought Generation'
  },
  'thread_of_thought': {
    name: 'Thread of Thought (ThoT)',
    description: 'Linear progression of thoughts',
    category: 'Thought Generation'
  },
  'active_prompt': {
    name: 'Active Prompting',
    description: 'Interactive refinement based on uncertainty',
    category: 'Thought Generation'
  },
  
  // Decomposition Techniques
  'decomposition': {
    name: 'Task Decomposition',
    description: 'Breaking down complex tasks',
    category: 'Decomposition'
  },
  'least_to_most': {
    name: 'Least-to-Most',
    description: 'Solving from simple to complex',
    category: 'Decomposition'
  },
  'plan_and_solve': {
    name: 'Plan-and-Solve',
    description: 'Planning before execution',
    category: 'Decomposition'
  },
  'program_of_thought': {
    name: 'Program of Thought',
    description: 'Programmatic task breakdown',
    category: 'Decomposition'
  },
  
  // Ensembling Techniques
  'self_consistency': {
    name: 'Self-Consistency',
    description: 'Multiple sampling with majority vote',
    category: 'Ensembling'
  },
  'self_consistency_basic': {
    name: 'Self-Consistency (Basic)',
    description: 'Basic multiple path exploration',
    category: 'Ensembling'
  },
  'self_consistency_detailed': {
    name: 'Self-Consistency (Detailed)',
    description: 'Detailed analysis of multiple solutions',
    category: 'Ensembling'
  },
  'self_consistency_structured': {
    name: 'Self-Consistency (Structured)',
    description: 'Structured comparison of approaches',
    category: 'Ensembling'
  },
  'dicy': {
    name: 'DiCy (Diverse Consistency)',
    description: 'Diverse sampling for consistency',
    category: 'Ensembling'
  },
  'cosp': {
    name: 'CoSP (Consistency-based Self-adaptive Prompting)',
    description: 'Adaptive prompting based on consistency',
    category: 'Ensembling'
  },
  
  // Self-Criticism Techniques
  'self_refine': {
    name: 'Self-Refine',
    description: 'Iterative self-improvement',
    category: 'Self-Criticism'
  },
  'self_verification': {
    name: 'Self-Verification',
    description: 'Verifying own outputs',
    category: 'Self-Criticism'
  },
  'cumulative_reason': {
    name: 'Cumulative Reasoning',
    description: 'Building upon previous reasoning',
    category: 'Self-Criticism'
  },
  
  // Agent-Based Techniques
  'react': {
    name: 'ReAct',
    description: 'Reasoning and Acting interleaved',
    category: 'Agents'
  },
  'react_basic': {
    name: 'ReAct (Basic)',
    description: 'Basic thought-action-observation loop',
    category: 'Agents'
  },
  'react_detailed': {
    name: 'ReAct (Detailed)',
    description: 'Detailed reasoning with actions',
    category: 'Agents'
  },
  'react_structured': {
    name: 'ReAct (Structured)',
    description: 'Structured format for reasoning and actions',
    category: 'Agents'
  },
  
  // Other Techniques
  'ircot': {
    name: 'IRCoT',
    description: 'Interleaved Retrieval Chain-of-Thought',
    category: 'Retrieval-Augmented'
  },
  'ircot_basic': {
    name: 'IRCoT (Basic)',
    description: 'Basic retrieval with reasoning',
    category: 'Retrieval-Augmented'
  },
  'ircot_detailed': {
    name: 'IRCoT (Detailed)',
    description: 'Detailed retrieval and reasoning',
    category: 'Retrieval-Augmented'
  },
  'rag': {
    name: 'RAG (Retrieval-Augmented Generation)',
    description: 'Generation with retrieved context',
    category: 'Retrieval-Augmented'
  },
  
  // Meta-Prompting
  'meta_prompting': {
    name: 'Meta-Prompting',
    description: 'Prompts about prompting',
    category: 'Meta'
  },
  'auto_cot': {
    name: 'Auto-CoT',
    description: 'Automatic Chain-of-Thought generation',
    category: 'Meta'
  },
  'complexity_based': {
    name: 'Complexity-Based',
    description: 'Adaptation based on task complexity',
    category: 'Meta'
  }
}

/**
 * Format a prompt variant with proper markdown structure
 */
export function formatPromptVariant(variant: PromptVariant): FormattedPrompt {
  const techniqueInfo = TECHNIQUE_INFO[variant.technique] || {
    name: variant.technique,
    description: 'Optimization technique',
    category: 'Other'
  }

  // Parse the prompt to identify sections
  const sections = parsePromptSections(variant.prompt)
  
  // Identify transformations applied
  const transformations = identifyTransformations(variant)

  // Build markdown representation
  const markdown = buildMarkdown(variant, techniqueInfo, sections, transformations)

  return {
    markdown,
    sections: {
      technique: techniqueInfo.name,
      description: techniqueInfo.description,
      transformations,
      prompt: variant.prompt,
      metadata: {
        category: techniqueInfo.category,
        temperature: variant.temperature,
        estimated_tokens: variant.est_tokens,
        estimated_cost: variant.cost_usd,
        model: variant.model,
        model_params: variant.model_params
      }
    }
  }
}

/**
 * Parse prompt sections for better formatting
 */
function parsePromptSections(prompt: string): Record<string, string> {
  const sections: Record<string, string> = {}
  
  // Check for system prompt wrapper
  const sysMatch = prompt.match(/<<SYS>>([\s\S]*?)<<USER>>([\s\S]*?)<<END>>/)
  if (sysMatch) {
    sections.system = sysMatch[1].trim()
    sections.user = sysMatch[2].trim()
    return sections
  }

  // Check for example sections
  const exampleMatch = prompt.match(/Here are some examples[\s\S]*?Now[\s\S]*/)
  if (exampleMatch) {
    const exampleSection = prompt.match(/(Here are some examples[\s\S]*?)\n\nNow/)
    const questionSection = prompt.match(/Now[\s\S]*/)
    if (exampleSection) sections.examples = exampleSection[1]
    if (questionSection) sections.question = questionSection[0]
    return sections
  }

  // Check for structured sections
  if (prompt.includes('REASONING:') || prompt.includes('ANSWER:')) {
    sections.structured = prompt
    return sections
  }

  // Check for context section
  if (prompt.startsWith('Context:')) {
    const contextEnd = prompt.indexOf('\n\n')
    sections.context = prompt.substring(0, contextEnd)
    sections.main = prompt.substring(contextEnd + 2)
    return sections
  }

  // Default: treat as single section
  sections.main = prompt
  return sections
}

/**
 * Identify transformations applied to the prompt
 */
function identifyTransformations(variant: PromptVariant): string[] {
  const transformations: string[] = []
  const prompt = variant.prompt.toLowerCase()

  // Check for common transformations
  if (prompt.includes('step by step') || prompt.includes('step-by-step')) {
    transformations.push('Added step-by-step reasoning instruction')
  }

  if (prompt.includes('example') || prompt.match(/q:.*?a:/i)) {
    transformations.push('Included few-shot examples')
  }

  if (prompt.includes('<<sys>>') || prompt.includes('system:')) {
    transformations.push('Added system instruction wrapper')
  }

  if (prompt.includes('please structure') || prompt.includes('format:')) {
    transformations.push('Added output format specification')
  }

  if (prompt.includes('context:')) {
    transformations.push('Added contextual information')
  }

  if (prompt.includes('role:') || prompt.includes('you are')) {
    transformations.push('Applied role prompting')
  }

  if (prompt.includes('think') && prompt.includes('act')) {
    transformations.push('Implemented thought-action loop')
  }

  if (prompt.includes('verify') || prompt.includes('check')) {
    transformations.push('Added self-verification step')
  }

  if (transformations.length === 0) {
    transformations.push('Applied basic optimization')
  }

  return transformations
}

/**
 * Build markdown representation of the prompt
 */
function buildMarkdown(
  variant: PromptVariant,
  techniqueInfo: { name: string; description: string; category: string },
  sections: Record<string, string>,
  transformations: string[]
): string {
  const lines: string[] = []

  // Header with technique name
  lines.push(`# 🎯 ${techniqueInfo.name}`)
  lines.push('')
  lines.push(`**Category:** ${techniqueInfo.category}`)
  lines.push(`**Description:** ${techniqueInfo.description}`)
  lines.push('')

  // Optimization details
  lines.push('## 📊 Optimization Details')
  lines.push('')
  lines.push('### Transformations Applied:')
  transformations.forEach(t => lines.push(`- ${t}`))
  lines.push('')

  // Model parameters
  lines.push('### Model Configuration:')
  lines.push(`- **Temperature:** ${variant.temperature}`)
  lines.push(`- **Estimated Tokens:** ${variant.est_tokens}`)
  lines.push(`- **Estimated Cost:** $${variant.cost_usd.toFixed(4)}`)
  if (variant.model) {
    lines.push(`- **Model:** ${variant.model}`)
  }
  lines.push('')

  // Formatted prompt
  lines.push('## 📝 Optimized Prompt')
  lines.push('')

  // Format based on sections
  if (sections.system && sections.user) {
    lines.push('### System Instructions')
    lines.push('```')
    lines.push(sections.system)
    lines.push('```')
    lines.push('')
    lines.push('### User Prompt')
    lines.push('```')
    lines.push(sections.user)
    lines.push('```')
  } else if (sections.examples && sections.question) {
    lines.push('### Examples Section')
    lines.push('```')
    lines.push(sections.examples)
    lines.push('```')
    lines.push('')
    lines.push('### Your Task')
    lines.push('```')
    lines.push(sections.question)
    lines.push('```')
  } else if (sections.context && sections.main) {
    lines.push('### Context')
    lines.push('```')
    lines.push(sections.context)
    lines.push('```')
    lines.push('')
    lines.push('### Main Prompt')
    lines.push('```')
    lines.push(sections.main)
    lines.push('```')
  } else if (sections.structured) {
    lines.push('### Structured Prompt')
    lines.push('```')
    lines.push(sections.structured)
    lines.push('```')
  } else {
    lines.push('```')
    lines.push(variant.prompt)
    lines.push('```')
  }

  // Technique-specific tips
  lines.push('')
  lines.push('## 💡 Usage Tips')
  lines.push('')
  lines.push(getTechniqueSpecificTips(variant.technique))

  return lines.join('\n')
}

/**
 * Get technique-specific usage tips
 */
function getTechniqueSpecificTips(technique: string): string {
  const tips: Record<string, string> = {
    'few_shot_cot': 'This technique works best for tasks requiring logical reasoning. The examples demonstrate the thinking process, helping the model understand how to approach similar problems.',
    'chain_of_thought': 'Encourage the model to show its work. This technique is particularly effective for math, logic puzzles, and complex analytical tasks.',
    'self_consistency': 'Multiple solutions are generated and compared. This technique improves reliability by finding the most consistent answer across different reasoning paths.',
    'react': 'Combines reasoning with actions. Best for tasks that require interaction with external tools or step-by-step problem solving with feedback.',
    'tree_of_thought': 'Explores multiple solution paths simultaneously. Ideal for creative problem-solving and tasks with multiple valid approaches.',
    'ircot': 'Integrates retrieval with reasoning. Use when the task requires specific factual information that may not be in the model\'s training data.'
  }

  const baseTechnique = technique.split('_').slice(0, -1).join('_') || technique
  return tips[baseTechnique] || tips[technique] || 'This optimization technique enhances the prompt for better model performance.'
}

/**
 * Format multiple variants for comparison
 */
export function formatVariantComparison(variants: PromptVariant[]): string {
  const lines: string[] = []
  
  lines.push('# 🔄 Prompt Optimization Results')
  lines.push('')
  lines.push(`Generated ${variants.length} optimized variants using different techniques:`)
  lines.push('')

  // Summary table
  lines.push('## 📊 Variant Summary')
  lines.push('')
  lines.push('| Technique | Category | Temperature | Est. Tokens | Est. Cost |')
  lines.push('|-----------|----------|-------------|-------------|-----------|')
  
  variants.forEach(variant => {
    const info = TECHNIQUE_INFO[variant.technique] || { name: variant.technique, category: 'Other' }
    lines.push(
      `| ${info.name} | ${info.category} | ${variant.temperature} | ${variant.est_tokens} | $${variant.cost_usd.toFixed(4)} |`
    )
  })
  
  lines.push('')
  lines.push('---')
  lines.push('')

  // Individual variant details
  variants.forEach((variant, index) => {
    if (index > 0) {
      lines.push('')
      lines.push('---')
      lines.push('')
    }
    
    const formatted = formatPromptVariant(variant)
    lines.push(formatted.markdown)
  })

  return lines.join('\n')
}

/**
 * Export formatted prompt to different formats
 */
export function exportFormattedPrompt(
  formatted: FormattedPrompt,
  format: 'markdown' | 'json' | 'yaml' = 'markdown'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(formatted.sections, null, 2)
    
    case 'yaml':
      // Simple YAML representation
      const yaml: string[] = []
      yaml.push(`technique: ${formatted.sections.technique}`)
      yaml.push(`description: ${formatted.sections.description}`)
      yaml.push('transformations:')
      formatted.sections.transformations.forEach(t => yaml.push(`  - ${t}`))
      yaml.push('prompt: |')
      formatted.sections.prompt.split('\n').forEach(line => yaml.push(`  ${line}`))
      if (formatted.sections.metadata) {
        yaml.push('metadata:')
        Object.entries(formatted.sections.metadata).forEach(([key, value]) => {
          yaml.push(`  ${key}: ${JSON.stringify(value)}`)
        })
      }
      return yaml.join('\n')
    
    case 'markdown':
    default:
      return formatted.markdown
  }
}