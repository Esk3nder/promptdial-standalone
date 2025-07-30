/**
 * PromptDial 3.0 - Security Pattern Definitions
 *
 * Patterns for detecting and blocking malicious prompts
 */

export interface SecurityPattern {
  id: string
  name: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  pattern: RegExp | ((text: string) => boolean)
  description: string
  action: 'block' | 'sanitize' | 'warn'
  replacement?: string | ((match: string) => string)
}

// ============= Prompt Injection Patterns =============

export const PROMPT_INJECTION_PATTERNS: SecurityPattern[] = [
  {
    id: 'ignore-instructions',
    name: 'Ignore Instructions',
    severity: 'high',
    pattern: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
    description: 'Attempts to override system instructions',
    action: 'block',
  },
  {
    id: 'new-instructions',
    name: 'New Instructions Override',
    severity: 'high',
    pattern: /from\s+now\s+on.*?(you\s+(are|will|must)|your\s+new)/i,
    description: 'Attempts to redefine AI behavior',
    action: 'block',
  },
  {
    id: 'role-override',
    name: 'Role Override',
    severity: 'high',
    pattern: /you\s+are\s+(now\s+)?(a|an)\s+\w+\s+(assistant|agent|bot|AI)/i,
    description: 'Attempts to change AI role',
    action: 'block',
  },
  {
    id: 'system-prompt-leak',
    name: 'System Prompt Extraction',
    severity: 'critical',
    pattern:
      /(show|tell|display|print|output|repeat).*?(system\s+prompt|initial\s+prompt|instructions)/i,
    description: 'Attempts to extract system prompts',
    action: 'block',
  },
  {
    id: 'command-injection',
    name: 'Command Injection',
    severity: 'high',
    pattern: /\[\[.*?\]\]|\{\{.*?\}\}|<\|.*?\|>/,
    description: 'Special delimiter injection attempts',
    action: 'sanitize',
    replacement: '',
  },
]

// ============= Jailbreak Patterns =============

export const JAILBREAK_PATTERNS: SecurityPattern[] = [
  {
    id: 'dan-jailbreak',
    name: 'DAN Jailbreak',
    severity: 'critical',
    pattern: /do\s+anything\s+now|DAN\s+mode/i,
    description: 'DAN (Do Anything Now) jailbreak attempt',
    action: 'block',
  },
  {
    id: 'pretend-mode',
    name: 'Pretend Mode',
    severity: 'high',
    pattern: /pretend\s+(you\s+are|to\s+be).*?(no\s+limits?|unrestricted)/i,
    description: 'Pretend mode jailbreak attempt',
    action: 'block',
  },
  {
    id: 'roleplay-unrestricted',
    name: 'Unrestricted Roleplay',
    severity: 'high',
    pattern: /role\s*play.*?(without\s+restrictions?|no\s+rules?)/i,
    description: 'Unrestricted roleplay attempt',
    action: 'block',
  },
  {
    id: 'hypothetical-harmful',
    name: 'Hypothetical Harmful',
    severity: 'medium',
    pattern: /hypothetically.*?(how\s+(would|to)|explain).*?(harm|illegal|dangerous)/i,
    description: 'Hypothetical harmful scenario',
    action: 'warn',
  },
  {
    id: 'storytelling-bypass',
    name: 'Story-based Bypass',
    severity: 'medium',
    pattern: /tell\s+me\s+a\s+story.*?(character|person).*?(hacks?|breaks?|exploits?)/i,
    description: 'Story-based restriction bypass',
    action: 'warn',
  },
]

// ============= Data Exfiltration Patterns =============

export const DATA_EXFILTRATION_PATTERNS: SecurityPattern[] = [
  {
    id: 'training-data-probe',
    name: 'Training Data Probe',
    severity: 'high',
    pattern: /training\s+data.*?(contains?|includes?|about)/i,
    description: 'Probing for training data information',
    action: 'block',
  },
  {
    id: 'memory-extraction',
    name: 'Memory Extraction',
    severity: 'high',
    pattern: /(what|show|tell).*?(remember|stored|memory|history)/i,
    description: 'Attempts to extract conversation memory',
    action: 'sanitize',
    replacement: 'What can I help you with?',
  },
  {
    id: 'api-key-fishing',
    name: 'API Key Fishing',
    severity: 'critical',
    pattern: /api[\s_-]?keys?|access[\s_-]?tokens?|credentials?/i,
    description: 'Fishing for API keys or credentials',
    action: 'block',
  },
]

// ============= Harmful Content Patterns =============

