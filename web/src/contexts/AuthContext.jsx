/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react'
import api, { TOKEN_KEY } from '../api/client.js'

const AuthContext = createContext(null)

function decodeJwtPayload(token) {
  const [, payload] = token.split('.')

  if (!payload) {
    return null
  }

  const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
  const paddedPayload = normalizedPayload.padEnd(
    Math.ceil(normalizedPayload.length / 4) * 4,
    '=',
  )
  const decodedPayload = atob(paddedPayload)

  return JSON.parse(decodedPayload)
}

function userFromToken(token) {
  const payload = decodeJwtPayload(token)

  if (!payload) {
    return null
  }

  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return null
  }

  return {
    id: payload.sub,
    name: payload.name,
    role: payload.role,
    email: payload.email,
  }
}

function getInitialAuthState() {
  const storedToken = localStorage.getItem(TOKEN_KEY)

  if (!storedToken) {
    return { user: null, token: null }
  }

  try {
    const decodedUser = userFromToken(storedToken)

    if (decodedUser) {
      return { user: decodedUser, token: storedToken }
    }
  } catch {
    localStorage.removeItem(TOKEN_KEY)
  }

  localStorage.removeItem(TOKEN_KEY)
  return { user: null, token: null }
}

function AuthProvider({ children }) {
  const [{ user, token }, setAuthState] = useState(getInitialAuthState)
  const loading = false

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    const decodedUser = userFromToken(data.token)
    const nextUser = data.user || decodedUser

    localStorage.setItem(TOKEN_KEY, data.token)
    setAuthState({ user: nextUser, token: data.token })

    return nextUser
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setAuthState({ user: null, token: null })
  }

  const value = { user, token, loading, login, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}

export { AuthProvider, useAuth }
