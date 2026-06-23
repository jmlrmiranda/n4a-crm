import { useEffect, useState } from 'react'
import api from '../api/client.js'
import './CompaniesPage.css'

const initialNewCompanyForm = {
  adminEmail: '',
  adminName: '',
  adminPassword: '',
  name: '',
  slug: '',
}

function CompaniesPage() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newCompanyOpen, setNewCompanyOpen] = useState(false)
  const [newCompanyForm, setNewCompanyForm] = useState(initialNewCompanyForm)
  const [newCompanySubmitting, setNewCompanySubmitting] = useState(false)
  const [editingCompanyId, setEditingCompanyId] = useState('')
  const [editingForm, setEditingForm] = useState({ isActive: true, name: '', slug: '' })
  const [updatingCompanyId, setUpdatingCompanyId] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadCompanies() {
      setLoading(true)
      setError('')

      try {
        const { data } = await api.get('/admin/companies')

        if (!ignore) {
          setCompanies(Array.isArray(data) ? data : [])
        }
      } catch {
        if (!ignore) {
          setCompanies([])
          setError('Não foi possível carregar as empresas.')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadCompanies()

    return () => {
      ignore = true
    }
  }, [])

  function updateNewCompanyField(field, value) {
    setNewCompanyForm((current) => ({ ...current, [field]: value }))
  }

  function updateEditingField(field, value) {
    setEditingForm((current) => ({ ...current, [field]: value }))
  }

  function openEdit(company) {
    setError('')
    setEditingCompanyId(company.id)
    setEditingForm({
      isActive: Boolean(company.isActive),
      name: company.name || '',
      slug: company.slug || '',
    })
  }

  function closeNewCompanyForm() {
    setNewCompanyOpen(false)
    setNewCompanyForm(initialNewCompanyForm)
  }

  async function createCompany(event) {
    event.preventDefault()
    setError('')
    setNewCompanySubmitting(true)

    try {
      const { data } = await api.post('/admin/companies', {
        adminEmail: newCompanyForm.adminEmail.trim(),
        adminName: newCompanyForm.adminName.trim(),
        adminPassword: newCompanyForm.adminPassword,
        name: newCompanyForm.name.trim(),
        slug: newCompanyForm.slug.trim(),
      })

      setCompanies((currentCompanies) =>
        [...currentCompanies, data.company].sort((a, b) => a.name.localeCompare(b.name)),
      )
      closeNewCompanyForm()
    } catch {
      setError('Não foi possível criar a empresa.')
    } finally {
      setNewCompanySubmitting(false)
    }
  }

  async function updateCompany(companyId) {
    setError('')
    setUpdatingCompanyId(companyId)

    try {
      const { data } = await api.patch(`/admin/companies/${companyId}`, {
        isActive: editingForm.isActive,
        name: editingForm.name.trim(),
        slug: editingForm.slug.trim(),
      })

      setCompanies((currentCompanies) =>
        currentCompanies
          .map((company) => (company.id === companyId ? data : company))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
      setEditingCompanyId('')
    } catch {
      setError('Não foi possível actualizar a empresa.')
    } finally {
      setUpdatingCompanyId('')
    }
  }

  async function deactivateCompany(company) {
    if (!window.confirm(`Desactivar a empresa ${company.name}?`)) {
      return
    }

    setError('')
    setUpdatingCompanyId(company.id)

    try {
      await api.delete(`/admin/companies/${company.id}`)
      setCompanies((currentCompanies) =>
        currentCompanies.map((currentCompany) =>
          currentCompany.id === company.id
            ? { ...currentCompany, isActive: false }
            : currentCompany,
        ),
      )
    } catch {
      setError('Não foi possível desactivar a empresa.')
    } finally {
      setUpdatingCompanyId('')
    }
  }

  if (loading) {
    return <div className="companies-page__state">A carregar...</div>
  }

  if (error && companies.length === 0) {
    return <div className="companies-page__error">{error}</div>
  }

  return (
    <section className="companies-page">
      <header className="companies-page__header">
        <h1 className="companies-page__title">Empresas</h1>
        <button
          className="n4a-btn n4a-btn--primary"
          onClick={() => setNewCompanyOpen(true)}
          type="button"
        >
          + Nova empresa
        </button>
      </header>

      {error && <div className="companies-page__error">{error}</div>}

      <div className="n4a-card companies-page__table-card">
        {companies.length ? (
          <table className="n4a-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Slug</th>
                <th>Activo</th>
                <th>Acções</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const isEditing = editingCompanyId === company.id
                const isUpdating = updatingCompanyId === company.id

                return (
                  <tr key={company.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="n4a-input companies-page__input"
                          onChange={(event) => updateEditingField('name', event.target.value)}
                          value={editingForm.name}
                        />
                      ) : (
                        company.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="n4a-input companies-page__input"
                          onChange={(event) => updateEditingField('slug', event.target.value)}
                          value={editingForm.slug}
                        />
                      ) : (
                        company.slug
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <label className="companies-page__checkbox">
                          <input
                            checked={editingForm.isActive}
                            onChange={(event) =>
                              updateEditingField('isActive', event.target.checked)
                            }
                            type="checkbox"
                          />
                          Activa
                        </label>
                      ) : (
                        <span
                          className={
                            company.isActive
                              ? 'companies-page__active'
                              : 'companies-page__inactive'
                          }
                        >
                          {company.isActive ? 'Sim' : 'Não'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="companies-page__actions">
                        {isEditing ? (
                          <>
                            <button
                              className="n4a-btn n4a-btn--primary companies-page__action"
                              disabled={isUpdating}
                              onClick={() => updateCompany(company.id)}
                              type="button"
                            >
                              Guardar
                            </button>
                            <button
                              className="n4a-btn n4a-btn--ghost companies-page__action"
                              disabled={isUpdating}
                              onClick={() => setEditingCompanyId('')}
                              type="button"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="n4a-btn n4a-btn--ghost companies-page__action"
                              disabled={isUpdating}
                              onClick={() => openEdit(company)}
                              type="button"
                            >
                              Editar
                            </button>
                            <button
                              className="n4a-btn n4a-btn--ghost companies-page__action"
                              disabled={isUpdating || !company.isActive}
                              onClick={() => deactivateCompany(company)}
                              type="button"
                            >
                              Desactivar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="companies-page__state">Sem empresas</div>
        )}
      </div>

      {newCompanyOpen && (
        <div className="companies-page__modal" role="presentation">
          <form
            aria-labelledby="new-company-title"
            aria-modal="true"
            className="n4a-card companies-page__modal-card"
            onSubmit={createCompany}
            role="dialog"
          >
            <h2 className="companies-page__modal-title" id="new-company-title">
              Nova empresa
            </h2>

            <label className="n4a-label" htmlFor="new-company-name">
              Nome da empresa
            </label>
            <input
              className="n4a-input"
              id="new-company-name"
              onChange={(event) => updateNewCompanyField('name', event.target.value)}
              required
              value={newCompanyForm.name}
            />

            <label className="n4a-label companies-page__label" htmlFor="new-company-slug">
              Slug
            </label>
            <input
              className="n4a-input"
              id="new-company-slug"
              onChange={(event) => updateNewCompanyField('slug', event.target.value)}
              required
              value={newCompanyForm.slug}
            />

            <label className="n4a-label companies-page__label" htmlFor="new-company-admin-name">
              Nome do admin
            </label>
            <input
              className="n4a-input"
              id="new-company-admin-name"
              onChange={(event) => updateNewCompanyField('adminName', event.target.value)}
              required
              value={newCompanyForm.adminName}
            />

            <label className="n4a-label companies-page__label" htmlFor="new-company-admin-email">
              Email do admin
            </label>
            <input
              className="n4a-input"
              id="new-company-admin-email"
              onChange={(event) => updateNewCompanyField('adminEmail', event.target.value)}
              required
              type="email"
              value={newCompanyForm.adminEmail}
            />

            <label
              className="n4a-label companies-page__label"
              htmlFor="new-company-admin-password"
            >
              Password do admin
            </label>
            <input
              className="n4a-input"
              id="new-company-admin-password"
              onChange={(event) => updateNewCompanyField('adminPassword', event.target.value)}
              required
              type="password"
              value={newCompanyForm.adminPassword}
            />

            <div className="companies-page__modal-actions">
              <button
                className="n4a-btn n4a-btn--ghost"
                disabled={newCompanySubmitting}
                onClick={closeNewCompanyForm}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="n4a-btn n4a-btn--primary"
                disabled={newCompanySubmitting}
                type="submit"
              >
                {newCompanySubmitting ? 'A criar...' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

export default CompaniesPage
