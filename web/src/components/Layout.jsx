import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import './Layout.css'

function navLinkClass({ isActive }) {
  return `crm-shell__nav-item${isActive ? ' crm-shell__nav-item--active' : ''}`
}

function Layout() {
  const { logout, user } = useAuth()

  return (
    <div className="crm-shell">
      <header className="crm-shell__topbar">
        <div className="crm-shell__brand" aria-label="N4A CRM">
          <span className="crm-shell__brand-name">N4A</span>
          <span className="crm-shell__brand-separator">/</span>
          <span className="crm-shell__brand-product">CRM</span>
        </div>

        <div className="crm-shell__user">
          <span className="crm-shell__user-name">{user?.name || 'Utilizador'}</span>
          <span className="n4a-badge n4a-badge--muted">{user?.role || 'USER'}</span>
          <button
            className="n4a-btn n4a-btn--ghost crm-shell__logout"
            onClick={logout}
            type="button"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="crm-shell__body">
        <aside className="crm-shell__sidebar">
          <nav className="crm-shell__nav" aria-label="Navegação principal">
            <NavLink to="/" end className={navLinkClass}>
              Pipeline
            </NavLink>
            <NavLink to="/clients" className={navLinkClass}>
              Clientes
            </NavLink>
            {user?.role === 'ADMIN' && (
              <>
                <NavLink to="/dashboard" className={navLinkClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/users" className={navLinkClass}>
                  Utilizadores
                </NavLink>
              </>
            )}
          </nav>
        </aside>

        <main className="crm-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
