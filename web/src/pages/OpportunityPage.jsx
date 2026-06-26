import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import './OpportunityPage.css'

const moneyFormatter = new Intl.NumberFormat('pt-PT', {
  currency: 'EUR',
  style: 'currency',
})

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
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

const statusTransitions = {
  ABERTA: ['PROPOSTA_EM_PREPARACAO', 'PERDIDA'],
  PROPOSTA_EM_PREPARACAO: ['PROPOSTA_ENVIADA', 'PERDIDA'],
  PROPOSTA_ENVIADA: ['NEGOCIACAO', 'PERDIDA'],
  NEGOCIACAO: ['PERDIDA'],
}

const contactChannels = ['Reunião', 'Telefone', 'Email', 'Outro']

const pipelineFinancialFields = [
  'estServices',
  'estSoftware',
  'estHardware',
  'estMaintenance',
  'estCostPrice',
]

const finalSaleFinancialFields = [
  'finalServices',
  'finalSoftware',
  'finalHardware',
  'finalMaintenance',
]

const finalFinancialFields = [
  ...finalSaleFinancialFields,
  'realCostPrice',
]

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0))
}

function formatPct(value) {
  return `${Number(value || 0).toFixed(1)}%`
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

function formatDateTime(value) {
  if (!value) {
    return 'Sem data'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Sem data'
  }

  return dateTimeFormatter.format(date)
}

function getStatusMeta(status) {
  return statusMeta[status] || { className: 'n4a-badge--muted', label: status }
}

function getTodayInputValue() {
  return toDateInputValue(new Date())
}

function toDateInputValue(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}

function getFinancialValue(value) {
  return String(Number(value || 0))
}

function buildFinancialForm(opportunity) {
  return [...pipelineFinancialFields, ...finalFinancialFields].reduce((form, field) => {
    form[field] = getFinancialValue(opportunity[field])
    return form
  }, {})
}

function buildAdjudicationForm(opportunity) {
  return {
    billingStartDate: toDateInputValue(opportunity.billingStartDate) || getTodayInputValue(),
    finalHardware: getFinancialValue(opportunity.estHardware),
    finalMaintenance: getFinancialValue(opportunity.estMaintenance),
    finalServices: getFinancialValue(opportunity.estServices),
    finalSoftware: getFinancialValue(opportunity.estSoftware),
  }
}

function parseFinancialInput(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return null
  }

  return number
}

function hasFinalFinancialValues(opportunity) {
  return finalFinancialFields.some((field) => Number(opportunity[field] || 0) > 0)
}

function shouldEditFinalFinancials(opportunity) {
  return opportunity.status === 'GANHA' || hasFinalFinancialValues(opportunity)
}

function sumFinancialFields(form, fields) {
  return fields.reduce((total, field) => total + Number(form[field] || 0), 0)
}

function calcMarginPct(sellPrice, margin) {
  if (!sellPrice) {
    return 0
  }

  return (margin / sellPrice) * 100
}

