import type { ReactNode } from 'react'

interface ShellMessageProps {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}

export function ShellMessage({ eyebrow, title, description, action }: ShellMessageProps) {
  return (
    <div className="loading-shell">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description ? <p className="section-description">{description}</p> : null}
      {action}
    </div>
  )
}
