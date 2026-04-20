import { NavLink } from 'react-router-dom'
import type { AppTab, AppTabId } from '../lib/app-navigation'

interface MobileTabBarProps {
  tabs: AppTab[]
  currentTabId: AppTabId
}

export function MobileTabBar({ tabs, currentTabId }: MobileTabBarProps) {
  return (
    <nav
      className="mobile-tabbar"
      aria-label="Page navigation"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.path}
          className={({ isActive }) => (isActive ? 'mobile-tab is-active' : 'mobile-tab')}
          aria-current={currentTabId === tab.id ? 'page' : undefined}
        >
          <span className="mobile-tab-line" aria-hidden="true" />
          <span className="mobile-tab-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
