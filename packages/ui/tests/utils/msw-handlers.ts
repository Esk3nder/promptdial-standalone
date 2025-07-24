import { http, HttpResponse, delay } from 'msw'
import { createMockOptimizationResult } from './mock-data'

// Since PromptDial runs client-side, we'll mock at the module level
// This is just a placeholder for potential future API endpoints
export const handlers = [
  // Example handler for future API endpoint
  http.post('/api/optimize', async ({ request }) => {
    // Simulate network delay
    await delay(500)

    const body = (await request.json()) as any
    const { optimizationLevel } = body

    // Return different number of variants based on level
    const variantCount =
      optimizationLevel === 'expert' ? 5 : optimizationLevel === 'advanced' ? 3 : 1

    return HttpResponse.json(createMockOptimizationResult(variantCount))
  }),

  // Health check endpoint
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' })
  }),
]

// Mock the PromptDial module directly for tests
export const createMockPromptDial = () => {
  const optimize = vi.fn().mockImplementation(async (request) => {
    // Simulate async behavior
    await delay(100)

    const variantCount =
      request.optimizationLevel === 'expert' ? 5 : request.optimizationLevel === 'advanced' ? 3 : 1

    return createMockOptimizationResult(variantCount)
  })

  return {
    optimize,
    validateVariant: vi.fn(),
    compareVariants: vi.fn(),
  }
}
