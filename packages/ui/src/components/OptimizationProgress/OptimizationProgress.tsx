import { useEffect, useState } from 'react'
import styles from './OptimizationProgress.module.css'

interface ProgressStep {
  name: string
  status: 'pending' | 'active' | 'complete'
  message: string
}

interface OptimizationProgressProps {
  stage?: string
  progress: number
  isVisible: boolean
}

const progressSteps: Record<string, ProgressStep> = {
  initializing: { name: 'Initializing', status: 'active', message: 'Starting optimization process...' },
  validating: { name: 'Validating', status: 'active', message: 'Checking prompt validity...' },
  analyzing: { name: 'Analyzing', status: 'active', message: 'Understanding cognitive requirements...' },
  optimizing: { name: 'Optimizing', status: 'active', message: 'Applying Ultra-Think enhancements...' },
  generating: { name: 'Generating', status: 'active', message: 'Creating cognitive variants...' },
  evaluating: { name: 'Evaluating', status: 'active', message: 'Scoring quality metrics...' },
  finalizing: { name: 'Finalizing', status: 'active', message: 'Preparing results...' },
}

export function OptimizationProgress({ stage, progress, isVisible }: OptimizationProgressProps) {
  const [steps, setSteps] = useState<ProgressStep[]>([])

  useEffect(() => {
    if (!stage) return

    // Update steps based on current stage
    const allSteps = Object.keys(progressSteps).map(key => {
      const step = { ...progressSteps[key] }
      const stepIndex = Object.keys(progressSteps).indexOf(key)
      const currentIndex = Object.keys(progressSteps).indexOf(stage)
      
      if (stepIndex < currentIndex) {
        step.status = 'complete'
      } else if (stepIndex === currentIndex) {
        step.status = 'active'
      } else {
        step.status = 'pending'
      }
      
      return step
    })
    
    setSteps(allSteps)
  }, [stage])

  if (!isVisible) return null

  return (
    <div className={styles.container}>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
      
      <div className={styles.steps}>
        {steps.map((step, index) => (
          <div key={index} className={`${styles.step} ${styles[step.status]}`}>
            <div className={styles.stepIcon}>
              {step.status === 'complete' ? '✓' : step.status === 'active' ? '●' : '○'}
            </div>
            <div className={styles.stepInfo}>
              <div className={styles.stepName}>{step.name}</div>
              {step.status === 'active' && (
                <div className={styles.stepMessage}>{step.message}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}