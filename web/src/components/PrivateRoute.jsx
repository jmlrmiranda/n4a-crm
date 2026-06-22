import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

function PrivateRoute({ children }) {
  const { loading, token } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main
        style={{
          alignItems: 'center',
          background: 'var(--n4a-bg-base)',
          color: 'var(--n4a-text-secondary)',
          display: 'flex',
          minHeight: '100vh',
          justifyContent: 'center',
        }}
      >
        A carregar
      </main>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

export default PrivateRoute
