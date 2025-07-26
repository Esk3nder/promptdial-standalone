/**
 * Safe Anthropic Provider with automatic tool_use/tool_result fixing
 */

import { AnthropicProvider } from './anthropic'
import { PromptVariant, LLMProviderConfig } from '@promptdial/shared'
import { fixToolUseResults, validateToolUseResults, ClaudeMessage } from '@promptdial/shared'
import { LLMResponse, StreamingCallback } from './base'

export class SafeAnthropicProvider extends AnthropicProvider {
  constructor(config: LLMProviderConfig) {
    super(config)
  }

  async call(
    variant: PromptVariant,
    streaming: boolean = false,
    callback?: StreamingCallback,
  ): Promise<LLMResponse> {
    // If the variant prompt contains structured messages, fix them
    if (this.isStructuredPrompt(variant.prompt)) {
      const fixed = this.fixPromptMessages(variant.prompt)
      variant = { ...variant, prompt: fixed }
    }

    return super.call(variant, streaming, callback)
  }

  private isStructuredPrompt(prompt: string): boolean {
    try {
      const parsed = JSON.parse(prompt)
      return Array.isArray(parsed) && parsed.some(m => m.role && m.content)
    } catch {
      return false
    }
  }

  private fixPromptMessages(prompt: string): string {
    try {
      const messages = JSON.parse(prompt) as ClaudeMessage[]
      
      // Validate first
      const errors = validateToolUseResults(messages)
      if (errors.length > 0) {
        this.logger.warn('Tool use validation errors:', errors)
        
        // Fix the messages
        const fixed = fixToolUseResults(messages)
        return JSON.stringify(fixed)
      }
      
      return prompt
    } catch (error) {
      this.logger.error('Failed to fix prompt messages:', error)
      return prompt
    }
  }
}