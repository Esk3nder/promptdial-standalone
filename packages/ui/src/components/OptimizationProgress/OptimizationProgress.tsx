import { useEffect, useState } from 'react'
import styles from './OptimizationProgress.module.css'

interface ProgressStep {
  name: string
  status: 'pending' | 'active' | 'complete'
  message: string
}

interface OptimizationProgressProps {
  stage?: string
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

const stageOrder = ['initializing', 'validating', 'analyzing', 'optimizing', 'generating', 'evaluating', 'finalizing']

export function OptimizationProgress({ stage, isVisible }: OptimizationProgressProps) {
  const [currentStep, setCurrentStep] = useState<ProgressStep | null>(null)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0)

  useEffect(() => {
    if (!stage) return

    // Get current step info
    const current = progressSteps[stage]
    if (current) {
      setCurrentStep(current)

      // Update completed steps and current stage index
      const currentIndex = stageOrder.indexOf(stage)
      setCurrentStageIndex(currentIndex)
      const completed = stageOrder.slice(0, currentIndex)
      setCompletedSteps(completed)
    }
  }, [stage])

  // Calculate stage-based progress (how many stages completed out of total)
  // const stageProgress = ((currentStageIndex + 1) / stageOrder.length) * 100

  if (!isVisible) return null

  return (
    <div className={styles.container}>
      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.stageSegments}>
          {stageOrder.map((stageName, index) => (
            <div
              key={stageName}
              className={`${styles.stageSegment} ${
                index < currentStageIndex 
                  ? styles.completed 
                  : index === currentStageIndex 
                    ? styles.current 
                    : ''
              }`}
            />
          ))}
        </div>
        <div className={styles.progressText}>
          Stage {currentStageIndex + 1} of {stageOrder.length}
        </div>
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
