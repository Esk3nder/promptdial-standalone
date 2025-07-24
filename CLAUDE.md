# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development & Testing
```bash
# Setup and install
npm run setup              # Clean and install all dependencies
npm run install:all        # Install root and workspace dependencies

# Development servers
npm start                  # Start standalone server (port 3000)
npm run dev                # Start core development server
npm run start:ui           # Start UI development server

# Testing
npm test                   # Run all workspace tests
npm run test:coverage      # Run tests with coverage report
npx vitest tests/index.test.ts  # Run a single test file
npx vitest --watch         # Run tests in watch mode
npm run test:performance   # Run performance benchmarks

# Code quality
npm run lint               # ESLint check
npm run lint:fix           # Fix ESLint issues  
npm run format             # Prettier format
npm run format:check       # Check formatting
npm run build              # Build all packages
```

### Service-Specific Testing
```bash
# Test individual services
cd services/api-gateway && npm test
cd services/classifier && npm test
cd services/evaluator && npm test
# etc. for other services
```

### Docker Development
```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up api-gateway

# Rebuild containers
docker-compose build
```

## Architecture Overview

PromptDial 2.0 is a microservices-based prompt optimization platform that automatically enhances AI prompts using advanced techniques.

### Microservices Architecture

The system consists of 8+ specialized services communicating via HTTP:

1. **API Gateway** (port 3000) - Central orchestration and request routing
2. **Classifier** (3001) - Task classification and routing decisions
3. **Telemetry** (3002) - Monitoring, metrics, and observability
4. **Technique Engine** (3003) - Implements optimization strategies (Few-Shot CoT, ReAct, Tree of Thoughts, etc.)
5. **Retrieval Hub** (3004) - Vector store integration for context retrieval
6. **Evaluator** (3005) - Quality assessment using G-EVAL, ChatEval, Role-Debate
7. **Safety Guard** (3006) - Security validation with 30+ injection prevention patterns
8. **Optimizer** (3007) - Pareto optimization balancing quality/cost/latency
9. **LLM Runners** (400x) - Model-specific execution engines

### Core Library Components

The main package (`packages/core`) follows a facade pattern:

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

4. **AIMetaPromptDesigner** (src/ai-meta-prompt-designer.ts) - AI-powered optimization
   - Uses LLMs to generate advanced optimizations
   - Implements multi-model strategies

### Type System

The codebase is strongly typed with key interfaces:
- `OptimizationRequest` - Input parameters for optimization
- `OptimizedVariant` - Individual optimization result with quality metrics
- `ValidationResult` - Quality assessment with scores and suggestions
- `QualityFactors` - Detailed scoring across all dimensions

## Testing Architecture

### Framework: Vitest with Supertest
- BDD-style tests with describe/it blocks
- Global test functions enabled
- API testing with supertest for service endpoints
- Coverage excludes: node_modules/, tests/, src/demo.ts

### Testing Patterns

1. **Unit Tests**: Each component has dedicated test file
   - Test individual methods and edge cases
   - Mock dependencies when needed
   - Validate error handling

2. **Integration Tests**: Service APIs tested end-to-end
   - HTTP request/response validation
   - Inter-service communication testing
   - Error propagation across services

3. **Performance Tests**: Benchmark optimization strategies
   - Measure optimization time
   - Track quality improvements
   - Monitor resource usage

## Development Workflow

### Environment Setup
```bash
# Required environment variables
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
GOOGLE_API_KEY=your-key-here
NODE_ENV=development
```

### TypeScript Configuration
- Target: ES2020, Module: CommonJS  
- Strict mode enabled - no implicit any
- Source maps for debugging
- Declaration files for type support

### Code Quality Standards
- ESLint with max complexity of 6
- Prettier for consistent formatting
- Husky pre-commit hooks with lint-staged
- No console.log in production code

### Service Communication
Services communicate via HTTP REST APIs:
- Request/response JSON format
- Standardized error responses
- Health check endpoints at `/health`
- Metrics endpoints at `/metrics`

### Debugging Tips
1. Use service logs: `docker-compose logs -f [service-name]`
2. Check health endpoints: `curl http://localhost:3000/health`
3. Enable debug mode: `DEBUG=promptdial:* npm start`
4. Use Chrome DevTools for Node.js debugging

## UI Development

The project includes a React-based web UI for testing:

### Running the UI
```bash
# From monorepo root
cd packages/ui
npm run dev
```

### UI Architecture
- React 18 with TypeScript
- Vite for development
- CSS Modules (no Tailwind)
- Accessibility-first design
- TDD with Vitest

## Common Troubleshooting

### Service Connection Issues
- Ensure all services are running: `docker-compose ps`
- Check service logs for errors
- Verify port availability (3000-3007, 400x)

### Build Failures
- Clear node_modules: `npm run clean`
- Reinstall dependencies: `npm run setup`
- Check Node.js version (18+ required)

### Test Failures
- Run single test in debug mode: `npx vitest --reporter=verbose [test-file]`
- Check for missing environment variables
- Ensure services are accessible for integration tests