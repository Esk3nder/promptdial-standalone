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
  initializing: {
    name: 'Initializing',
    status: 'active',
    message: 'Starting optimization process...',
  },
  validating: { name: 'Validating', status: 'active', message: 'Checking prompt validity...' },
  analyzing: {
    name: 'Analyzing',
    status: 'active',
    message: 'Understanding cognitive requirements...',
  },
  optimizing: {
    name: 'Optimizing',
    status: 'active',
    message: 'Applying advanced prompt enhancements...',
  },
  generating: { name: 'Generating', status: 'active', message: 'Creating cognitive variants...' },
  evaluating: { name: 'Evaluating', status: 'active', message: 'Scoring quality metrics...' },
  finalizing: { name: 'Finalizing', status: 'active', message: 'Preparing results...' },
}

export function OptimizationProgress({ stage, progress, isVisible }: OptimizationProgressProps) {
  const [currentStep, setCurrentStep] = useState<ProgressStep | null>(null)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  useEffect(() => {
    if (!stage) return

    // Get current step info
    const current = progressSteps[stage]
    if (current) {
      setCurrentStep(current)

      // Update completed steps
      const stepKeys = Object.keys(progressSteps)
      const currentIndex = stepKeys.indexOf(stage)
      const completed = stepKeys.slice(0, currentIndex)
      setCompletedSteps(completed)
    }
  }, [stage])

  if (!isVisible) return null

  return (
    <div className={styles.container}>
      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        <div className={styles.progressText}>{progress}%</div>
      </div>

      {/* Current stage indicator */}
      {currentStep && (
        <div className={styles.currentStage}>
          <div className={styles.stageIcon}>
            <div className={styles.spinner}></div>
          </div>
          <div className={styles.stageInfo}>
            <div className={styles.stageName}>{currentStep.name}</div>
            <div className={styles.stageMessage}>{currentStep.message}</div>
          </div>
        </div>
      )}

      {/* Completed steps summary */}
      {completedSteps.length > 0 && (
        <div className={styles.completedSteps}>
          {completedSteps.map((stepKey) => (
            <span key={stepKey} className={styles.completedStep}>
              ✓ {progressSteps[stepKey].name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
