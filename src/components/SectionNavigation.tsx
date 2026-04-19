import { NavLink } from 'react-router-dom'
import type { AppTab } from '../lib/app-navigation'

interface SectionNavigationProps {
  tabs: AppTab[]
}

export function SectionNavigation({ tabs }: SectionNavigationProps) {
  return (
    <nav className="section-nav" aria-label="Sections">
      {tabs.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.path}
          className={({ isActive }) => (isActive ? 'is-active' : undefined)}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
