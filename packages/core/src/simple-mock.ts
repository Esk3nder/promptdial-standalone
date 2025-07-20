// Simple mock data for testing
export function generateMockVariants(request: any): any[] {
  const variants = []
  const techniques = ['clarity', 'chain-of-thought', 'few-shot']
  
  for (let i = 0; i < 3; i++) {
    const technique = techniques[i]
    let optimizedPrompt = request.prompt
    
    switch (technique) {
      case 'clarity':
        optimizedPrompt = `Task: ${request.prompt}\n\nPlease provide a clear, detailed response with examples.`
        break
      case 'chain-of-thought':
        optimizedPrompt = `${request.prompt}\n\nThink step-by-step and show your reasoning process.`
        break
      case 'few-shot':
        optimizedPrompt = `Example of a good response:\n[Example would go here]\n\nNow, ${request.prompt}`
        break
    }
    
    variants.push({
      id: `variant-${Date.now()}-${i}`,
      originalPrompt: request.prompt,
      optimizedPrompt: optimizedPrompt,
      technique: technique,
      changes: [
        { type: technique, description: `Applied ${technique} optimization` }
      ],
      score: 0.75 + (Math.random() * 0.2),
      cost: 0.01 + (Math.random() * 0.02),
      estimatedTokens: Math.ceil(optimizedPrompt.length / 4),
      modelSpecificFeatures: ['optimized', technique]
    })
  }
  
  return variants
}