/**
 * Utility functions for generating deep links to AI platforms with pre-filled prompts
 */

export interface PlatformLink {
  name: string
  url: string
  requiresExtension?: boolean
  icon: string
}

/**
 * Generates a deep link to ChatGPT with a pre-filled prompt
 * Note: Requires "Prompt ChatGPT via URL param" Chrome extension for auto-submit
 */
export function getChatGPTLink(prompt: string): PlatformLink {
  const encodedPrompt = encodeURIComponent(prompt)
  return {
    name: 'ChatGPT',
    url: `https://chat.openai.com/?q=${encodedPrompt}`,
    requiresExtension: true,
    icon: '🤖',
  }
}

/**
 * Generates a link to Claude AI
 * Note: No deep link support, opens main interface where user can paste
 */
export function getClaudeLink(): PlatformLink {
  return {
    name: 'Claude',
    url: 'https://claude.ai/',
    requiresExtension: false,
    icon: '🔮',
  }
}

/**
 * Generates a link to Google Gemini
 * Note: No deep link support, opens main interface where user can paste
 */
export function getGeminiLink(): PlatformLink {
  return {
    name: 'Gemini',
    url: 'https://gemini.google.com/',
    requiresExtension: false,
    icon: '💎',
  }
}

/**
 * Generates a link to Perplexity AI
 * Note: No deep link support, opens main interface where user can paste
 */
export function getPerplexityLink(): PlatformLink {
  return {
    name: 'Perplexity',
    url: 'https://perplexity.ai/',
    requiresExtension: false,
    icon: '🔍',
  }
}

/**
 * Gets all available platform links for a prompt
 */
export function getAllPlatformLinks(prompt: string): PlatformLink[] {
  return [getChatGPTLink(prompt), getClaudeLink(), getGeminiLink(), getPerplexityLink()]
}

/**
 * Gets platform links based on the target model from PromptDial optimization
 */
export function getPlatformLinksForModel(prompt: string, model: string): PlatformLink[] {
  const allLinks = getAllPlatformLinks(prompt)

  // Map model names to platform preferences
  const modelToPlatform: Record<string, string[]> = {
    'gpt-4': ['ChatGPT', 'Perplexity'],
    'gpt-4o': ['ChatGPT', 'Perplexity'],
    'claude-3-opus': ['Claude', 'Perplexity'],
    'claude-3-sonnet': ['Claude', 'Perplexity'],
    'claude-3-haiku': ['Claude', 'Perplexity'],
    'gemini-pro': ['Gemini', 'Perplexity'],
    'gemini-ultra': ['Gemini', 'Perplexity'],
  }

  const preferredPlatforms = modelToPlatform[model] || ['ChatGPT', 'Claude', 'Gemini']

  return allLinks.filter((link) => preferredPlatforms.includes(link.name))
}
