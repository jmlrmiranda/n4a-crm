import { useState } from 'react'
import api from '../api/client.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import './NewOppModal.css'

function ChangePasswordModal({ onClose, userId, userName }) {
  const { logout, user } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const isSelf = Boolean(user?.id && user.id === userId)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 8) {
      setError('A password deve ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As passwords não coincidem.')
      return
    }

    setSubmitting(true)

    try {
      await api.patch(`/api/users/${userId}/password`, { password })

      if (isSelf) {
        setSuccess('Password alterada. Por segurança, vai iniciar sessão novamente.')
        setTimeout(() => {
          logout()
          window.location.href = '/login'
        }, 900)
        return
      }

      setSuccess('Password actualizada')
      setTimeout(onClose, 700)
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Sem permissão para alterar esta password.')
      } else if (err.response?.status === 404) {
        setError('Utilizador não encontrado.')
      } else {
        setError('Não foi possível alterar a password.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="new-opp-modal" role="presentation">
      <form
        aria-labelledby="change-password-title"
        aria-modal="true"
        className="n4a-card new-opp-modal__card"
        onSubmit={handleSubmit}
        role="dialog"
      >
        <h2 className="new-opp-modal__title" id="change-password-title">
          Alterar password — {userName || 'Utilizador'}
        </h2>

        <label className="n4a-label" htmlFor="change-password-new">
          Nova password
        </label>
        <input
          className="n4a-input"
          id="change-password-new"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />

        <label className="n4a-label new-opp-modal__label" htmlFor="change-password-confirm">
          Confirmar password
        </label>
        <input
          className="n4a-input"
          id="change-password-confirm"
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          type="password"
          value={confirmPassword}
        />

        {error && <div className="new-opp-modal__error">{error}</div>}
        {success && (
          <div className="new-opp-modal__error" style={{ color: 'var(--n4a-success)' }}>
            {success}
          </div>
        )}

        <div className="new-opp-modal__actions">
          <button
            className="n4a-btn n4a-btn--ghost"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button className="n4a-btn n4a-btn--primary" disabled={submitting} type="submit">
            {submitting ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChangePasswordModal
