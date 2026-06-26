import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import NewOppModal from '../components/NewOppModal.jsx'
import './PipelinePage.css'

const statusOptions = [
  { label: 'Todos os estados', value: '' },
  { label: 'Aberta', value: 'ABERTA' },
  { label: 'Em preparação', value: 'PROPOSTA_EM_PREPARACAO' },
  { label: 'Proposta enviada', value: 'PROPOSTA_ENVIADA' },
  { label: 'Negociação', value: 'NEGOCIACAO' },
  { label: 'Ganha', value: 'GANHA' },
  { label: 'Perdida', value: 'PERDIDA' },
]

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

const moneyFormatter = new Intl.NumberFormat('pt-PT', {
  currency: 'EUR',
  style: 'currency',
})

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

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

function formatMargin(value) {
  const margin = Number(value || 0)

  return `${margin.toFixed(1)}%`
}

function getStatusMeta(status) {
  return statusMeta[status] || { className: 'n4a-badge--muted', label: status }
}

function PipelinePage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let ignore = false

    async function loadOpportunities() {
      setLoading(true)
      setError('')

      try {
        const params = {}

        if (status) {
          params.status = status
        }

        if (!showArchived) {
          params.archived = false
        }

        const { data } = await api.get('/api/opps', { params })

        if (!ignore) {
          setOpportunities(data)
        }
      } catch {
        if (!ignore) {
          setError('Não foi possível carregar o pipeline.')
          setOpportunities([])
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadOpportunities()

    return () => {
      ignore = true
    }
  }, [refreshKey, showArchived, status])

  return (
    <section className="pipeline-page">
      <header className="pipeline-page__header">
        <div>
          <h1 className="pipeline-page__title">Pipeline</h1>
          <p className="pipeline-page__count">
            {opportunities.length} resultado{opportunities.length === 1 ? '' : 's'}
          </p>
        </div>

        <button
          className="n4a-btn n4a-btn--primary"
          onClick={() => setIsCreateModalOpen(true)}
          type="button"
        >
          + Nova oportunidade
        </button>
      </header>

      <div className="pipeline-page__filters">
        <div className="pipeline-page__filter">
          <label className="n4a-label" htmlFor="pipeline-status">
            Estado
          </label>
          <select
            className="n4a-input"
            id="pipeline-status"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            {statusOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <label className="pipeline-page__archive-toggle">
          <input
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            type="checkbox"
          />
          <span>Mostrar arquivadas</span>
        </label>
      </div>

      <div className="pipeline-page__list" aria-live="polite">
        {loading && <div className="pipeline-page__state">A carregar...</div>}

        {!loading && error && <div className="pipeline-page__error">{error}</div>}

        {!loading && !error && opportunities.length === 0 && (
          <div className="pipeline-page__state">Sem oportunidades</div>
        )}

        {!loading &&
          !error &&
          opportunities.map((opp) => {
            const meta = getStatusMeta(opp.status)

            return (
              <button
                className="pipeline-card"
                key={opp.id}
                onClick={() => navigate(`/opps/${opp.id}`)}
                type="button"
              >
                <div className="pipeline-card__top">
                  <div className="pipeline-card__identity">
                    <span className="pipeline-card__number">{opp.oppNo}</span>
                    {opp.title && (
                      <span className="pipeline-card__title">{opp.title}</span>
                    )}
                    <span className="pipeline-card__client">
                      {opp.client?.name || 'Cliente sem nome'}
                    </span>
                  </div>
                  <span className={`n4a-badge ${meta.className}`}>{meta.label}</span>
                </div>

                <div className="pipeline-card__meta">
                  <span>{opp.seller?.name || 'Sem vendedor'}</span>
                  <span>{opp.saleType}</span>
                </div>

                <div className="pipeline-card__financials">
                  <span>{moneyFormatter.format(opp.estSellPrice || 0)}</span>
                  <span>Margem {formatMargin(opp.estGrossMarginPct)}</span>
                  <span>{formatDate(opp.expectedCloseDate)}</span>
                </div>
              </button>
            )
          })}
      </div>

      {isCreateModalOpen && (
        <NewOppModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </section>
  )
}

export default PipelinePage
