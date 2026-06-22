import { useState } from 'react'
import api from '../api/client.js'
import './NewOppModal.css'

const initialForm = {
  address: '',
  description: '',
  email: '',
  name: '',
  nif: '',
  phone: '',
  responsibleName: '',
}

function NewClientModal({ onClose, onCreated }) {
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
      const { data } = await api.post('/api/clients', {
        address: form.address.trim() || undefined,
        description: form.description.trim() || undefined,
        email: form.email.trim(),
        name: form.name.trim(),
        nif: form.nif.trim(),
        phone: form.phone.trim(),
        responsibleName: form.responsibleName.trim(),
      })

      await Promise.resolve(onCreated(data))
      onClose()
    } catch {
      setError('Não foi possível criar o cliente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="new-opp-modal" role="presentation">
      <form
        aria-labelledby="new-client-title"
        aria-modal="true"
        className="n4a-card new-opp-modal__card"
        onSubmit={handleSubmit}
        role="dialog"
      >
        <h2 className="new-opp-modal__title" id="new-client-title">
          Novo cliente
        </h2>

        <label className="n4a-label" htmlFor="new-client-name">
          Nome
        </label>
        <input
          className="n4a-input"
          id="new-client-name"
          onChange={(event) => updateField('name', event.target.value)}
          required
          value={form.name}
        />

        <label className="n4a-label new-opp-modal__label" htmlFor="new-client-nif">
          NIF
        </label>
        <input
          className="n4a-input"
          id="new-client-nif"
          onChange={(event) => updateField('nif', event.target.value)}
          required
          value={form.nif}
        />

        <label className="n4a-label new-opp-modal__label" htmlFor="new-client-responsible">
          Responsável
        </label>
        <input
          className="n4a-input"
          id="new-client-responsible"
          onChange={(event) => updateField('responsibleName', event.target.value)}
          required
          value={form.responsibleName}
        />

        <label className="n4a-label new-opp-modal__label" htmlFor="new-client-email">
          Email
        </label>
        <input
          className="n4a-input"
          id="new-client-email"
          onChange={(event) => updateField('email', event.target.value)}
          required
          type="email"
          value={form.email}
        />

        <label className="n4a-label new-opp-modal__label" htmlFor="new-client-phone">
          Telefone
        </label>
        <input
          className="n4a-input"
          id="new-client-phone"
          onChange={(event) => updateField('phone', event.target.value)}
          required
          value={form.phone}
        />

        <label className="n4a-label new-opp-modal__label" htmlFor="new-client-address">
          Morada
        </label>
        <input
          className="n4a-input"
          id="new-client-address"
          onChange={(event) => updateField('address', event.target.value)}
          value={form.address}
        />

        <label className="n4a-label new-opp-modal__label" htmlFor="new-client-description">
          Descrição
        </label>
        <textarea
          className="n4a-input new-opp-modal__textarea"
          id="new-client-description"
          onChange={(event) => updateField('description', event.target.value)}
          value={form.description}
        />

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

export default NewClientModal
