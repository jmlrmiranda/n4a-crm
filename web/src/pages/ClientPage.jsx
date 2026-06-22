import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client.js'
import './ClientPage.css'

const moneyFormatter = new Intl.NumberFormat('pt-PT', {
  currency: 'EUR',
  style: 'currency',
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

function ClientField({ label, value }) {
  return (
    <div className="client-page__field">
      <dt>{label}</dt>
      <dd>{value || '-'}</dd>
    </div>
  )
}

function ClientPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  if (loading) {
    return <div className="client-page__state">A carregar...</div>
  }

  if (error) {
    return <div className="client-page__error">{error}</div>
  }

  if (!client) {
    return <div className="client-page__state">Sem cliente</div>
  }

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
        <h1 className="client-page__title">{client.name}</h1>
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
      </section>

      <section className="n4a-card client-page__opps-card">
        <h2 className="client-page__section-title">Oportunidades do cliente</h2>
        {client.opportunities?.length ? (
          <div className="client-page__opps">
            {client.opportunities.map((opp) => {
              const meta = getStatusMeta(opp.status)

              return (
                <button
                  className="client-page__opp-row"
                  key={opp.id}
                  onClick={() => navigate(`/opps/${opp.id}`)}
                  type="button"
                >
                  <span className="client-page__opp-no">{opp.oppNo}</span>
                  <span className={`n4a-badge ${meta.className}`}>{meta.label}</span>
                  <span>{opp.saleType}</span>
                  <strong>{moneyFormatter.format(opp.estSellPrice || 0)}</strong>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="client-page__state">Sem oportunidades</div>
        )}
      </section>
    </section>
  )
}

export default ClientPage
