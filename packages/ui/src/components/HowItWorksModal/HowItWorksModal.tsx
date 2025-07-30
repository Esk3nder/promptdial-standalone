import { Modal } from '@/components/common'
import styles from './HowItWorksModal.module.css'

interface HowItWorksModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Step {
  number: number
  title: string
  description: string
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Enter Your Prompt',
    description: 'Type any idea or request into the input field'
  },
  {
    number: 2,
    title: 'Choose Your Mode',
    description: 'Select Instant Prompt for quick enhancement or Deep Prompting for AI-optimized refinement'
  },
  {
    number: 3,
    title: 'Pick Your Provider',
    description: 'Choose from Gemini, Claude, or OpenAI for provider-specific optimization'
  },
  {
    number: 4,
    title: 'Refine & Review',
    description: 'Click "Refine Prompt" and let our 3-stage pipeline craft your perfect prompt'
  },
  {
    number: 5,
    title: 'Copy & Use',
    description: 'Get your professionally structured prompt ready for any AI interaction'
  }
]

export function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="How PromptDial Works"
      size="medium"
    >
      <div className={styles.container}>
        <p className={styles.subtitle}>
          Get started in minutes with our quick start guide and example prompts.
        </p>
        
        <div className={styles.steps}>
          {steps.map((step) => (
            <div key={step.number} className={styles.step}>
              <div className={styles.stepNumber}>
                {step.number}
              </div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>
                  {step.title}
                </h3>
                <p className={styles.stepDescription}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <div className={styles.footer}>
          <button 
            className={styles.gotItButton}
            onClick={onClose}
            type="button"
          >
            Got It
          </button>
        </div>
      </div>
    </Modal>
  )
}