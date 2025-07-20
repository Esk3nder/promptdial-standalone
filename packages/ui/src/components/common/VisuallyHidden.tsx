import type { ReactNode } from 'react'
import { srOnly } from '@/utils/styles'

interface VisuallyHiddenProps {
  children: ReactNode
  as?: keyof JSX.IntrinsicElements
}

export function VisuallyHidden({ 
  children, 
  as: Component = 'span' 
}: VisuallyHiddenProps) {
  return <Component style={srOnly}>{children}</Component>
}