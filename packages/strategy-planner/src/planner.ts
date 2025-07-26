import {
  StrategyPlannerRequest,
  StrategyPlannerResponse,
  Technique,
  TECHNIQUE_ALLOW_LIST,
  PlannerError
} from './types';
import { Validator } from './validator';
import { FailClosedHandler } from './fail-closed';
import axios from 'axios';

// LLM Response interface
interface LLMResponse {
  content: string;
  tokens_used: number;
  latency_ms: number;
  provider: string;
  model: string;
  finish_reason?: string;
  error?: string;
}

// Simple LLM provider interface
export interface LLMProvider {
  call(prompt: string): Promise<LLMResponse>;
}

export class StrategyPlanner {
  private validator: Validator;
  private failClosedHandler: FailClosedHandler;
  private llmProvider: LLMProvider;

  constructor(llmProvider?: LLMProvider) {
    this.validator = new Validator();
    this.failClosedHandler = new FailClosedHandler();
    
    // Default to OpenAI provider
    this.llmProvider = llmProvider || new DefaultLLMProvider();
  }

  /**
   * Main planning method - suggests optimization techniques
   */
  async plan(request: StrategyPlannerRequest): Promise<StrategyPlannerResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Generate strategy using LLM
      const llmResponse = await this.generateStrategyWithLLM(request);
      
      // Step 2: Parse LLM response
      const parsedResponse = this.parseLLMResponse(llmResponse, startTime);
      
      // Step 3: Validate response
      const validatedResponse = await this.validator.validate(parsedResponse);
      
      return validatedResponse;
    } catch (error) {
      // Fail-closed: return safe baseline on any error
      return this.failClosedHandler.handleError(error as Error, startTime);
    }
  }

  /**
   * Generate strategy suggestions using LLM
   */
  private async generateStrategyWithLLM(request: StrategyPlannerRequest): Promise<LLMResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(request);
    
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    try {
      return await this.llmProvider.call(fullPrompt);
    } catch (error) {
      throw new PlannerError('LLM call failed', { error });
    }
  }

  /**
   * Build system prompt for the LLM
   */
  private buildSystemPrompt(): string {
    const techniqueList = Object.values(TECHNIQUE_ALLOW_LIST)
      .map(t => `- ${t.name}: ${t.description} (for: ${t.applicableTo.join(', ')})`)
      .join('\n');

    return `You are a prompt optimization strategy planner. Your task is to analyze prompts and suggest appropriate optimization techniques.

Available techniques (choose up to 3):

${techniqueList}

Rules:
1. Suggest 0-3 techniques based on the prompt characteristics
2. Provide a clear rationale for your choices
3. Assign a confidence score between 0 and 1
4. Consider task type, complexity, and domain
5. Always include at least one guard helper for safety

Output format (JSON):
{
  "suggested_techniques": ["technique_name_1", "technique_name_2"],
  "rationale": "Clear explanation of why these techniques are appropriate",
  "confidence": 0.85
}`;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(request: StrategyPlannerRequest): string {
    const contextParts = [];
    
    if (request.context?.taskType) {
      contextParts.push(`Task type: ${request.context.taskType}`);
    }
    
    if (request.context?.modelName) {
      contextParts.push(`Target model: ${request.context.modelName}`);
    }
    
    if (request.context?.optimizationLevel) {
      contextParts.push(`Optimization level: ${request.context.optimizationLevel}`);
    }

    const contextString = contextParts.length > 0 
      ? `\n\nContext:\n${contextParts.join('\n')}` 
      : '';

    return `Analyze this prompt and suggest optimization techniques:

Prompt: "${request.prompt}"${contextString}

Provide your analysis in the specified JSON format.`;
  }

  /**
   * Parse LLM response into structured format
   */
  private parseLLMResponse(llmResponse: LLMResponse, startTime: number): StrategyPlannerResponse {
    try {
      // Extract JSON from response
      const content = llmResponse.content.trim();
      let jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new PlannerError('No JSON found in LLM response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Map technique names to enum values
      const techniques = (parsed.suggested_techniques || []).map((t: string) => {
        const normalizedName = t.toLowerCase().replace(/-/g, '_');
        return normalizedName as Technique;
      });

      return {
        suggested_techniques: techniques,
        rationale: parsed.rationale || 'No rationale provided',
        confidence: parsed.confidence || 0.5,
        metadata: {
          processingTimeMs: Date.now() - startTime,
          modelUsed: llmResponse.model
        }
      };
    } catch (error) {
      throw new PlannerError('Failed to parse LLM response', {
        response: llmResponse.content,
        error
      });
    }
  }

  /**
   * Quick planning for simple cases (bypass LLM)
   */
  async quickPlan(taskType: string): Promise<StrategyPlannerResponse> {
    const startTime = Date.now();
    
    // Predefined strategies for common task types
    const quickStrategies: Record<string, Technique[]> = {
      'reasoning': [Technique.CHAIN_OF_THOUGHT, Technique.SELF_CONSISTENCY],
      'coding': [Technique.SELF_REFINE, Technique.CHAIN_OF_THOUGHT],
      'creative': [Technique.TREE_OF_THOUGHT, Technique.SELF_CONSISTENCY],
      'analysis': [Technique.CHAIN_OF_THOUGHT, Technique.LEAST_TO_MOST],
      'default': [Technique.CHAIN_OF_THOUGHT]
    };

    const techniques = quickStrategies[taskType] || quickStrategies.default;
    
    // Always add a guard helper
    if (!techniques.includes(Technique.SYCOPHANCY_FILTER)) {
      techniques.push(Technique.SYCOPHANCY_FILTER);
    }

    return {
      suggested_techniques: techniques.slice(0, 3),
      rationale: `Quick strategy for ${taskType} tasks based on proven patterns`,
      confidence: 0.7,
      metadata: {
        processingTimeMs: Date.now() - startTime,
        modelUsed: 'rule-based'
      }
    };
  }
}

// Default LLM Provider implementation using OpenAI API
class DefaultLLMProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = 'gpt-4o-mini';
  }

  async call(prompt: string): Promise<LLMResponse> {
    const startTime = Date.now();
    
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const latency = Date.now() - startTime;
      const completion = response.data.choices[0];

      return {
        content: completion.message.content,
        tokens_used: response.data.usage.total_tokens || 0,
        latency_ms: latency,
        provider: 'openai',
        model: this.model,
        finish_reason: completion.finish_reason
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      throw new PlannerError('OpenAI API call failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        latency
      });
    }
  }
}