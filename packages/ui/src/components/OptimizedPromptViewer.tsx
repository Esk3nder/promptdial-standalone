import React, { useState } from 'react'
import { DeepLinkButtons } from './DeepLinkButtons'

interface OptimizedPromptViewerProps {
  variants: Array<{
    variant: string
    quality: number
  }>
  bestIndex: number
}

export function OptimizedPromptViewer({ variants, bestIndex }: OptimizedPromptViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(variants[bestIndex].variant)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!variants.length) return null

  const bestVariant = variants[bestIndex]

  return (
    <div className="optimized-prompt-viewer">
      <div className="header">
        <h2>🎯 Best Optimized Prompt</h2>
        <div className="quality-badge">Quality Score: {bestVariant.quality}/100</div>
      </div>

      <div className="prompt-content">
        <pre>{bestVariant.variant}</pre>
        <button onClick={handleCopy} className="copy-button">
          {copied ? '✅ Copied!' : '📋 Copy'}
        </button>
        <DeepLinkButtons prompt={bestVariant.variant} />
      </div>

      {variants.length > 1 && (
        <details className="other-variants">
          <summary>View other variants ({variants.length - 1})</summary>
          {variants.map(
            (variant, index) =>
              index !== bestIndex && (
                <div key={index} className="variant">
                  <div className="variant-header">
                    <span>Variant {index + 1}</span>
                    <span className="quality">Quality: {variant.quality}/100</span>
                  </div>
                  <pre>{variant.variant}</pre>
                </div>
              ),
          )}
        </details>
      )}
    </div>
  )
}
