import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import NewClientModal from '../components/NewClientModal.jsx'
import './ClientsPage.css'

function ClientsPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newClientOpen, setNewClientOpen] = useState(false)

  useEffect(() => {
    let ignore = false

    async function loadClients() {
      setLoading(true)
      setError('')

      try {
        const { data } = await api.get('/api/clients')

        if (!ignore) {
          setClients(data)
        }
      } catch {
        if (!ignore) {
          setClients([])
          setError('Não foi possível carregar os clientes.')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadClients()

    return () => {
      ignore = true
    }
  }, [])

  if (loading) {
    return <div className="clients-page__state">A carregar...</div>
  }

  if (error) {
    return <div className="clients-page__error">{error}</div>
  }

  return (
    <section className="clients-page">
      <header className="clients-page__header">
        <div>
          <h1 className="clients-page__title">Clientes</h1>
          <p className="clients-page__count">
            {clients.length} resultado{clients.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          className="n4a-btn n4a-btn--primary"
          onClick={() => setNewClientOpen(true)}
          type="button"
        >
          + Novo cliente
        </button>
      </header>

      <div className="n4a-card clients-page__table-card">
        {clients.length ? (
          <table className="n4a-table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Nome</th>
                <th>NIF</th>
                <th>Responsável</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>Acções</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.clientNo}</td>
                  <td>{client.name}</td>
                  <td>{client.nif}</td>
                  <td>{client.responsibleName}</td>
                  <td>{client.email}</td>
                  <td>{client.phone}</td>
                  <td>
                    <button
                      className="n4a-btn n4a-btn--ghost clients-page__action"
                      onClick={() => navigate(`/clients/${client.id}`)}
                      type="button"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="clients-page__state">Sem clientes</div>
        )}
      </div>

      {newClientOpen && (
        <NewClientModal
          onClose={() => setNewClientOpen(false)}
          onCreated={(client) =>
            setClients((currentClients) =>
              [...currentClients, client].sort((a, b) =>
                a.clientNo.localeCompare(b.clientNo),
              ),
            )
          }
        />
      )}
    </section>
  )
}

export default ClientsPage
