import React from 'react'
import { getAllPlatformLinks, type PlatformLink } from '@/utils/deepLinks'
import styles from './DeepLinkButtons.module.css'

interface DeepLinkButtonsProps {
  prompt: string
  model?: string
  className?: string
}

export function DeepLinkButtons({ prompt, model, className }: DeepLinkButtonsProps) {
  const links = getAllPlatformLinks(prompt)

  const handleLinkClick = (link: PlatformLink) => {
    window.open(link.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.label}>Open in:</div>
      <div className={styles.buttons}>
        {links.map((link) => (
          <button
            key={link.name}
            className={`${styles.linkButton} ${link.requiresExtension ? styles.requiresExtension : ''}`}
            onClick={() => handleLinkClick(link)}
            title={
              link.requiresExtension
                ? `${link.name} (requires browser extension)`
                : `Open in ${link.name}`
            }
            aria-label={`Open prompt in ${link.name}`}
          >
            <span className={styles.icon} aria-hidden="true">
              {link.icon}
            </span>
            <span className={styles.name}>{link.name}</span>
            {link.requiresExtension && (
              <span className={styles.extensionIndicator} aria-label="requires extension">
                *
              </span>
            )}
          </button>
        ))}
      </div>
      {links.some((link) => link.requiresExtension) && (
        <div className={styles.disclaimer}>* Requires browser extension for auto-submit</div>
      )}
    </div>
  )
}
