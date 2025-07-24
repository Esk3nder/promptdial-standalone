import React, { useState } from 'react'

interface PromptInputProps {
  onSubmit: (
    prompt: string,
    options: {
      targetModel: string
      optimizationLevel: string
    },
  ) => void
  disabled?: boolean
}

export function PromptInput({ onSubmit, disabled }: PromptInputProps) {
  const [prompt, setPrompt] = useState('')
  const [targetModel, setTargetModel] = useState('gpt-4')
  const [optimizationLevel, setOptimizationLevel] = useState('advanced')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim()) {
      onSubmit(prompt, { targetModel, optimizationLevel })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="prompt-input">
      <div className="input-group">
        <label htmlFor="prompt">Prompt</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here..."
          rows={4}
          disabled={disabled}
          required
        />
        <div className="char-count">{prompt.length} / 10000</div>
      </div>

      <div className="options-row">
        <div className="input-group">
          <label htmlFor="model">Target Model</label>
          <select
            id="model"
            value={targetModel}
            onChange={(e) => setTargetModel(e.target.value)}
            disabled={disabled}
          >
            <option value="gpt-4">GPT-4</option>
            <option value="claude-3-opus">Claude 3 Opus</option>
            <option value="gemini-pro">Gemini Pro</option>
          </select>
        </div>

        <div className="input-group">
          <label htmlFor="level">Optimization Level</label>
          <select
            id="level"
            value={optimizationLevel}
            onChange={(e) => setOptimizationLevel(e.target.value)}
            disabled={disabled}
          >
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        <button type="submit" disabled={disabled || !prompt.trim()}>
          {disabled ? 'Testing...' : 'Start Test'}
        </button>
      </div>
    </form>
  )
}
