import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { DocsContent } from '@/components/docs/DocsContent'
import styles from './DocsPage.module.css'

// Documentation structure based on mockup
export const docsStructure = {
  'getting-started': {
    title: 'Getting Started',
    icon: '📘',
    sections: {
      'quick-start': 'Quick Start',
      'installation': 'Installation',
      'basic-concepts': 'Basic Concepts'
    }
  },
  'user-guide': {
    title: 'User Guide',
    icon: '⚡',
    sections: {
      'instant-prompts': 'Instant Prompts',
      'deep-prompting': 'Deep Prompting',
      'provider-selection': 'Provider Selection',
      'output-formats': 'Output Formats'
    }
  },
  'advanced-features': {
    title: 'Advanced Features',
    icon: '⚙️',
    sections: {
      'pipeline-overview': 'Pipeline Overview',
      'model-optimizations': 'Model Optimizations',
      'cost-tracking': 'Cost Tracking',
      'saved-prompts': 'Saved Prompts'
    }
  },
  'api-reference': {
    title: 'API Reference',
    icon: '</>', 
    sections: {
      'backend-api': 'Backend API',
      'model-integration': 'Model Integration',
      'configuration': 'Configuration'
    }
  },
  'developer-guide': {
    title: 'Developer Guide',
    icon: '👩‍💻',
    sections: {
      'contributing': 'Contributing',
      'architecture': 'Architecture',
      'extending': 'Extending'
    }
  }
}

export function DocsPage() {
  const { category = 'getting-started', section = 'quick-start' } = useParams<{
    category?: string
    section?: string
  }>()
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Validate route parameters
  if (!docsStructure[category as keyof typeof docsStructure]) {
    return <Navigate to="/docs/getting-started/quick-start" replace />
  }

  const currentCategory = docsStructure[category as keyof typeof docsStructure]
  if (!currentCategory.sections[section as keyof typeof currentCategory.sections]) {
    return <Navigate to={`/docs/${category}/${Object.keys(currentCategory.sections)[0]}`} replace />
  }

  return (
    <div className={styles.docsContainer}>
      {/* Mobile menu toggle */}
      <button
        className={styles.mobileMenuToggle}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={isSidebarOpen 
              ? "M6 18L18 6M6 6l12 12"
              : "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            }
          />
        </svg>
      </button>

      {/* Sidebar */}
      <DocsSidebar
        structure={docsStructure}
        currentCategory={category}
        currentSection={section}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main content */}
      <main className={styles.docsMain}>
        <DocsContent
          category={category}
          section={section}
        />
      </main>
    </div>
  )
}