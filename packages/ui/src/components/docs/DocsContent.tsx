import { useEffect } from 'react'
import { docsStructure } from '@/pages/DocsPage'
import { QuickStart } from './sections/QuickStart'
import { Installation } from './sections/Installation'
import { BasicConcepts } from './sections/BasicConcepts'
import { InstantPrompts } from './sections/InstantPrompts'
import { DeepPrompting } from './sections/DeepPrompting'
import { ProviderSelection } from './sections/ProviderSelection'
import { OutputFormats } from './sections/OutputFormats'
import { PipelineOverview } from './sections/PipelineOverview'
import { ModelOptimizations } from './sections/ModelOptimizations'
import { CostTracking } from './sections/CostTracking'
import { SavedPrompts } from './sections/SavedPrompts'
import { BackendAPI } from './sections/BackendAPI'
import { ModelIntegration } from './sections/ModelIntegration'
import { Configuration } from './sections/Configuration'
import { Contributing } from './sections/Contributing'
import { Architecture } from './sections/Architecture'
import { Extending } from './sections/Extending'
import styles from './DocsContent.module.css'

interface DocsContentProps {
  category: string
  section: string
}

// Map section keys to components
const sectionComponents: Record<string, React.ComponentType> = {
  'quick-start': QuickStart,
  'installation': Installation,
  'basic-concepts': BasicConcepts,
  'instant-prompts': InstantPrompts,
  'deep-prompting': DeepPrompting,
  'provider-selection': ProviderSelection,
  'output-formats': OutputFormats,
  'pipeline-overview': PipelineOverview,
  'model-optimizations': ModelOptimizations,
  'cost-tracking': CostTracking,
  'saved-prompts': SavedPrompts,
  'backend-api': BackendAPI,
  'model-integration': ModelIntegration,
  'configuration': Configuration,
  'contributing': Contributing,
  'architecture': Architecture,
  'extending': Extending,
}

export function DocsContent({ category, section }: DocsContentProps) {
  const categoryData = docsStructure[category as keyof typeof docsStructure]
  const sectionTitle = categoryData?.sections[section as keyof typeof categoryData.sections]
  const SectionComponent = sectionComponents[section]

  // Scroll to top when section changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [category, section])

  if (!SectionComponent) {
    return (
      <article className={styles.content}>
        <h1>Content Coming Soon</h1>
        <p>This section is under construction.</p>
      </article>
    )
  }

  return (
    <article className={styles.content}>
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          <span>{categoryData.title}</span>
          <span className={styles.separator}>/</span>
          <span>{sectionTitle}</span>
        </div>
        <h1 className={styles.title}>{sectionTitle}</h1>
      </header>
      
      <div className={styles.body}>
        <SectionComponent />
      </div>
    </article>
  )
}