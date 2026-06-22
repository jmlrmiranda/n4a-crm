import { useEffect, useState } from 'react'
import api from '../api/client.js'
import './DashboardPage.css'

const moneyFormatter = new Intl.NumberFormat('pt-PT', {
  currency: 'EUR',
  style: 'currency',
})

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0))
}

function formatPct(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

function formatCount(value, singular, plural) {
  const count = Number(value || 0)

  return `${count} ${count === 1 ? singular : plural}`
}

function DashboardPage() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadDashboard() {
      setLoading(true)
      setError('')

      try {
        const { data } = await api.get('/api/dashboard')

        if (!ignore) {
          setDashboard(data)
        }
      } catch {
        if (!ignore) {
          setDashboard(null)
          setError('Não foi possível carregar o dashboard.')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      ignore = true
    }
  }, [])

  if (loading) {
    return <div className="dashboard-page__state">A carregar...</div>
  }

  if (error) {
    return <div className="dashboard-page__error">{error}</div>
  }

  if (!dashboard) {
    return <div className="dashboard-page__state">Sem dados</div>
  }

  return (
    <section className="dashboard-page">
      <header className="dashboard-page__header">
        <div>
          <h1 className="dashboard-page__title">Dashboard</h1>
          <p className="dashboard-page__period">Período {dashboard.period}</p>
        </div>
      </header>

      <div className="dashboard-page__kpis">
        <article className="n4a-metric">
          <div className="n4a-metric__value">{formatMoney(dashboard.pipeline_total)}</div>
          <div className="n4a-metric__label">Pipeline activo</div>
          <div className="dashboard-page__metric-sub">
            {formatCount(dashboard.pipeline_count, 'oportunidade', 'oportunidades')}
          </div>
        </article>

        <article className="n4a-metric">
          <div
            className="n4a-metric__value"
            style={{ color: 'var(--n4a-success)' }}
          >
            {formatMoney(dashboard.won_revenue)}
          </div>
          <div className="n4a-metric__label">Receita ganha</div>
          <div className="dashboard-page__metric-sub">
            {formatCount(dashboard.won_count, 'negócio fechado', 'negócios fechados')}
          </div>
        </article>

        <article className="n4a-metric">
          <div className="n4a-metric__value">{formatMoney(dashboard.won_margin)}</div>
          <div className="n4a-metric__label">Margem efectiva</div>
          <div className="dashboard-page__metric-sub">
            {formatPct(dashboard.won_margin_pct)} sobre receita ganha
          </div>
        </article>

        <article className="n4a-metric">
          <div className="n4a-metric__value">{formatPct(dashboard.win_rate)}</div>
          <div className="n4a-metric__label">Win rate</div>
          <div className="dashboard-page__metric-sub">
            {formatCount(dashboard.lost_count, 'negócio perdido', 'negócios perdidos')}
          </div>
        </article>
      </div>

      <section className="dashboard-page__forecast n4a-card">
        <div>
          <h2 className="dashboard-page__section-title">Forecast ponderado</h2>
          <p className="dashboard-page__section-subtitle">Próximos 90 dias</p>
        </div>
        <div className="dashboard-page__forecast-grid">
          <div>
            <strong>{formatMoney(dashboard.forecast?.next_30)}</strong>
            <span>30 dias</span>
          </div>
          <div>
            <strong>{formatMoney(dashboard.forecast?.next_60)}</strong>
            <span>60 dias</span>
          </div>
          <div>
            <strong>{formatMoney(dashboard.forecast?.next_90)}</strong>
            <span>90 dias</span>
          </div>
        </div>
      </section>

      <div className="dashboard-page__tables">
        <section className="n4a-card dashboard-page__table-card">
          <h2 className="dashboard-page__section-title">Por vendedor</h2>
          {dashboard.by_seller?.length ? (
            <table className="n4a-table dashboard-page__table">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Pipeline</th>
                  <th>Receita</th>
                  <th>Margem</th>
                  <th>Win rate</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.by_seller.map((seller) => (
                  <tr key={seller.seller_id}>
                    <td>{seller.seller_name || 'Sem vendedor'}</td>
                    <td>{formatMoney(seller.pipeline_total)}</td>
                    <td>{formatMoney(seller.won_revenue)}</td>
                    <td>{formatMoney(seller.won_margin)}</td>
                    <td>{formatPct(seller.win_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="dashboard-page__empty">Sem vendedores</div>
          )}
        </section>

        <section className="n4a-card dashboard-page__table-card">
          <h2 className="dashboard-page__section-title">Por tipo</h2>
          {dashboard.by_type?.length ? (
            <table className="n4a-table dashboard-page__table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Pipeline</th>
                  <th>Receita</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.by_type.map((type) => (
                  <tr key={type.sale_type}>
                    <td>{type.sale_type}</td>
                    <td>{formatMoney(type.pipeline_total)}</td>
                    <td>{formatMoney(type.won_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="dashboard-page__empty">Sem tipos</div>
          )}
        </section>
      </div>
    </section>
  )
}

export default DashboardPage
