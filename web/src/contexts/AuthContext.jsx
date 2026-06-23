/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react'
import api, { TOKEN_KEY } from '../api/client.js'

const AuthContext = createContext(null)
const ACTIVE_COMPANY_NAME_KEY = 'n4a_crm_active_company_name'

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
    companyId: payload.companyId,
  }
}

function companyIdFromToken(token) {
  const payload = decodeJwtPayload(token)
  return payload?.companyId || null
}

function getInitialAuthState() {
  const storedToken = localStorage.getItem(TOKEN_KEY)

  if (!storedToken) {
    return { user: null, token: null, companyId: null, activeCompanyName: null }
  }

  try {
    const decodedUser = userFromToken(storedToken)

    if (decodedUser) {
      return {
        user: decodedUser,
        token: storedToken,
        companyId: decodedUser.companyId || companyIdFromToken(storedToken),
        activeCompanyName:
          localStorage.getItem(ACTIVE_COMPANY_NAME_KEY) || decodedUser.companyId || null,
      }
    }
  } catch {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ACTIVE_COMPANY_NAME_KEY)
  }

  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ACTIVE_COMPANY_NAME_KEY)
  return { user: null, token: null, companyId: null, activeCompanyName: null }
}

function AuthProvider({ children }) {
  const [{ user, token, companyId, activeCompanyName }, setAuthState] =
    useState(getInitialAuthState)
  const loading = false

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    const decodedUser = userFromToken(data.token)
    const nextCompanyId = companyIdFromToken(data.token)
    const nextUser = {
      ...decodedUser,
      ...(data.user || {}),
      companyId: nextCompanyId,
      role: decodedUser?.role || data.user?.role,
    }
    const nextCompanyName =
      data.company?.name || data.user?.companyName || decodedUser?.companyName || nextCompanyId

    localStorage.setItem(TOKEN_KEY, data.token)
    if (nextCompanyName) {
      localStorage.setItem(ACTIVE_COMPANY_NAME_KEY, nextCompanyName)
    }
    setAuthState({
      user: nextUser,
      token: data.token,
      companyId: nextCompanyId,
      activeCompanyName: nextCompanyName,
    })

    return nextUser
  }

  async function switchCompany(targetCompanyId) {
    const { data } = await api.post(
      '/auth/switch-company',
      { targetCompanyId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
    const decodedUser = userFromToken(data.token)
    const nextCompanyId = companyIdFromToken(data.token)
    const nextCompanyName = data.company?.name || nextCompanyId
    const nextUser = {
      ...user,
      ...decodedUser,
      companyId: nextCompanyId,
    }

    localStorage.setItem(TOKEN_KEY, data.token)
    if (nextCompanyName) {
      localStorage.setItem(ACTIVE_COMPANY_NAME_KEY, nextCompanyName)
    }
    setAuthState({
      user: nextUser,
      token: data.token,
      companyId: nextCompanyId,
      activeCompanyName: nextCompanyName,
    })

    return data
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ACTIVE_COMPANY_NAME_KEY)
    setAuthState({ user: null, token: null, companyId: null, activeCompanyName: null })
  }

  const value = {
    user,
    token,
    companyId,
    activeCompanyName,
    loading,
    login,
    logout,
    switchCompany,
  }

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
