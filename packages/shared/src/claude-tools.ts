/**
 * Utility for properly handling Claude tool use and tool result pairing
 */

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: any
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | Array<ToolUseBlock | ToolResultBlock | { type: 'text'; text: string }>
}

/**
 * Ensures all tool_use blocks have corresponding tool_result blocks
 * @param messages Array of Claude messages
 * @returns Fixed messages array with proper tool_use/tool_result pairing
 */
export function fixToolUseResults(messages: ClaudeMessage[]): ClaudeMessage[] {
  const fixed: ClaudeMessage[] = []
  const pendingToolUses: Map<string, ToolUseBlock> = new Map()

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    fixed.push(message)

    // Check if message contains tool_use blocks
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_use') {
          pendingToolUses.set(block.id, block)
        }
      }

      // If there are pending tool uses, check if next message has tool results
      if (pendingToolUses.size > 0) {
        const nextMessage = messages[i + 1]
        const hasToolResults =
          nextMessage?.role === 'user' &&
          Array.isArray(nextMessage.content) &&
          nextMessage.content.some((b) => b.type === 'tool_result')

        if (!hasToolResults) {
          // Add missing tool result message
          const toolResults: ToolResultBlock[] = []
          for (const [id, toolUse] of pendingToolUses) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: id,
              content: `Tool ${toolUse.name} executed successfully`,
            })
          }

          fixed.push({
            role: 'user',
            content: toolResults,
          })

          pendingToolUses.clear()
        }
      }
    }

    // Clear pending tool uses if we see tool results
    if (message.role === 'user' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_result' && pendingToolUses.has(block.tool_use_id)) {
          pendingToolUses.delete(block.tool_use_id)
        }
      }
    }
  }

  return fixed
}

/**
 * Validates that all tool_use blocks have corresponding tool_result blocks
 * @param messages Array of Claude messages
 * @returns Array of validation errors, empty if valid
 */
export function validateToolUseResults(messages: ClaudeMessage[]): string[] {
  const errors: string[] = []
  const toolUseIds: Set<string> = new Set()

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]

    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_use') {
          toolUseIds.add(block.id)

          // Check if next message has corresponding tool_result
          const nextMessage = messages[i + 1]
          if (!nextMessage || nextMessage.role !== 'user') {
            errors.push(
              `Tool use ${block.id} at message ${i} must be followed by a user message with tool_result`,
            )
            continue
          }

          if (!Array.isArray(nextMessage.content)) {
            errors.push(`Message ${i + 1} after tool_use must have content array with tool_result`)
            continue
          }

          const hasResult = nextMessage.content.some(
            (b) => b.type === 'tool_result' && b.tool_use_id === block.id,
          )

          if (!hasResult) {
            errors.push(
              `Tool use ${block.id} at message ${i} has no corresponding tool_result in message ${i + 1}`,
            )
          }
        }
      }
    }
  }

  return errors
}
