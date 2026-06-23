import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import './Layout.css'

function navLinkClass({ isActive }) {
  return `crm-shell__nav-item${isActive ? ' crm-shell__nav-item--active' : ''}`
}

function Layout() {
  const { activeCompanyName, companyId, logout, switchCompany, user } = useAuth()
  const [companies, setCompanies] = useState([])
  const [companiesLoaded, setCompaniesLoaded] = useState(false)
  const [companySwitching, setCompanySwitching] = useState(false)

  const companyName = activeCompanyName || 'Empresa activa'
  const supportCompanies = companiesLoaded
    ? companies
    : [{ id: companyId || '', name: companyName, slug: '', isActive: true }]

  async function loadCompanies() {
    if (companiesLoaded || user?.role !== 'N4A_SUPPORT') {
      return
    }

    try {
      const { data } = await api.get('/admin/companies')
      setCompanies(Array.isArray(data) ? data : [])
    } catch {
      setCompanies([{ id: companyId || '', name: companyName, slug: '', isActive: true }])
    } finally {
      setCompaniesLoaded(true)
    }
  }

  async function handleCompanyChange(event) {
    const targetCompanyId = event.target.value

    if (!targetCompanyId || targetCompanyId === companyId || companySwitching) {
      return
    }

    setCompanySwitching(true)
    try {
      await switchCompany(targetCompanyId)
      window.location.reload()
    } finally {
      setCompanySwitching(false)
    }
  }

  return (
    <div className="crm-shell">
      <header className="crm-shell__topbar">
        <div className="crm-shell__brand" aria-label="N4A CRM">
          <span className="crm-shell__brand-name">N4A</span>
          <span className="crm-shell__brand-separator">/</span>
          <span className="crm-shell__brand-product">CRM</span>
          <span className="crm-shell__brand-company">· {companyName}</span>
        </div>

        <div className="crm-shell__user">
          {user?.role === 'N4A_SUPPORT' ? (
            <select
              className="crm-shell__company-select"
              disabled={companySwitching}
              onChange={handleCompanyChange}
              onClick={loadCompanies}
              onFocus={loadCompanies}
              value={companyId || ''}
            >
              {supportCompanies.map((company) => (
                <option key={company.id || company.name} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="crm-shell__company-label">{companyName}</span>
          )}
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