export const HARMFUL_CONTENT_PATTERNS: SecurityPattern[] = [
  {
    id: 'violence-instructions',
    name: 'Violence Instructions',
    severity: 'critical',
    pattern: /how\s+to.*?(make|build|create).*?(bomb|weapon|explosive)/i,
    description: 'Instructions for creating weapons',
    action: 'block',
  },
  {
    id: 'self-harm',
    name: 'Self Harm Content',
    severity: 'critical',
    pattern: /ways?\s+to.*?(self[\s-]?harm|suicide|hurt\s+myself)/i,
    description: 'Self-harm related content',
    action: 'block',
  },
  {
    id: 'illegal-activity',
    name: 'Illegal Activity',
    severity: 'high',
    pattern: /how\s+to.*?(hack|steal|forge|counterfeit)/i,
    description: 'Instructions for illegal activities',
    action: 'block',
  },
  {
    id: 'personal-info',
    name: 'Personal Information',
    severity: 'medium',
    pattern:
      /(?:ssn|social\s+security)\s*:?\s*\d{3}-?\d{2}-?\d{4}|credit\s+card\s*:?\s*\d{4}[\s-]?\d{4}/i,
    description: 'Personal identifiable information',
    action: 'sanitize',
    replacement: '[REDACTED]',
  },
]

// ============= Evasion Technique Patterns =============

export const EVASION_PATTERNS: SecurityPattern[] = [
  {
    id: 'base64-encoding',
    name: 'Base64 Encoded Instructions',
    severity: 'high',
    pattern: (text: string) => {
      // Check for base64 patterns that decode to suspicious content
      const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g
      const matches = text.match(base64Pattern) || []

      for (const match of matches) {
        try {
          const decoded = Buffer.from(match, 'base64').toString('utf-8')
          if (/ignore|override|system|prompt/i.test(decoded)) {
            return true
          }
        } catch {
          // Not valid base64, ignore
        }
      }
      return false
    },
    description: 'Base64 encoded malicious instructions',
    action: 'block',
  },
  {
    id: 'unicode-obfuscation',
    name: 'Unicode Obfuscation',
    severity: 'medium',
    pattern: /[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/,
    description: 'Hidden unicode characters for obfuscation',
    action: 'sanitize',
    replacement: '',
  },
  {
    id: 'leetspeak-evasion',
    name: 'Leetspeak Evasion',
    severity: 'medium',
    pattern: /(?:1gn0r3|0v3rr1d3|5y5t3m|pr0mpt)/i,
    description: 'Leetspeak to evade filters',
    action: 'block',
  },
  {
    id: 'character-substitution',
    name: 'Character Substitution',
    severity: 'medium',
    pattern: (text: string) => {
      // Normalize common substitutions
      const normalized = text
        .replace(/[@]/g, 'a')
        .replace(/[3]/g, 'e')
        .replace(/[1!]/g, 'i')
        .replace(/[0]/g, 'o')
        .replace(/[5$]/g, 's')

      // Check normalized text against key patterns
      return /ignore\s+instructions|system\s+prompt/i.test(normalized)
    },
    description: 'Character substitution to evade detection',
    action: 'block',
  },
]

// ============= Context Manipulation Patterns =============

export const CONTEXT_MANIPULATION_PATTERNS: SecurityPattern[] = [
  {
    id: 'context-overflow',
    name: 'Context Overflow',
    severity: 'medium',
    pattern: (text: string) => {
      // Detect attempts to overflow context with repetition
      const words = text.split(/\s+/)
      const wordCounts = new Map<string, number>()

      for (const word of words) {
        const count = (wordCounts.get(word) || 0) + 1
        wordCounts.set(word, count)

        // If any word repeats more than 50 times, it's suspicious
        if (count > 50) {
          return true
        }
      }

      return false
    },
    description: 'Context overflow with repetitive content',
    action: 'sanitize',
    replacement: (match: string) => {
      // Keep only first 100 words of repetitive content
      return match.split(/\s+/).slice(0, 100).join(' ') + '...'
    },
  },
  {
    id: 'prompt-stuffing',
    name: 'Prompt Stuffing',
    severity: 'high',
    pattern: (text: string) => {
      // Detect extremely long prompts that might hide instructions
      return text.length > 10000
    },
    description: 'Extremely long prompts to hide malicious content',
    action: 'sanitize',
    replacement: (text: string) => text.substring(0, 5000) + '... [TRUNCATED]',
  },
  {
    id: 'instruction-sandwich',
    name: 'Instruction Sandwich',
    severity: 'high',
    pattern: /ignore.*instructions.*continue/i,
    description: 'Hidden instructions between legitimate content',
    action: 'block',
  },
]

// ============= All Patterns Registry =============

export const ALL_SECURITY_PATTERNS: SecurityPattern[] = [
  ...PROMPT_INJECTION_PATTERNS,
  ...JAILBREAK_PATTERNS,
  ...DATA_EXFILTRATION_PATTERNS,
  ...HARMFUL_CONTENT_PATTERNS,
  ...EVASION_PATTERNS,
  ...CONTEXT_MANIPULATION_PATTERNS,
]

// ============= Pattern Categories =============

export const PATTERN_CATEGORIES = {
  prompt_injection: PROMPT_INJECTION_PATTERNS,
  jailbreak: JAILBREAK_PATTERNS,
  data_exfiltration: DATA_EXFILTRATION_PATTERNS,
  harmful_content: HARMFUL_CONTENT_PATTERNS,
  evasion: EVASION_PATTERNS,
  context_manipulation: CONTEXT_MANIPULATION_PATTERNS,
}

export type PatternCategory = keyof typeof PATTERN_CATEGORIES
