import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Clock,
  Clock3,
  GraduationCap,
  Menu as MenuIcon,
} from 'lucide-react'
import logoUrl from '../assets/hero.png'
import { useAppStore } from '../core/store/useAppStore'

type TabKey = 'timetable' | 'calendar' | 'grades' | 'clock' | 'more'

const tabs: Array<{ key: TabKey; label: string; icon: typeof CalendarDays; path: string }> = [
  { key: 'timetable', label: '課表', icon: Clock3, path: '/app/timetable' },
  { key: 'calendar', label: '行事曆', icon: CalendarDays, path: '/app/calendar' },
  { key: 'grades', label: '成績', icon: GraduationCap, path: '/app/grades' },
  { key: 'clock', label: '鬧鐘', icon: Clock, path: '/app/clock' },
  { key: 'more', label: '其它', icon: MenuIcon, path: '/app/more' },
]

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { headerMenuOpen, setHeaderMenuOpen } = useAppStore()

  // Determine current tab from URL
  const currentTab = tabs.find((t) => location.pathname.startsWith(t.path))?.key || 'timetable'
  
  // Hide bottom nav if we are deep inside a "more" subview (e.g., /app/more/portal)
  const isMoreSubview = location.pathname.startsWith('/app/more/') && location.pathname !== '/app/more'
  
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-main" onClick={() => navigate('/app/timetable')} style={{ cursor: 'pointer' }}>
          <img src={logoUrl} alt="Logo" width={24} height={24} />
          <h1>海大 TAT</h1>
        </div>

        {!isMoreSubview && (
          <div className="header-actions">
            <button
              className="icon-btn"
              type="button"
              aria-label="選單"
              aria-expanded={headerMenuOpen}
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
            >
              <MenuIcon size={21} />
            </button>
            
            {headerMenuOpen && (
              <div className="header-menu" role="menu">
                {/* We'll re-implement the refresh and add course buttons as context-specific actions later,
                    or use a global event/store to trigger them from the shell. */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setHeaderMenuOpen(false)
                    navigate('/app/more')
                  }}
                >
                  <MenuIcon size={17} />
                  <span>開啟其它功能</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="main-content">
        <div className="view-transition">
          <Outlet />
        </div>
      </main>

      {!isMoreSubview && (
        <nav className="bottom-nav" aria-label="主功能">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.key
            return (
              <button
                key={tab.key}
                className={`nav-button ${isActive ? 'active' : ''}`}
                type="button"
                onClick={() => {
                  setHeaderMenuOpen(false)
                  navigate(tab.path)
                }}
              >
                <Icon size={24} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
