import { useState } from 'react'
import api from '../api/client.js'
import './NewOppModal.css'

const initialForm = {
  email: '',
  name: '',
  password: '',
  role: 'VENDEDOR',
}

function NewUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const { data } = await api.post('/api/users', {
        email: form.email.trim(),
        name: form.name.trim(),
        password: form.password,
        role: form.role,
      })

      await Promise.resolve(onCreated(data))
      onClose()
    } catch {
      setError('Não foi possível criar o utilizador.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="new-opp-modal" role="presentation">
      <form
        aria-labelledby="new-user-title"
        aria-modal="true"
        className="n4a-card new-opp-modal__card"
        onSubmit={handleSubmit}
        role="dialog"
      >
        <h2 className="new-opp-modal__title" id="new-user-title">
          Novo utilizador
        </h2>

        <label className="n4a-label" htmlFor="new-user-name">
          Nome
        </label>
        <input
          className="n4a-input"
          id="new-user-name"
          onChange={(event) => updateField('name', event.target.value)}
          required
          value={form.name}
        />

        <label className="n4a-label new-opp-modal__label" htmlFor="new-user-email">
          Email
        </label>
        <input
          className="n4a-input"
          id="new-user-email"
          onChange={(event) => updateField('email', event.target.value)}
          required
          type="email"
          value={form.email}
        />

        <label className="n4a-label new-opp-modal__label" htmlFor="new-user-password">
          Password
        </label>
        <input
          className="n4a-input"
          id="new-user-password"
          onChange={(event) => updateField('password', event.target.value)}
          required
          type="password"
          value={form.password}
        />

        <label className="n4a-label new-opp-modal__label" htmlFor="new-user-role">
          Role
        </label>
        <select
          className="n4a-input"
          id="new-user-role"
          onChange={(event) => updateField('role', event.target.value)}
          value={form.role}
        >
          <option value="ADMIN">Admin</option>
          <option value="VENDEDOR">Vendedor</option>
        </select>

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
          <button className="n4a-btn n4a-btn--primary" disabled={submitting} type="submit">
            {submitting ? 'A criar...' : 'Criar'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default NewUserModal
