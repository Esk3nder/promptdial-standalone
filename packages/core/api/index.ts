// Vercel serverless function entry point
export default function handler(req: any, res: any) {
  // For now, just return the static HTML
  if (req.url === '/' || req.url === '') {
    res.setHeader('Content-Type', 'text/html')
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>PromptDial API</title>
      </head>
      <body>
        <h1>PromptDial API</h1>
        <p>API is running. Use POST /api/optimize to optimize prompts.</p>
      </body>
      </html>
    `)
    return
  }

  // Handle API requests
  if (req.url === '/api/optimize' && req.method === 'POST') {
    // Import the actual handler
    const { PromptDial } = require('../dist/index')
    const promptDial = new PromptDial({
      autoValidate: true,
      sortByQuality: true,
      useAI: true,
    })

    promptDial
      .optimize(req.body)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch((error) => {
        res.status(500).json({ error: error.message })
      })
  } else {
    res.status(404).json({ error: 'Not found' })
  }
}
