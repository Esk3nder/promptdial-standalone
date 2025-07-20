# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run a single test file
npx vitest tests/index.test.ts

# Run tests in watch mode
npx vitest --watch

# Run performance benchmarks
npm run test:performance
```

### Development
```bash
# Build TypeScript to JavaScript
npm run build

# Run demo in watch mode
npm run dev

# Pre-publish checks (build + test)
npm run prepublishOnly
```

## Architecture Overview

PromptDial follows a facade pattern with clear separation of concerns:

### Core Components

1. **PromptDial** (src/index.ts) - Main API facade
   - Orchestrates the optimization pipeline
   - Handles options like auto-validation and sorting
   - Provides the primary public interface

2. **MetaPromptDesigner** (src/meta-prompt-designer.ts) - Optimization engine
   - Generates model-specific prompt variants
   - Implements optimization strategies per level (basic/advanced/expert)
   - Detects task types and applies appropriate transformations

3. **QualityValidator** (src/quality-validator.ts) - Scoring system
   - Evaluates prompts across 7 quality dimensions
   - Provides improvement suggestions
   - Calculates overall quality scores

### Type System

The codebase is strongly typed with key interfaces:
- `OptimizationRequest` - Input parameters for optimization
- `OptimizedVariant` - Individual optimization result with quality metrics
- `ValidationResult` - Quality assessment with scores and suggestions
- `QualityFactors` - Detailed scoring across all dimensions

### Multi-Model Architecture

Each target model (GPT-4, Claude-3, Gemini) receives tailored optimizations:
- Model-specific prompt structures
- Optimized instruction formats
- Targeted feature utilization

## Testing Architecture

### Framework: Vitest
- BDD-style tests with describe/it blocks
- Global test functions enabled
- Coverage excludes: node_modules/, tests/, src/demo.ts

### Testing Patterns

1. **Unit Tests**: Each component has dedicated test file
   - Test individual methods and edge cases
   - Mock dependencies when needed
   - Validate error handling

2. **Integration Tests**: Main API tested end-to-end
   - Multiple optimization levels
   - Different model targets
   - Quality validation flows

3. **Test Structure**:
```typescript
describe('Component', () => {
  it('should handle specific case', async () => {
    // Arrange
    const input = { /* test data */ }
    
    // Act
    const result = await component.method(input)
    
    // Assert
    expect(result).toMatchExpectedStructure()
  })
})
```

## Development Workflow

### TypeScript Configuration
- Target: ES2020, Module: CommonJS
- Strict mode enabled - no implicit any
- Source maps for debugging
- Declaration files for type support

### Error Handling
Custom error classes for different failure modes:
- Input validation errors
- Optimization failures
- Model-specific issues

### Code Organization
- Pure functions where possible
- Dependency injection for testability
- Clear public/private method separation
- Comprehensive JSDoc comments for public APIs

### Publishing Workflow
1. Make changes and test locally
2. Run `npm run prepublishOnly` to verify
3. Use `npm version` to bump version (triggers git hooks)
4. Publish with `npm publish`

### Current Development Focus
- Expanding testing infrastructure (src/testing/)
- Adding API testing capabilities
- Performance benchmarking tools
- Web UI for local testing (packages/ui)

## UI Development

The project now includes a web UI for testing PromptDial locally:

### Running the UI
```bash
# From monorepo root
cd packages/ui
npm run dev
```

### UI Testing
```bash
# Run UI tests
cd packages/ui
npm test
```

### UI Architecture
- React 18 with TypeScript
- Vite for development
- CSS Modules (no Tailwind)
- Accessibility-first design
- TDD with Vitest