import { describe, it, expect } from 'vitest'
import { fixToolUseResults, validateToolUseResults, ClaudeMessage } from '../src/claude-tools'

describe('Claude Tools Utilities', () => {
  describe('validateToolUseResults', () => {
    it('should pass validation for properly paired tool_use/tool_result', () => {
      const messages: ClaudeMessage[] = [
        { role: 'user', content: 'What is the weather?' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me check the weather.' },
            { type: 'tool_use', id: 'tool_123', name: 'get_weather', input: { location: 'NYC' } }
          ]
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tool_123', content: '72F and sunny' }
          ]
        }
      ]

      const errors = validateToolUseResults(messages)
      expect(errors).toHaveLength(0)
    })

    it('should detect missing tool_result', () => {
      const messages: ClaudeMessage[] = [
        { role: 'user', content: 'What is the weather?' },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool_123', name: 'get_weather', input: { location: 'NYC' } }
          ]
        },
        { role: 'user', content: 'Tell me more' } // Missing tool_result
      ]

      const errors = validateToolUseResults(messages)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('content array')
    })
  })

  describe('fixToolUseResults', () => {
    it('should add missing tool_result blocks', () => {
      const messages: ClaudeMessage[] = [
        { role: 'user', content: 'What is the weather?' },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool_123', name: 'get_weather', input: { location: 'NYC' } }
          ]
        },
        { role: 'user', content: 'Tell me more' }
      ]

      const fixed = fixToolUseResults(messages)
      expect(fixed).toHaveLength(4) // Original 3 + 1 added tool_result message
      
      const toolResultMessage = fixed[2]
      expect(toolResultMessage.role).toBe('user')
      expect(Array.isArray(toolResultMessage.content)).toBe(true)
      if (Array.isArray(toolResultMessage.content)) {
        expect(toolResultMessage.content[0].type).toBe('tool_result')
        expect(toolResultMessage.content[0].tool_use_id).toBe('tool_123')
      }
    })

    it('should not modify already valid messages', () => {
      const messages: ClaudeMessage[] = [
        { role: 'user', content: 'What is the weather?' },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool_123', name: 'get_weather', input: { location: 'NYC' } }
          ]
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tool_123', content: '72F and sunny' }
          ]
        }
      ]

      const fixed = fixToolUseResults(messages)
      expect(fixed).toHaveLength(3) // No changes needed
      expect(fixed).toEqual(messages)
    })

    it('should handle multiple tool_use blocks', () => {
      const messages: ClaudeMessage[] = [
        { role: 'user', content: 'What is the weather and time?' },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool_123', name: 'get_weather', input: { location: 'NYC' } },
            { type: 'tool_use', id: 'tool_456', name: 'get_time', input: { timezone: 'EST' } }
          ]
        }
      ]

      const fixed = fixToolUseResults(messages)
      expect(fixed).toHaveLength(3) // Original 2 + 1 tool_result message
      
      const toolResultMessage = fixed[2]
      if (Array.isArray(toolResultMessage.content)) {
        expect(toolResultMessage.content).toHaveLength(2)
        expect(toolResultMessage.content[0].tool_use_id).toBe('tool_123')
        expect(toolResultMessage.content[1].tool_use_id).toBe('tool_456')
      }
    })
  })
})