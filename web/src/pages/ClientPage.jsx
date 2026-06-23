import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import './ClientPage.css'

const moneyFormatter = new Intl.NumberFormat('pt-PT', {
  currency: 'EUR',
  style: 'currency',
})

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const statusMeta = {
  ABERTA: { className: 'n4a-badge--muted', label: 'Aberta' },
  PROPOSTA_EM_PREPARACAO: {
    className: 'n4a-badge--muted',
    label: 'Em preparação',
  },
  PROPOSTA_ENVIADA: {
    className: 'n4a-badge--warning',
    label: 'Proposta enviada',
  },
  NEGOCIACAO: { className: 'n4a-badge--magenta', label: 'Negociação' },
  GANHA: { className: 'n4a-badge--success', label: 'Ganha' },
  PERDIDA: { className: 'n4a-badge--danger', label: 'Perdida' },
}

function getStatusMeta(status) {
  return statusMeta[status] || { className: 'n4a-badge--muted', label: status }
}

function formatDate(value) {
  if (!value) {
    return 'Sem data'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Sem data'
  }

  return dateFormatter.format(date)
}

function ClientField({ label, value }) {
  return (
    <div className="client-page__field">
      <dt>{label}</dt>
      <dd>{value || '-'}</dd>
    </div>
  )
}

function buildClientForm(client) {
  return {
    address: client.address || '',
    description: client.description || '',
    email: client.email || '',
    name: client.name || '',
    nif: client.nif || '',
    phone: client.phone || '',
    responsibleName: client.responsibleName || '',
  }
}

function ClientPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clientEditing, setClientEditing] = useState(false)
  const [clientForm, setClientForm] = useState(null)
  const [clientSaving, setClientSaving] = useState(false)
  const [clientEditError, setClientEditError] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadClient() {
      setLoading(true)
      setError('')

      try {
        const { data } = await api.get(`/api/clients/${id}`)

        if (!ignore) {
          setClient({
            ...data,
            opportunities: data.opportunities || [],
          })
        }
      } catch (err) {
        if (err.response?.status !== 404) {
          if (!ignore) {
            setClient(null)
            setError('Não foi possível carregar o cliente.')
          }
          return
        }

        try {
          const [{ data: clients }, { data: opportunities }] = await Promise.all([
            api.get('/api/clients'),
            api.get('/api/opps', { params: { clientId: id } }),
          ])
          const fallbackClient = clients.find((item) => item.id === id)

          if (!fallbackClient) {
            if (!ignore) {
              setClient(null)
              setError('Não foi possível carregar o cliente.')
            }
            return
          }

          if (!ignore) {
            setClient({ ...fallbackClient, opportunities })
          }
        } catch {
          if (!ignore) {
            setClient(null)
            setError('Não foi possível carregar o cliente.')
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadClient()

    return () => {
      ignore = true
    }
  }, [id])

  function openClientEdit() {
    setClientForm(buildClientForm(client))
    setClientEditError('')
    setClientEditing(true)
  }

  function updateClientField(field, value) {
    setClientForm((current) => ({ ...current, [field]: value }))
  }

  async function handleClientSubmit(event) {
    event.preventDefault()
    setClientEditError('')

    const requiredFields = ['email', 'name', 'nif', 'phone', 'responsibleName']

    if (requiredFields.some((field) => !clientForm[field].trim())) {
      setClientEditError('Preenche todos os campos obrigatórios.')
      return
    }

    setClientSaving(true)

    try {
      const { data } = await api.patch(`/api/clients/${id}`, {
        address: clientForm.address.trim() || null,
        description: clientForm.description.trim() || null,
        email: clientForm.email.trim(),
        name: clientForm.name.trim(),
        nif: clientForm.nif.trim(),
        phone: clientForm.phone.trim(),
        responsibleName: clientForm.responsibleName.trim(),
      })

      setClient((current) => ({
        ...current,
        ...data,
        opportunities: current.opportunities || [],
      }))
      setClientEditing(false)
      setClientForm(null)
    } catch {
      setClientEditError('Não foi possível actualizar o cliente.')
    } finally {
      setClientSaving(false)
    }
  }

  if (loading) {
    return <div className="client-page__state">A carregar...</div>
  }

  if (error) {
    return <div className="client-page__error">{error}</div>
  }

  if (!client) {
    return <div className="client-page__state">Sem cliente</div>
  }

  const isAdmin = user?.role === 'ADMIN'
  const clientOpportunities = [...(client.opportunities || [])].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime()
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime()

    return dateB - dateA
  })

  return (
    <section className="client-page">
      <header className="client-page__header">
        <nav className="client-page__breadcrumb" aria-label="Breadcrumb">
          <Link to="/clients">Clientes</Link>
          <span>→</span>
          <span>{client.name}</span>
        </nav>
        <div className="client-page__client-no">{client.clientNo}</div>
      </header>

      <section className="n4a-card">
        <div className="client-page__card-header">
          <h1 className="client-page__title">{client.name}</h1>
          {isAdmin && !clientEditing && (
            <button className="n4a-btn n4a-btn--ghost" onClick={openClientEdit} type="button">
              Editar
            </button>
          )}
        </div>

        {clientEditing && clientForm ? (
          <form className="client-page__form" onSubmit={handleClientSubmit}>
            <div className="client-page__form-grid">
              <label>
                <span className="n4a-label">Nome</span>
                <input
                  className="n4a-input"
                  onChange={(event) => updateClientField('name', event.target.value)}
                  required
                  value={clientForm.name}
                />
              </label>
              <label>
                <span className="n4a-label">NIF</span>
                <input
                  className="n4a-input"
                  onChange={(event) => updateClientField('nif', event.target.value)}
                  required
                  value={clientForm.nif}
                />
              </label>
              <label>
                <span className="n4a-label">Responsável</span>
                <input
                  className="n4a-input"
                  onChange={(event) =>
                    updateClientField('responsibleName', event.target.value)
                  }
                  required
                  value={clientForm.responsibleName}
                />
              </label>
              <label>
                <span className="n4a-label">Email</span>
                <input
                  className="n4a-input"
                  onChange={(event) => updateClientField('email', event.target.value)}
                  required
                  type="email"
                  value={clientForm.email}
                />
              </label>
              <label>
                <span className="n4a-label">Telefone</span>
                <input
                  className="n4a-input"
                  onChange={(event) => updateClientField('phone', event.target.value)}
                  required
                  value={clientForm.phone}
                />
              </label>
              <label>
                <span className="n4a-label">Morada</span>
                <input
                  className="n4a-input"
                  onChange={(event) => updateClientField('address', event.target.value)}
                  value={clientForm.address}
                />
              </label>
            </div>

            <label>
              <span className="n4a-label">Descrição</span>
              <textarea
                className="n4a-input client-page__textarea"
                onChange={(event) => updateClientField('description', event.target.value)}
                value={clientForm.description}
              />
            </label>

            {clientEditError && (
              <div className="client-page__form-error">{clientEditError}</div>
            )}

            <div className="client-page__form-actions">
              <button className="n4a-btn n4a-btn--primary" disabled={clientSaving} type="submit">
                {clientSaving ? 'A guardar...' : 'Guardar'}
              </button>
              <button
                className="n4a-btn n4a-btn--ghost"
                disabled={clientSaving}
                onClick={() => {
                  setClientEditing(false)
                  setClientForm(null)
                }}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <dl className="client-page__fields">
              <ClientField label="NIF" value={client.nif} />
              <ClientField label="Responsável" value={client.responsibleName} />
              <ClientField label="Email" value={client.email} />
              <ClientField label="Telefone" value={client.phone} />
            </dl>

            {(client.address || client.description) && (
              <div className="client-page__notes">
                {client.address && (
                  <div>
                    <span>Morada</span>
                    <p>{client.address}</p>
                  </div>
                )}
                {client.description && (
                  <div>
                    <span>Descrição</span>
                    <p>{client.description}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="n4a-card client-page__opps-card">
        <h2 className="client-page__section-title">Oportunidades do cliente</h2>
        {clientOpportunities.length ? (
          <table className="n4a-table client-page__opps-table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Tipo</th>
                <th>Venda estimada</th>
                <th>Venda final</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {clientOpportunities.map((opp) => {
                const meta = getStatusMeta(opp.status)
                const finalSellPrice = Number(opp.finalSellPrice || 0)

                return (
                  <tr key={opp.id}>
                    <td>
                      <button
                        className="client-page__opp-link"
                        onClick={() => navigate(`/opps/${opp.id}`)}
                        type="button"
                      >
                        {opp.oppNo}
                      </button>
                    </td>
                    <td>{opp.title || '—'}</td>
                    <td>
                      <span className={`n4a-badge ${meta.className}`}>{meta.label}</span>
                    </td>
                    <td>{opp.saleType}</td>
                    <td>{moneyFormatter.format(opp.estSellPrice || 0)}</td>
                    <td>{finalSellPrice > 0 ? moneyFormatter.format(finalSellPrice) : '—'}</td>
                    <td>{formatDate(opp.updatedAt || opp.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="client-page__state">Sem oportunidades</div>
        )}
      </section>
    </section>
  )
}

export default ClientPage
