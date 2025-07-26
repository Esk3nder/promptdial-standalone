import express, { Request, Response, NextFunction } from 'express';
import { StrategyPlanner } from './planner';
import { StrategyPlannerRequest, ValidationError, PlannerError } from './types';
import { createLogger } from '@promptdial/shared';

const app = express();
const port = process.env.PORT || 3008; // Next available port after optimizer (3007)
const logger = createLogger('strategy-planner');

// Initialize planner
const planner = new StrategyPlanner();

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'strategy-planner',
    version: '3.0.0',
    uptime: process.uptime()
  });
});

// Metrics endpoint
app.get('/metrics', (req: Request, res: Response) => {
  // TODO: Integrate with telemetry service
  res.json({
    requests_total: 0,
    requests_failed: 0,
    average_latency_ms: 0,
    baseline_responses: 0
  });
});

// Main planning endpoint
app.post('/plan', async (req: Request, res: Response) => {
  const traceId = req.headers['x-trace-id'] as string || `trace-${Date.now()}`;
  
  try {
    // Validate request body
    if (!req.body.prompt) {
      return res.status(400).json({
        error: 'Missing required field: prompt',
        trace_id: traceId
      });
    }

    const request: StrategyPlannerRequest = {
      prompt: req.body.prompt,
      context: req.body.context
    };

    // Execute planning
    const startTime = Date.now();
    const response = await planner.plan(request);
    const duration = Date.now() - startTime;

    // Log performance
    logger.info('Planning completed', {
      trace_id: traceId,
      duration_ms: duration,
      techniques: response.suggested_techniques,
      confidence: response.confidence,
      is_baseline: response.metadata?.modelUsed === 'baseline'
    });

    // Return response
    res.json({
      ...response,
      trace_id: traceId
    });

  } catch (error) {
    logger.error('Planning failed', {
      trace_id: traceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation error',
        message: error.message,
        details: error.details,
        trace_id: traceId
      });
    } else if (error instanceof PlannerError) {
      res.status(500).json({
        error: 'Planning error',
        message: error.message,
        trace_id: traceId
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        trace_id: traceId
      });
    }
  }
});

// Quick planning endpoint (for simple cases)
app.post('/plan/quick', async (req: Request, res: Response) => {
  const traceId = req.headers['x-trace-id'] as string || `trace-${Date.now()}`;
  
  try {
    const taskType = req.body.task_type || 'default';
    const response = await planner.quickPlan(taskType);
    
    res.json({
      ...response,
      trace_id: traceId
    });
  } catch (error) {
    logger.error('Quick planning failed', {
      trace_id: traceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      error: 'Quick planning failed',
      trace_id: traceId
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Strategy Planner service started on port ${port}`);
  });
}

// Export app for testing
export default app;

// Export core components for use by other services
export { StrategyPlanner } from './planner';
export { Validator } from './validator';
export { FailClosedHandler } from './fail-closed';
export * from './types';