function FinancialRow({ label, value }) {
  return (
    <div className="opportunity-page__finance-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function FinancialInputRow({ label, onChange, value }) {
  return (
    <label className="opportunity-page__finance-input-row">
      <span>{label}</span>
      <input
        className="n4a-input"
        min="0"
        onChange={(event) => onChange(event.target.value)}
        required
        step="0.01"
        type="number"
        value={value}
      />
    </label>
  )
}

function OpportunityPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [opportunity, setOpportunity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [transitionOpen, setTransitionOpen] = useState(false)
  const [transitionForm, setTransitionForm] = useState({
    lossReason: '',
    note: '',
    toStatus: '',
  })
  const [transitionError, setTransitionError] = useState('')
  const [transitionSaving, setTransitionSaving] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({
    channel: 'Reunião',
    date: getTodayInputValue(),
    note: '',
  })
  const [contactError, setContactError] = useState('')
  const [contactSaving, setContactSaving] = useState(false)
  const [financeEditing, setFinanceEditing] = useState(false)
  const [financialForm, setFinancialForm] = useState(null)
  const [financialError, setFinancialError] = useState('')
  const [financialSaving, setFinancialSaving] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadForm, setUploadForm] = useState({ file: null, type: 'PROPOSTA' })
  const [uploadError, setUploadError] = useState('')
  const [uploadSaving, setUploadSaving] = useState(false)
  const [adjudicatingAttachmentId, setAdjudicatingAttachmentId] = useState('')
  const [deadjudicatingAttachmentId, setDeadjudicatingAttachmentId] = useState('')
  const [adjudicationTarget, setAdjudicationTarget] = useState(null)
  const [adjudicationForm, setAdjudicationForm] = useState(null)
  const [adjudicateError, setAdjudicateError] = useState('')
  const [archiveSaving, setArchiveSaving] = useState(false)
  const [archiveError, setArchiveError] = useState('')
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleForm, setTitleForm] = useState('')
  const [titleError, setTitleError] = useState('')
  const [titleSaving, setTitleSaving] = useState(false)
  const [similarOpps, setSimilarOpps] = useState([])
  const [similarLoading, setSimilarLoading] = useState(true)
  const [similarError, setSimilarError] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadOpportunity() {
      setLoading(true)
      setError('')
      setSimilarLoading(true)
      setSimilarError('')
      setSimilarOpps([])

      try {
        const { data } = await api.get(`/api/opps/${id}`)

        if (!ignore) {
          setOpportunity(data)
        }

        try {
          const { data: similarData } = await api.get(`/api/opps/${id}/similar`)

          if (!ignore) {
            setSimilarOpps(similarData || [])
            setSimilarError('')
          }
        } catch {
          if (!ignore) {
            setSimilarOpps([])
            setSimilarError('Não foi possível carregar as propostas anteriores.')
          }
        }
      } catch {
        if (!ignore) {
          setOpportunity(null)
          setError('Não foi possível carregar a oportunidade.')
          setSimilarOpps([])
        }
      } finally {
        if (!ignore) {
          setLoading(false)
          setSimilarLoading(false)
        }
      }
    }

    loadOpportunity()

    return () => {
      ignore = true
    }
  }, [id])

  async function refreshOpportunity() {
    const { data } = await api.get(`/api/opps/${id}`)
    setOpportunity(data)
    return data
  }

  function openTitleEdit() {
    setTitleForm(opportunity.title || '')
    setTitleError('')
    setTitleEditing(true)
  }

  async function handleTitleSubmit(event) {
    event.preventDefault()
    setTitleError('')
    setTitleSaving(true)

    try {
      const { data } = await api.patch(`/api/opps/${id}`, {
        title: titleForm.trim() || null,
      })

      setOpportunity(data)
      setTitleEditing(false)
    } catch {
      setTitleError('Não foi possível guardar o título.')
    } finally {
      setTitleSaving(false)
    }
  }

  function openTransitionPanel() {
    const options = statusTransitions[opportunity.status] || []

    setTransitionForm({
      lossReason: '',
      note: '',
      toStatus: options[0] || '',
    })
    setTransitionError('')
    setTransitionOpen(true)
  }

  async function handleTransitionSubmit(event) {
    event.preventDefault()
    setTransitionError('')

    if (!transitionForm.toStatus) {
      setTransitionError('Escolhe o próximo estado.')
      return
    }

    if (transitionForm.toStatus === 'PERDIDA' && !transitionForm.lossReason.trim()) {
      setTransitionError('Indica o motivo de perda.')
      return
    }

    setTransitionSaving(true)

    try {
      await api.post(`/api/opps/${id}/status`, {
        lossReason:
          transitionForm.toStatus === 'PERDIDA' ? transitionForm.lossReason.trim() : undefined,
        note: transitionForm.note.trim() || undefined,
        toStatus: transitionForm.toStatus,
      })
      await refreshOpportunity()
      setTransitionOpen(false)
    } catch {
      setTransitionError('Não foi possível avançar o estado.')
    } finally {
      setTransitionSaving(false)
    }
  }

  function openContactForm() {
    setContactForm({
      channel: 'Reunião',
      date: getTodayInputValue(),
      note: '',
    })
    setContactError('')
    setContactOpen(true)
  }

  async function handleContactSubmit(event) {
    event.preventDefault()
    setContactError('')

    if (!contactForm.date || !contactForm.note.trim()) {
      setContactError('Data e nota são obrigatórias.')
      return
    }

    setContactSaving(true)

    try {
      const { data } = await api.post(`/api/opps/${id}/contacts`, {
        channel: contactForm.channel,
        date: contactForm.date,
        note: contactForm.note.trim(),
      })

      setOpportunity((current) => {
        const contacts = [...(current.contacts || []), data].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        )

        return { ...current, contacts }
      })
      setContactOpen(false)
    } catch {
      setContactError('Não foi possível guardar o contacto.')
    } finally {
      setContactSaving(false)
    }
  }

  function openFinancialEdit() {
    setFinancialForm(buildFinancialForm(opportunity))
    setFinancialError('')
    setFinanceEditing(true)
  }

  function updateFinancialField(field, value) {
    setFinancialForm((current) => ({ ...current, [field]: value }))
  }

  async function handleFinancialSubmit(event) {
    event.preventDefault()
    setFinancialError('')

    const editableFields = [
      ...pipelineFinancialFields,
      ...(shouldEditFinalFinancials(opportunity)
        ? opportunity.status === 'GANHA'
          ? ['realCostPrice']
          : finalFinancialFields
        : []),
    ]
    const payload = {}

    for (const field of editableFields) {
      const number = parseFinancialInput(financialForm[field])

      if (number === null) {
        setFinancialError('Confirma os valores financeiros.')
        return
      }

      payload[field] = number
    }

    setFinancialSaving(true)

    try {
      const { data } = await api.patch(`/api/opps/${id}`, payload)
      setOpportunity(data)
      setFinanceEditing(false)
      setFinancialForm(null)
    } catch {
      setFinancialError('Não foi possível guardar os valores.')
    } finally {
      setFinancialSaving(false)
    }
  }

  function openUploadForm() {
    setUploadForm({ file: null, type: opportunity.status === 'GANHA' ? 'COMPRA' : 'PROPOSTA' })
    setUploadError('')
    setUploadOpen(true)
  }

  async function handleUploadSubmit(event) {
    event.preventDefault()
    setUploadError('')
    setAdjudicateError('')

    if (!uploadForm.file) {
      setUploadError('Escolhe um ficheiro PDF.')
      return
    }

    if (uploadForm.type === 'PROPOSTA' && opportunity.status === 'GANHA') {
      setUploadError('Desadjudica a oportunidade antes de substituir a proposta.')
      return
    }

    const formData = new FormData()
    formData.append('type', uploadForm.type)
    formData.append('file', uploadForm.file)

    setUploadSaving(true)

    try {
      const { data } = await api.post(`/api/opps/${id}/attachments`, formData)

      setOpportunity((current) => {
        const currentAttachments =
          uploadForm.type === 'PROPOSTA'
            ? (current.attachments || []).filter((attachment) => attachment.type !== 'PROPOSTA')
            : current.attachments || []
        const attachments = [...currentAttachments, data].sort(
          (a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime(),
        )

        return { ...current, attachments }
      })
      setUploadOpen(false)
      setUploadForm({ file: null, type: 'PROPOSTA' })
    } catch (err) {
      if (err.response?.status === 409) {
        setUploadError('Desadjudica a oportunidade antes de substituir a proposta.')
      } else {
        setUploadError('Não foi possível carregar o documento.')
      }
    } finally {
      setUploadSaving(false)
    }
  }

  function openAdjudicationForm(attachment) {
    setAdjudicateError('')
    setAdjudicationTarget(attachment)
    setAdjudicationForm(buildAdjudicationForm(opportunity))
  }

  function closeAdjudicationForm() {
    setAdjudicationTarget(null)
    setAdjudicationForm(null)
  }

  function updateAdjudicationField(field, value) {
    setAdjudicationForm((current) => ({ ...current, [field]: value }))
  }

  async function handleAdjudicationSubmit(event) {
    event.preventDefault()
    setAdjudicateError('')

    if (!adjudicationTarget || !adjudicationForm?.billingStartDate) {
      setAdjudicateError('Preenche a data de início de entrega/facturação.')
      return
    }

    const payload = { billingStartDate: adjudicationForm.billingStartDate }

    for (const field of finalSaleFinancialFields) {
      const number = parseFinancialInput(adjudicationForm[field])

      if (number === null || number < 0) {
        setAdjudicateError('Confirma os valores finais da venda.')
        return
      }

      payload[field] = number
    }

    setAdjudicatingAttachmentId(adjudicationTarget.id)

    try {
      const { data } = await api.patch(
        `/api/opps/${id}/attachments/${adjudicationTarget.id}/adjudicar`,
        payload,
      )

      setOpportunity(data)
      closeAdjudicationForm()
    } catch (err) {
      if (err.response?.status === 403) {
        setAdjudicateError('Sem permissão para adjudicar a proposta.')
      } else if (err.response?.status === 409) {
        setAdjudicateError('A oportunidade já está ganha. Desadjudica antes de voltar a adjudicar.')
      } else {
        setAdjudicateError('Não foi possível adjudicar a proposta.')
      }
    } finally {
      setAdjudicatingAttachmentId('')
    }
  }

  async function handleDeadjudicateAttachment(attachmentId) {
    setAdjudicateError('')
    setDeadjudicatingAttachmentId(attachmentId)

    try {
      const { data } = await api.patch(
        `/api/opps/${id}/attachments/${attachmentId}/desadjudicar`,
      )

      setOpportunity(data)
      closeAdjudicationForm()
    } catch (err) {
      const errorCode = err.response?.data?.error

      if (errorCode === 'desadjudicacao_bloqueada_por_custo_real') {
        setAdjudicateError('Não é possível desadjudicar porque já existe custo real.')
      } else if (errorCode === 'desadjudicacao_bloqueada_por_documentos') {
        setAdjudicateError('Não é possível desadjudicar porque já existem faturas associadas.')
      } else if (err.response?.status === 403) {
        setAdjudicateError('Sem permissão para desadjudicar a proposta.')
      } else {
        setAdjudicateError('Não foi possível desadjudicar a proposta.')
      }
    } finally {
      setDeadjudicatingAttachmentId('')
    }
  }

  async function handleArchiveToggle() {
    setArchiveError('')
    setArchiveSaving(true)

    try {
      const { data } = await api.patch(`/api/opps/${id}`, {
        archived: !opportunity.archived,
      })

      setOpportunity(data)
    } catch {
      setArchiveError('Não foi possível actualizar o arquivo da oportunidade.')
    } finally {
      setArchiveSaving(false)
    }
  }

  async function downloadPdf() {
    try {
      const response = await api.get(`/api/opps/${id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `oportunidade-${opportunity.oppNo}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Não foi possível gerar o PDF.')
    }
  }

  if (loading) {
    return <div className="opportunity-page__state">A carregar...</div>
  }

  if (error) {
    return <div className="opportunity-page__error">{error}</div>
  }

  if (!opportunity) {
    return <div className="opportunity-page__state">Sem oportunidade</div>
  }

  const meta = getStatusMeta(opportunity.status)
  const availableTransitions = statusTransitions[opportunity.status] || []
  const canAdvanceStatus = availableTransitions.length > 0
  const canToggleArchive = !['GANHA', 'PERDIDA'].includes(opportunity.status)
  const canAdmin = ['ADMIN', 'N4A_SUPPORT'].includes(user?.role)
  const showFinalFinancialInputs = shouldEditFinalFinancials(opportunity)
  const showFinalSaleInputs = showFinalFinancialInputs && opportunity.status !== 'GANHA'
  const editEstSellPrice = financialForm
    ? sumFinancialFields(financialForm, [
        'estServices',
        'estSoftware',
        'estHardware',
        'estMaintenance',
      ])
    : 0
  const editEstMargin = financialForm
    ? editEstSellPrice - Number(financialForm.estCostPrice || 0)
    : 0
  const editFinalSellPrice = financialForm
    ? sumFinancialFields(financialForm, [
        'finalServices',
        'finalSoftware',
        'finalHardware',
        'finalMaintenance',
      ])
    : 0
  const editFinalMargin = financialForm
    ? editFinalSellPrice - Number(financialForm.realCostPrice || 0)
    : 0

  return (
    <section className="opportunity-page">
      <header className="opportunity-page__header">
        <button
          className="n4a-btn n4a-btn--ghost opportunity-page__back"
          onClick={() => navigate(-1)}
          type="button"
        >
          Voltar
        </button>

        <div className="opportunity-page__heading">
          <div className="opportunity-page__number">{opportunity.oppNo}</div>
          <h1 className="opportunity-page__title">
            {opportunity.client?.name || 'Cliente sem nome'}
          </h1>
          {titleEditing ? (
            <form className="opportunity-page__title-form" onSubmit={handleTitleSubmit}>
              <input
                className="n4a-input"
                onChange={(event) => setTitleForm(event.target.value)}
                placeholder="Título da oportunidade"
                value={titleForm}
              />
              <button
                className="n4a-btn n4a-btn--primary"
                disabled={titleSaving}
                type="submit"
              >
                {titleSaving ? 'A guardar...' : 'Guardar'}
              </button>
              <button
                className="n4a-btn n4a-btn--ghost"
                disabled={titleSaving}
                onClick={() => setTitleEditing(false)}
                type="button"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <div className="opportunity-page__title-line">
              {opportunity.title && (
                <p className="opportunity-page__subtitle">{opportunity.title}</p>
              )}
              <button
                className="n4a-btn n4a-btn--ghost opportunity-page__title-edit"
                onClick={openTitleEdit}
                type="button"
              >
                Editar título
              </button>
            </div>
          )}
          {titleError && <div className="opportunity-page__form-error">{titleError}</div>}
          <div className="opportunity-page__meta">
            <span>{opportunity.seller?.name || 'Sem vendedor'}</span>
            <span>{opportunity.saleType}</span>
            {opportunity.archived && <span>Arquivada</span>}
          </div>
        </div>

        <div className="opportunity-page__status-actions">
          <span className={`n4a-badge ${meta.className}`}>{meta.label}</span>
          <button className="n4a-btn n4a-btn--ghost" onClick={downloadPdf} type="button">
            PDF
          </button>
          {canAdvanceStatus && (
            <button
              className="n4a-btn n4a-btn--ghost"
              onClick={openTransitionPanel}
              type="button"
            >
              Avançar estado
            </button>
          )}
          {canToggleArchive && (
            <button
              className="n4a-btn n4a-btn--ghost"
              disabled={archiveSaving}
              onClick={handleArchiveToggle}
              type="button"
            >
              {archiveSaving
                ? 'A actualizar...'
                : opportunity.archived
                  ? 'Desarquivar'
                  : 'Arquivar'}
            </button>
          )}
        </div>
      </header>

      {archiveError && <div className="opportunity-page__form-error">{archiveError}</div>}

      {transitionOpen && (
        <section className="n4a-card opportunity-page__inline-panel">
          <form className="opportunity-page__form" onSubmit={handleTransitionSubmit}>
            <label>
              <span className="n4a-label">Novo estado</span>
              <select
                className="n4a-input"
                onChange={(event) =>
                  setTransitionForm((current) => ({
                    ...current,
                    lossReason: event.target.value === 'PERDIDA' ? current.lossReason : '',
                    toStatus: event.target.value,
                  }))
                }
                value={transitionForm.toStatus}
              >
                {availableTransitions.map((status) => (
                  <option key={status} value={status}>
                    {getStatusMeta(status).label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="n4a-label">Nota</span>
              <textarea
                className="n4a-input opportunity-page__textarea"
                onChange={(event) =>
                  setTransitionForm((current) => ({ ...current, note: event.target.value }))
                }
                value={transitionForm.note}
              />
            </label>

            {transitionForm.toStatus === 'PERDIDA' && (
              <label>
                <span className="n4a-label">Motivo de perda</span>
                <textarea
                  className="n4a-input opportunity-page__textarea"
                  onChange={(event) =>
                    setTransitionForm((current) => ({
                      ...current,
                      lossReason: event.target.value,
                    }))
                  }
                  required
                  value={transitionForm.lossReason}
                />
              </label>
            )}

            {transitionError && <div className="opportunity-page__form-error">{transitionError}</div>}

            <div className="opportunity-page__form-actions">
              <button className="n4a-btn n4a-btn--primary" disabled={transitionSaving} type="submit">
                {transitionSaving ? 'A confirmar...' : 'Confirmar'}
              </button>
              <button
                className="n4a-btn n4a-btn--ghost"
                disabled={transitionSaving}
                onClick={() => setTransitionOpen(false)}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="opportunity-page__grid">
        <section className="n4a-card opportunity-page__summary">
          <h2 className="opportunity-page__section-title">Resumo</h2>
          <dl className="opportunity-page__definition-list">
            <div>
              <dt>Fecho esperado</dt>
              <dd>{formatDate(opportunity.expectedCloseDate)}</dd>
            </div>
            <div>
              <dt>Início facturação</dt>
              <dd>{formatDate(opportunity.billingStartDate)}</dd>
            </div>
            <div>
              <dt>Proposta enviada</dt>
              <dd>{formatDate(opportunity.proposalSentDate)}</dd>
            </div>
            <div>
              <dt>Actualizada</dt>
              <dd>{formatDateTime(opportunity.updatedAt)}</dd>
            </div>
          </dl>
          {opportunity.lossReason && (
            <div className="opportunity-page__loss">
              <span>Motivo de perda</span>
              <p>{opportunity.lossReason}</p>
            </div>
          )}
        </section>

        <section className="n4a-card">
          <div className="opportunity-page__card-header">
            <h2 className="opportunity-page__section-title">Pipeline financeiro</h2>
            {!financeEditing && (
              <button
                className="n4a-btn n4a-btn--ghost"
                onClick={openFinancialEdit}
                type="button"
              >
                Editar
              </button>
            )}
          </div>
          {financeEditing && financialForm ? (
            <form className="opportunity-page__finance-form" onSubmit={handleFinancialSubmit}>
              <div className="opportunity-page__finance">
                <FinancialInputRow
                  label="Serviços"
                  onChange={(value) => updateFinancialField('estServices', value)}
                  value={financialForm.estServices}
                />
                <FinancialInputRow
                  label="Software"
                  onChange={(value) => updateFinancialField('estSoftware', value)}
                  value={financialForm.estSoftware}
                />
                <FinancialInputRow
                  label="Hardware"
                  onChange={(value) => updateFinancialField('estHardware', value)}
                  value={financialForm.estHardware}
                />
                <FinancialInputRow
                  label="Manutenção"
                  onChange={(value) => updateFinancialField('estMaintenance', value)}
                  value={financialForm.estMaintenance}
                />
                <FinancialInputRow
                  label="Custo estimado"
                  onChange={(value) => updateFinancialField('estCostPrice', value)}
                  value={financialForm.estCostPrice}
                />
                <FinancialRow label="Venda estimada" value={formatMoney(editEstSellPrice)} />
                <FinancialRow
                  label="Margem prevista"
                  value={`${formatMoney(editEstMargin)} (${formatPct(
                    calcMarginPct(editEstSellPrice, editEstMargin),
                  )})`}
                />

                {showFinalFinancialInputs && (
                  <>
                    <div className="opportunity-page__finance-divider">Fecho</div>
                    {showFinalSaleInputs ? (
                      <>
                        <FinancialInputRow
                          label="Serviços finais"
                          onChange={(value) => updateFinancialField('finalServices', value)}
                          value={financialForm.finalServices}
                        />
                        <FinancialInputRow
                          label="Software final"
                          onChange={(value) => updateFinancialField('finalSoftware', value)}
                          value={financialForm.finalSoftware}
                        />
                        <FinancialInputRow
                          label="Hardware final"
                          onChange={(value) => updateFinancialField('finalHardware', value)}
                          value={financialForm.finalHardware}
                        />
                        <FinancialInputRow
                          label="Manutenção final"
                          onChange={(value) => updateFinancialField('finalMaintenance', value)}
                          value={financialForm.finalMaintenance}
                        />
                      </>
                    ) : (
                      <>
                        <FinancialRow
                          label="Serviços finais"
                          value={formatMoney(financialForm.finalServices)}
                        />
                        <FinancialRow
                          label="Software final"
                          value={formatMoney(financialForm.finalSoftware)}
                        />
                        <FinancialRow
                          label="Hardware final"
                          value={formatMoney(financialForm.finalHardware)}
                        />
                        <FinancialRow
                          label="Manutenção final"
                          value={formatMoney(financialForm.finalMaintenance)}
                        />
                      </>
                    )}
                    <FinancialInputRow
                      label="Custo real"
                      onChange={(value) => updateFinancialField('realCostPrice', value)}
                      value={financialForm.realCostPrice}
                    />
                    <FinancialRow label="Venda final" value={formatMoney(editFinalSellPrice)} />
                    <FinancialRow
                      label="Margem efectiva"
                      value={`${formatMoney(editFinalMargin)} (${formatPct(
                        calcMarginPct(editFinalSellPrice, editFinalMargin),
                      )})`}
                    />
                  </>
                )}
              </div>

              {financialError && <div className="opportunity-page__form-error">{financialError}</div>}

              <div className="opportunity-page__form-actions">
                <button className="n4a-btn n4a-btn--primary" disabled={financialSaving} type="submit">
                  {financialSaving ? 'A guardar...' : 'Guardar'}
                </button>
                <button
                  className="n4a-btn n4a-btn--ghost"
                  disabled={financialSaving}
                  onClick={() => {
                    setFinanceEditing(false)
                    setFinancialForm(null)
                  }}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="opportunity-page__finance">
              <FinancialRow label="Serviços" value={formatMoney(opportunity.estServices)} />
              <FinancialRow label="Software" value={formatMoney(opportunity.estSoftware)} />
              <FinancialRow label="Hardware" value={formatMoney(opportunity.estHardware)} />
              <FinancialRow
                label="Manutenção"
                value={formatMoney(opportunity.estMaintenance)}
              />
              <FinancialRow label="Custo estimado" value={formatMoney(opportunity.estCostPrice)} />
              <FinancialRow label="Venda estimada" value={formatMoney(opportunity.estSellPrice)} />
              <FinancialRow
                label="Margem prevista"
                value={`${formatMoney(opportunity.estGrossMargin)} (${formatPct(
                  opportunity.estGrossMarginPct,
                )})`}
              />
            </div>
          )}
        </section>

        <section className="n4a-card">
          <h2 className="opportunity-page__section-title">Fecho</h2>
          <div className="opportunity-page__finance">
            <FinancialRow label="Serviços" value={formatMoney(opportunity.finalServices)} />
            <FinancialRow label="Software" value={formatMoney(opportunity.finalSoftware)} />
            <FinancialRow label="Hardware" value={formatMoney(opportunity.finalHardware)} />
            <FinancialRow
              label="Manutenção"
              value={formatMoney(opportunity.finalMaintenance)}
            />
            <FinancialRow label="Custo real" value={formatMoney(opportunity.realCostPrice)} />
            <FinancialRow label="Venda final" value={formatMoney(opportunity.finalSellPrice)} />
            <FinancialRow
              label="Margem efectiva"
              value={`${formatMoney(opportunity.finalMargin)} (${formatPct(
                opportunity.finalMarginPct,
              )})`}
            />
          </div>
        </section>
      </div>

      <section className="n4a-card">
        <h2 className="opportunity-page__section-title">Propostas anteriores semelhantes</h2>
        {similarLoading ? (
          <div className="opportunity-page__empty">A carregar...</div>
        ) : similarError ? (
          <div className="opportunity-page__form-error">{similarError}</div>
        ) : similarOpps.length ? (
          <table className="n4a-table opportunity-page__table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Venda estimada</th>
                <th>Venda final</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {similarOpps.map((similar) => {
                const similarMeta = getStatusMeta(similar.status)
                const finalSellPrice = Number(similar.finalSellPrice || 0)

                return (
                  <tr key={similar.id}>
                    <td>{similar.oppNo}</td>
                    <td>{similar.title || '—'}</td>
                    <td>
                      <span className={`n4a-badge ${similarMeta.className}`}>
                        {similarMeta.label}
                      </span>
                    </td>
                    <td>{formatMoney(similar.estSellPrice)}</td>
                    <td>{finalSellPrice > 0 ? formatMoney(finalSellPrice) : '—'}</td>
                    <td>{formatDate(similar.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="opportunity-page__empty">
            Sem propostas anteriores para este cliente e tipo de venda
          </div>
        )}
      </section>

      <div className="opportunity-page__columns">
        <section className="n4a-card">
          <h2 className="opportunity-page__section-title">Histórico de estado</h2>
          {opportunity.statusHistory?.length ? (
            <div className="opportunity-page__timeline">
              {opportunity.statusHistory.map((entry) => {
                const entryMeta = getStatusMeta(entry.toStatus)

                return (
                  <article className="opportunity-page__timeline-entry" key={entry.id}>
                    <div>
                      <span className={`n4a-badge ${entryMeta.className}`}>
                        {entryMeta.label}
                      </span>
                      <p>{entry.note || 'Sem nota'}</p>
                      {entry.toStatus === 'PERDIDA' && opportunity.lossReason && (
                        <p className="opportunity-page__timeline-loss">
                          Motivo de perda: {opportunity.lossReason}
                        </p>
                      )}
                    </div>
                    <div className="opportunity-page__timeline-meta">
                      <span>{entry.changedBy}</span>
                      <span>{formatDateTime(entry.createdAt)}</span>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="opportunity-page__empty">Sem histórico</div>
          )}
        </section>

        <section className="n4a-card">
          <div className="opportunity-page__card-header">
            <h2 className="opportunity-page__section-title">Contactos</h2>
            {!contactOpen && (
              <button
                className="n4a-btn n4a-btn--ghost"
                onClick={openContactForm}
                type="button"
              >
                + Contacto
              </button>
            )}
          </div>
          {contactOpen && (
            <form className="opportunity-page__form opportunity-page__inline-form" onSubmit={handleContactSubmit}>
              <div className="opportunity-page__form-grid">
                <label>
                  <span className="n4a-label">Data</span>
                  <input
                    className="n4a-input"
                    onChange={(event) =>
                      setContactForm((current) => ({ ...current, date: event.target.value }))
                    }
                    required
                    type="date"
                    value={contactForm.date}
                  />
                </label>
                <label>
                  <span className="n4a-label">Canal</span>
                  <select
                    className="n4a-input"
                    onChange={(event) =>
                      setContactForm((current) => ({ ...current, channel: event.target.value }))
                    }
                    value={contactForm.channel}
                  >
                    {contactChannels.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span className="n4a-label">Nota</span>
                <textarea
                  className="n4a-input opportunity-page__textarea"
                  onChange={(event) =>
                    setContactForm((current) => ({ ...current, note: event.target.value }))
                  }
                  required
                  value={contactForm.note}
                />
              </label>

              {contactError && <div className="opportunity-page__form-error">{contactError}</div>}

              <div className="opportunity-page__form-actions">
                <button className="n4a-btn n4a-btn--primary" disabled={contactSaving} type="submit">
                  {contactSaving ? 'A guardar...' : 'Guardar'}
                </button>
                <button
                  className="n4a-btn n4a-btn--ghost"
                  disabled={contactSaving}
                  onClick={() => setContactOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
          {opportunity.contacts?.length ? (
            <table className="n4a-table opportunity-page__table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Canal</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {opportunity.contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>{formatDate(contact.date)}</td>
                    <td>{contact.channel}</td>
                    <td>{contact.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="opportunity-page__empty">Sem contactos</div>
          )}
        </section>
      </div>

      <section className="n4a-card">
        <div className="opportunity-page__card-header">
          <h2 className="opportunity-page__section-title">Documentos</h2>
          {!uploadOpen && (
            <button
              className="n4a-btn n4a-btn--ghost"
              onClick={openUploadForm}
              type="button"
            >
              + Documento
            </button>
          )}
        </div>
        {uploadOpen && (
          <form className="opportunity-page__form opportunity-page__inline-form" onSubmit={handleUploadSubmit}>
            <div className="opportunity-page__form-grid">
              <label>
                <span className="n4a-label">Tipo</span>
                <select
                  className="n4a-input"
                  onChange={(event) =>
                    setUploadForm((current) => ({ ...current, type: event.target.value }))
                  }
                  value={uploadForm.type}
                >
                  <option disabled={opportunity.status === 'GANHA'} value="PROPOSTA">
                    Proposta
                  </option>
                  <option value="COMPRA">Fatura de fornecedor</option>
                  <option value="FATURA">Fatura de cliente</option>
                </select>
              </label>
              <label>
                <span className="n4a-label">Ficheiro</span>
                <input
                  accept="application/pdf"
                  className="n4a-input"
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      file: event.target.files?.[0] || null,
                    }))
                  }
                  required
                  type="file"
                />
              </label>
            </div>

            {uploadError && <div className="opportunity-page__form-error">{uploadError}</div>}

            <div className="opportunity-page__form-actions">
              <button className="n4a-btn n4a-btn--primary" disabled={uploadSaving} type="submit">
                {uploadSaving ? 'A carregar...' : 'Fazer upload'}
              </button>
              <button
                className="n4a-btn n4a-btn--ghost"
                disabled={uploadSaving}
                onClick={() => setUploadOpen(false)}
                type="button"
              >
                Cancelar
              </button>
            </div>
            </form>
          )}
        {adjudicationTarget && adjudicationForm && (
          <form
            className="opportunity-page__form opportunity-page__inline-form"
            onSubmit={handleAdjudicationSubmit}
          >
            <div>
              <h3 className="opportunity-page__inline-title">Adjudicar proposta</h3>
              <p className="opportunity-page__inline-subtitle">
                {adjudicationTarget.filename}
              </p>
            </div>
            <div className="opportunity-page__form-grid">
              <FinancialInputRow
                label="Serviços finais"
                onChange={(value) => updateAdjudicationField('finalServices', value)}
                value={adjudicationForm.finalServices}
              />
              <FinancialInputRow
                label="Software final"
                onChange={(value) => updateAdjudicationField('finalSoftware', value)}
                value={adjudicationForm.finalSoftware}
              />
              <FinancialInputRow
                label="Hardware final"
                onChange={(value) => updateAdjudicationField('finalHardware', value)}
                value={adjudicationForm.finalHardware}
              />
              <FinancialInputRow
                label="Manutenção final"
                onChange={(value) => updateAdjudicationField('finalMaintenance', value)}
                value={adjudicationForm.finalMaintenance}
              />
            </div>
            <label>
              <span className="n4a-label">Início entrega/facturação</span>
              <input
                className="n4a-input"
                onChange={(event) =>
                  updateAdjudicationField('billingStartDate', event.target.value)
                }
                required
                type="date"
                value={adjudicationForm.billingStartDate}
              />
            </label>
            {adjudicateError && <div className="opportunity-page__form-error">{adjudicateError}</div>}
            <div className="opportunity-page__form-actions">
              <button
                className="n4a-btn n4a-btn--primary"
                disabled={Boolean(adjudicatingAttachmentId)}
                type="submit"
              >
                {adjudicatingAttachmentId === adjudicationTarget.id
                  ? 'A adjudicar...'
                  : 'Confirmar adjudicação'}
              </button>
              <button
                className="n4a-btn n4a-btn--ghost"
                disabled={Boolean(adjudicatingAttachmentId)}
                onClick={closeAdjudicationForm}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
        {!adjudicationTarget && adjudicateError && (
          <div className="opportunity-page__form-error">{adjudicateError}</div>
        )}
        {opportunity.attachments?.length ? (
          <table className="n4a-table opportunity-page__table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Ficheiro</th>
                <th>Adjudicada</th>
                <th>Upload</th>
              </tr>
            </thead>
            <tbody>
              {opportunity.attachments.map((attachment) => (
                <tr key={attachment.id}>
                  <td>{attachment.type}</td>
                  <td>
                    <div className="opportunity-page__document-file">
                      <span>{attachment.filename}</span>
                      {canAdmin &&
                        attachment.type === 'PROPOSTA' &&
                        !attachment.adjudicada &&
                        opportunity.status !== 'GANHA' && (
                        <button
                          className="n4a-btn n4a-btn--ghost opportunity-page__action"
                          disabled={Boolean(adjudicatingAttachmentId)}
                          onClick={() => openAdjudicationForm(attachment)}
                          type="button"
                        >
                          Adjudicar
                        </button>
                      )}
                      {canAdmin && attachment.type === 'PROPOSTA' && attachment.adjudicada && (
                        <button
                          className="n4a-btn n4a-btn--ghost opportunity-page__action"
                          disabled={Boolean(deadjudicatingAttachmentId)}
                          onClick={() => handleDeadjudicateAttachment(attachment.id)}
                          type="button"
                        >
                          {deadjudicatingAttachmentId === attachment.id
                            ? 'A desadjudicar...'
                            : 'Desadjudicar'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    {attachment.adjudicada ? (
                      <span className="n4a-badge n4a-badge--magenta">Adjudicada</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{formatDateTime(attachment.uploadedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="opportunity-page__empty">Sem documentos</div>
        )}
      </section>
    </section>
  )
}

export default OpportunityPage
