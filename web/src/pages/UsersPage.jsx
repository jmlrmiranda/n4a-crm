import { useEffect, useState } from 'react'
import api from '../api/client.js'
import ChangePasswordModal from '../components/ChangePasswordModal.jsx'
import NewUserModal from '../components/NewUserModal.jsx'
import './UsersPage.css'

function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingUserId, setUpdatingUserId] = useState('')
  const [newUserOpen, setNewUserOpen] = useState(false)
  const [passwordTargetUser, setPasswordTargetUser] = useState(null)

  useEffect(() => {
    let ignore = false

    async function loadUsers() {
      setLoading(true)
      setError('')

      try {
        const { data } = await api.get('/api/users')

        if (!ignore) {
          setUsers(data)
        }
      } catch {
        if (!ignore) {
          setUsers([])
          setError('Não foi possível carregar os utilizadores.')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadUsers()

    return () => {
      ignore = true
    }
  }, [])

  async function toggleUser(user) {
    setUpdatingUserId(user.id)
    setError('')

    try {
      const { data } = await api.patch(`/api/users/${user.id}`, {
        isActive: !user.isActive,
      })

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id ? data : currentUser,
        ),
      )
    } catch {
      setError('Não foi possível actualizar o utilizador.')
    } finally {
      setUpdatingUserId('')
    }
  }

  if (loading) {
    return <div className="users-page__state">A carregar...</div>
  }

  if (error && users.length === 0) {
    return <div className="users-page__error">{error}</div>
  }

  return (
    <section className="users-page">
      <header className="users-page__header">
        <h1 className="users-page__title">Utilizadores</h1>
        <button
          className="n4a-btn n4a-btn--primary"
          onClick={() => setNewUserOpen(true)}
          type="button"
        >
          + Novo utilizador
        </button>
      </header>

      {error && <div className="users-page__error">{error}</div>}

      <div className="n4a-card users-page__table-card">
        {users.length ? (
          <table className="n4a-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Role</th>
                <th>Activo</th>
                <th>Acções</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span
                      className={`n4a-badge ${
                        user.role === 'ADMIN'
                          ? 'n4a-badge--magenta'
                          : 'n4a-badge--muted'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        user.isActive
                          ? 'users-page__active'
                          : 'users-page__inactive'
                      }
                    >
                      {user.isActive ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td>
                    <div className="users-page__actions">
                      <button
                        className="n4a-btn n4a-btn--ghost users-page__action"
                        disabled={updatingUserId === user.id}
                        onClick={() => setPasswordTargetUser(user)}
                        type="button"
                      >
                        Password
                      </button>
                      <button
                        className="n4a-btn n4a-btn--ghost users-page__action"
                        disabled={updatingUserId === user.id}
                        onClick={() => toggleUser(user)}
                        type="button"
                      >
                        {user.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="users-page__state">Sem utilizadores</div>
        )}
      </div>

      {newUserOpen && (
        <NewUserModal
          onClose={() => setNewUserOpen(false)}
          onCreated={(user) =>
            setUsers((currentUsers) =>
              [...currentUsers, user].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
              ),
            )
          }
        />
      )}

      {passwordTargetUser && (
        <ChangePasswordModal
          onClose={() => setPasswordTargetUser(null)}
          userId={passwordTargetUser.id}
          userName={passwordTargetUser.name}
        />
      )}
    </section>
  )
}

export default UsersPage
