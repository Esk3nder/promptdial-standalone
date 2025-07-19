# PromptDial 🚀

> Transform your basic prompts into optimized, model-specific queries with AI-powered intelligence

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Overview

PromptDial is an advanced prompt optimization engine that transforms simple prompts into professionally crafted, model-specific queries. It analyzes your input and generates multiple optimized variants tailored for different AI models (GPT-4, Claude, Gemini) with quality scoring and improvement suggestions.

## ✨ Features

- **Multi-Level Optimization**: Basic, Advanced, and Expert optimization levels
- **Model-Specific Tailoring**: Optimizations for GPT-4, Claude 3, and Gemini Pro
- **Quality Validation**: Comprehensive scoring across 7 quality dimensions
- **Task Detection**: Automatic detection of prompt type (creative, analytical, coding, general)
- **Safety Filtering**: Built-in harmful content detection
- **Detailed Metrics**: Token estimation, improvement tracking, and quality factors

## 🚀 Quick Start

### Installation

```bash
npm install promptdial
```

### Basic Usage

```typescript
import { PromptDial } from 'promptdial'

const promptDial = new PromptDial()

// Optimize a basic prompt
const result = await promptDial.optimize({
  prompt: 'Write about artificial intelligence',
  targetModel: 'gpt-4',
  optimizationLevel: 'advanced'
})

console.log(result.variants[0].optimizedPrompt)
// Output: Professionally optimized prompt with structure, context, and model-specific enhancements
```

### Advanced Usage

```typescript
// With constraints and task type
const result = await promptDial.optimize({
  prompt: 'Create a Python function to sort a list',
  targetModel: 'claude-3-opus',
  optimizationLevel: 'expert',
  taskType: 'coding',
  constraints: {
    maxLength: 500,
    tone: 'professional',
    format: 'structured'
  }
})

// Get quality scores
result.variants.forEach(variant => {
  console.log(`Score: ${variant.quality.score}/100`)
  console.log(`Improvements: ${variant.changes.length}`)
})
```

## 📊 Quality Dimensions

PromptDial evaluates prompts across 7 key dimensions:

1. **Clarity** - Clear instructions and action verbs
2. **Specificity** - Detailed requirements and constraints  
3. **Structure** - Organization with sections and lists
4. **Completeness** - Appropriate length and detail
5. **Efficiency** - Balanced comprehensiveness
6. **Model Alignment** - Model-specific optimizations
7. **Safety** - Content appropriateness

## 🛠️ API Reference

### PromptDial.optimize(request)

Optimizes a prompt and returns scored variants.

**Parameters:**
- `prompt` (string, required): The prompt to optimize
- `targetModel` (string, required): Target AI model ('gpt-4', 'claude-3-opus', 'gemini-pro')
- `optimizationLevel` (string, required): Optimization level ('basic', 'advanced', 'expert')
- `taskType` (string, optional): Task type ('creative', 'analytical', 'coding', 'general')
- `constraints` (object, optional): Additional constraints
  - `maxLength` (number): Maximum prompt length
  - `tone` (string): Desired tone
  - `format` (string): Output format

**Returns:**
```typescript
{
  variants: Array<{
    id: string
    originalPrompt: string
    optimizedPrompt: string
    changes: Array<{type: string, description: string}>
    quality: {
      score: number
      factors: QualityFactors
      suggestions: string[]
      improvementPercentage: number
    }
    modelSpecificFeatures: string[]
    estimatedTokens: number
  }>
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Coverage report
npm run test:coverage
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙏 Acknowledgments

Built with TypeScript and love by the PromptDial team.

---

**Note**: This project is under active development. APIs may change in future versions.