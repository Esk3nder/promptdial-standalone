# Strategy Planner Service

## Overview

The Strategy Planner is a core component of PromptDial 3.0 that acts as the "prompt brain" - intelligently suggesting optimization techniques based on the prompt characteristics and context. It implements a fail-closed, rule-bounded approach to prompt optimization strategy selection.

## Key Features

- **LLM-Assisted Strategy Selection**: Uses GPT-4 to analyze prompts and suggest appropriate optimization techniques
- **Strict Allow-List Validation**: Only approved techniques from a curated list can be suggested
- **Fail-Closed Design**: Any validation failure returns a safe baseline strategy (Chain-of-Thought)
- **Fast Validation**: Schema and allow-list validation completes in <100ms
- **Observable**: Emits metrics for monitoring and optimization

## Architecture

The Strategy Planner follows the first-principles axioms:

1. **Separation of Concerns**: Strategy selection is isolated from execution
2. **Model-Assisted, Rule-Approved**: LLM suggests, rules validate
3. **Observable by Default**: All operations emit telemetry
4. **Fail-Closed**: Errors route to safe baseline

## API Endpoints

### `POST /plan`

Main planning endpoint that analyzes a prompt and suggests optimization techniques.

**Request:**

```json
{
  "prompt": "Explain quantum computing",
  "context": {
    "taskType": "explanation",
    "modelName": "gpt-4",
    "optimizationLevel": "normal",
    "metadata": {}
  }
}
```

**Response:**

```json
{
  "suggested_techniques": ["chain_of_thought", "self_consistency"],
  "rationale": "Explanation tasks benefit from step-by-step reasoning...",
  "confidence": 0.85,
  "trace_id": "trace-123456",
  "metadata": {
    "processingTimeMs": 250,
    "modelUsed": "gpt-4o-mini"
  }
}
```

### `POST /plan/quick`

Quick planning for simple cases (bypasses LLM).

**Request:**

```json
{
  "task_type": "reasoning"
}
```

### `GET /health`

Health check endpoint.

### `GET /metrics`

Service metrics endpoint.

## Technique Allow-List

The service maintains a strict allow-list of optimization techniques:

### Reasoning Paths

- `chain_of_thought` - Step-by-step reasoning decomposition
- `tree_of_thought` - Branching exploration of solution paths
- `least_to_most` - Build up from simple to complex

### Variance Dampers

- `self_consistency` - Multiple sampling with majority vote
- `universal_self_consistency` - Self-consistency across formats

### Meta Optimizers

- `dspy_bootstrap_fewshot` - Automated few-shot example generation
- `grips` - Gradient-free prompt search

### Critique Loops

- `self_refine` - Iterative self-improvement
- `self_calibration` - Confidence adjustment through reflection

### Guard Helpers

- `sycophancy_filter` - Prevent agreement bias
- `jailbreak_regex_bank` - Pattern matching for known exploits

## Configuration

Environment variables:

- `PORT` - Service port (default: 3008)
- `OPENAI_API_KEY` - OpenAI API key for strategy generation
- `ANTHROPIC_API_KEY` - Alternative LLM provider

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Testing

The service includes comprehensive tests covering:

- Validation logic
- Fail-closed mechanism
- Planning strategies
- API endpoints
- Proof-of-work requirements (reproducibility, robustness, exploit resistance, cost ceiling)

Run tests with coverage:

```bash
npm run test:coverage
```

## Integration

The Strategy Planner integrates with the API Gateway and is called after task classification but before technique generation. It provides suggestions that guide the Technique Engine in generating appropriate prompt variants.

## Error Handling

All errors are handled gracefully with fail-closed behavior:

- Invalid LLM responses → baseline strategy
- Validation failures → baseline strategy
- Network errors → baseline strategy
- Any unexpected error → baseline strategy

The baseline strategy always returns Chain-of-Thought as a safe, proven technique.

## Monitoring

Key metrics to monitor:

- Request rate and latency
- Validation failure rate
- Baseline response rate (indicates failures)
- Technique distribution
- Confidence scores

## Security

- Input sanitization on all endpoints
- Strict JSON schema validation
- Allow-list enforcement for techniques
- No direct prompt execution
- Rate limiting via API Gateway
