import { useEffect, useState } from 'react'
import api from '../api/client.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import './NewOppModal.css'

function NewOppModal({ onClose, onCreated }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [clients, setClients] = useState([])
  const [users, setUsers] = useState([])
  const [clientId, setClientId] = useState('')
  const [saleType, setSaleType] = useState('PROJETO')
  const [sellerUserId, setSellerUserId] = useState('')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadFormData() {
      setLoading(true)
      setError('')

      try {
        const requests = [api.get('/api/clients')]

        if (isAdmin) {
          requests.push(api.get('/api/users'))
        }

        const [clientsResponse, usersResponse] = await Promise.all(requests)
        const nextClients = clientsResponse.data || []
        const nextUsers = usersResponse?.data || []

        if (!ignore) {
          setClients(nextClients)
          setUsers(nextUsers)
          setClientId(nextClients[0]?.id || '')
          setSellerUserId(
            nextUsers.find((nextUser) => nextUser.isActive)?.id || nextUsers[0]?.id || '',
          )
        }
      } catch {
        if (!ignore) {
          setError('Não foi possível carregar os dados do formulário.')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadFormData()

    return () => {
      ignore = true
    }
  }, [isAdmin])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const body = {
        clientId,
        saleType,
      }

      if (expectedCloseDate) {
        body.expectedCloseDate = expectedCloseDate
      }

      if (isAdmin && sellerUserId) {
        body.sellerUserId = sellerUserId
      }

      await api.post('/api/opps', body)
      await onCreated()
      onClose()
    } catch {
      setError('Não foi possível criar a oportunidade.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="new-opp-modal" role="presentation">
      <form
        aria-labelledby="new-opp-title"
        aria-modal="true"
        className="n4a-card new-opp-modal__card"
        onSubmit={handleSubmit}
        role="dialog"
      >
        <h2 className="new-opp-modal__title" id="new-opp-title">
          Nova oportunidade
        </h2>

        {loading ? (
          <div className="new-opp-modal__state">A carregar...</div>
        ) : (
          <>
            <label className="n4a-label" htmlFor="new-opp-client">
              Cliente
            </label>
            <select
              className="n4a-input"
              id="new-opp-client"
              onChange={(event) => setClientId(event.target.value)}
              required
              value={clientId}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.clientNo} · {client.name}
                </option>
              ))}
            </select>

            <label className="n4a-label new-opp-modal__label" htmlFor="new-opp-type">
              Tipo de venda
            </label>
            <select
              className="n4a-input"
              id="new-opp-type"
              onChange={(event) => setSaleType(event.target.value)}
              value={saleType}
            >
              <option value="PROJETO">Projecto</option>
              <option value="SUBSCRICAO">Subscrição</option>
            </select>

            {isAdmin && (
              <>
                <label
                  className="n4a-label new-opp-modal__label"
                  htmlFor="new-opp-seller"
                >
                  Vendedor
                </label>
                <select
                  className="n4a-input"
                  id="new-opp-seller"
                  onChange={(event) => setSellerUserId(event.target.value)}
                  required
                  value={sellerUserId}
                >
                  {users.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name} · {seller.role}
                    </option>
                  ))}
                </select>
              </>
            )}

            <label className="n4a-label new-opp-modal__label" htmlFor="new-opp-close">
              Data de fecho esperada
            </label>
            <input
              className="n4a-input"
              id="new-opp-close"
              onChange={(event) => setExpectedCloseDate(event.target.value)}
              type="date"
              value={expectedCloseDate}
            />
          </>
        )}

        {error && <div className="new-opp-modal__error">{error}</div>}

        <div className="new-opp-modal__actions">
          <button
            className="n4a-btn n4a-btn--ghost"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="n4a-btn n4a-btn--primary"
            disabled={loading || submitting || !clientId || (isAdmin && !sellerUserId)}
            type="submit"
          >
            {submitting ? 'A criar...' : 'Criar'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default NewOppModal
