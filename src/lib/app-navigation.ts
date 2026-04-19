export type AppTabId = 'overview' | 'goals' | 'workouts' | 'plan' | 'settings'

export interface AppTab {
  id: AppTabId
  label: string
  path: string
}

export const NAV_TABS: AppTab[] = [
  { id: 'overview', label: 'Overview', path: '/' },
  { id: 'goals', label: 'Goals', path: '/goals' },
  { id: 'workouts', label: 'Workouts', path: '/workouts' },
  { id: 'plan', label: 'Plan', path: '/plan' },
  { id: 'settings', label: 'Settings', path: '/settings' },
]
