import { useEffect, useRef, ReactNode } from 'react'
import styles from './Modal.module.css'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'small' | 'medium' | 'large'
}

export function Modal({ isOpen, onClose, title, children, size = 'medium' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousActiveElement = useRef<Element | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      // Store the currently active element
      previousActiveElement.current = document.activeElement
      
      // Show modal and focus it
      dialog.showModal()
      dialog.focus()
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
    } else {
      dialog.close()
      document.body.style.overflow = ''
      
      // Restore focus to the previously active element
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus()
      }
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      const rect = dialog.getBoundingClientRect()
      const isInDialog = (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      )
      
      if (!isInDialog) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      dialog.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      dialog.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.modal} ${styles[`modal--${size}`]}`}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div className={styles.modal__content}>
        <div className={styles.modal__header}>
          <h2 id="modal-title" className={styles.modal__title}>
            {title}
          </h2>
          <button
            className={styles.modal__close}
            onClick={onClose}
            aria-label="Close modal"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              width="20"
              height="20"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div id="modal-description" className={styles.modal__body}>
          {children}
        </div>
      </div>
    </dialog>
  )
}