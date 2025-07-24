# How to Run PromptDial Performance Tests

## Prerequisites

Make sure you have your API keys set up in the `.env` file in the `packages/core` directory.

## Step-by-Step Instructions

1. **Navigate to the core package:**

   ```bash
   cd packages/core
   ```

2. **Run a basic test:**

   ```bash
   npm run test:performance "Explain quantum computing"
   ```

3. **Test with different optimization levels:**

   ```bash
   # Basic level
   npm run test:performance "What is AI?" -- --level basic

   # Advanced level (default)
   npm run test:performance "What is AI?" -- --level advanced

   # Expert level
   npm run test:performance "What is AI?" -- --level expert
   ```

4. **Test with specific models:**

   ```bash
   # Test with Claude
   npm run test:performance "Write a poem" -- --model claude-3-opus

   # Test with Gemini
   npm run test:performance "Write a poem" -- --model gemini-pro

   # Test with GPT-4 (default)
   npm run test:performance "Write a poem" -- --model gpt-4
   ```

5. **Complex example:**
   ```bash
   npm run test:performance "Create a Python function that sorts a list using merge sort" -- --model claude-3-opus --level expert
   ```

## What the Output Shows

The test will display:

- **Original Prompt Performance**: Response time and token count for your raw prompt
- **Optimized Variant Performance**: Response time and token count for PromptDial-optimized versions
- **Improvement Percentages**: How much faster/slower and more/less tokens used
- **Best Optimized Prompt**: The actual optimized prompt text

## Example Output

```
📊 Performance Test Results
==================================================

🔵 Original Prompt Performance:
  openai: 1200ms, 150 tokens
  anthropic: 1500ms, 200 tokens
  google: 1000ms, 180 tokens

🟢 Best Optimized Variant (Quality: 85/100):
  openai: 1000ms (16.7%), 120 tokens (20.0%)
  anthropic: 1300ms (13.3%), 170 tokens (15.0%)
  google: 900ms (10.0%), 160 tokens (11.1%)
```

## Troubleshooting

- If you see "API key not found" errors, make sure your `.env` file is in the `packages/core` directory
- OpenAI might show quota errors if you're on a free tier
- Some models might be deprecated - the code uses the latest available models
