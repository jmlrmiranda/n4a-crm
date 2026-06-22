import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

function LoginPage() {
  const { login, token } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = location.state?.from?.pathname || '/'

  if (token) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(email, password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Email ou password inválidos.')
      } else {
        setError('Não foi possível iniciar sessão.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      style={{
        alignItems: 'center',
        background: 'var(--n4a-bg-base)',
        color: 'var(--n4a-text-primary)',
        display: 'flex',
        minHeight: '100vh',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <form
        className="n4a-card"
        onSubmit={handleSubmit}
        style={{
          maxWidth: 380,
          padding: 32,
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'var(--n4a-magenta)',
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 32,
            textAlign: 'center',
          }}
        >
          N4A
        </div>
        <div
          style={{
            color: 'var(--n4a-text-secondary)',
            fontSize: 13,
            marginBottom: 32,
            marginTop: -24,
            textAlign: 'center',
          }}
        >
          CRM
        </div>

        <label className="n4a-label" htmlFor="login-email">
          Email
        </label>
        <input
          autoComplete="email"
          className="n4a-input"
          disabled={submitting}
          id="login-email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />

        <div style={{ height: 16 }} />

        <label className="n4a-label" htmlFor="login-password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="n4a-input"
          disabled={submitting}
          id="login-password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />

        <button
          aria-busy={submitting}
          className="n4a-btn n4a-btn--primary"
          disabled={submitting}
          style={{
            justifyContent: 'center',
            marginTop: 24,
            opacity: submitting ? 0.7 : 1,
            width: '100%',
          }}
          type="submit"
        >
          {submitting ? 'A entrar...' : 'Entrar'}
        </button>

        {error && (
          <div
            role="alert"
            style={{
              color: 'var(--n4a-danger)',
              fontSize: 13,
              marginTop: 12,
            }}
          >
            {error}
          </div>
        )}
      </form>
    </main>
  )
}

export default LoginPage
