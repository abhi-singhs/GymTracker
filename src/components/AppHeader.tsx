import { Link, NavLink } from 'react-router-dom'

interface AppHeaderProps {
  online: boolean
}

export function AppHeader({ online }: AppHeaderProps) {
  return (
    <header className="topbar">
      <Link className="brand" to="/">
        <span className="brand-mark">GT</span>
        <span>
          GymTracker
          <small>Private training journal</small>
        </span>
      </Link>

      <div className="topbar-actions">
        <span className={online ? 'status-pill success topbar-status' : 'status-pill warning topbar-status'}>
          {online ? 'Online' : 'Offline'}
        </span>
        <NavLink className="button subtle topbar-settings-link" to="/settings">
          Settings
        </NavLink>
      </div>
    </header>
  )
}
