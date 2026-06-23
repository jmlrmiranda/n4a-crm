import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import PrivateRoute from './components/PrivateRoute.jsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import ClientPage from './pages/ClientPage.jsx'
import ClientsPage from './pages/ClientsPage.jsx'
import CompaniesPage from './pages/CompaniesPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import OpportunityPage from './pages/OpportunityPage.jsx'
import PipelinePage from './pages/PipelinePage.jsx'
import UsersPage from './pages/UsersPage.jsx'

function AdminRoute({ children }) {
  const { user } = useAuth()

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }

  return children
}

function N4AAdminRoute({ children }) {
  const { user } = useAuth()

  if (user?.role !== 'N4A_ADMIN') {
    return <Navigate to="/" replace />
  }

  return children
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<PipelinePage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:id" element={<ClientPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="opps/:id" element={<OpportunityPage />} />
            <Route
              path="users"
              element={
                <AdminRoute>
                  <UsersPage />
                </AdminRoute>
              }
            />
            <Route
              path="empresas"
              element={
                <N4AAdminRoute>
                  <CompaniesPage />
                </N4AAdminRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
