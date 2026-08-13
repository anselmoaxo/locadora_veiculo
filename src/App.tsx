import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { HomePage } from './pages/HomePage'
import { CarListingPage } from './pages/CarListingPage'
import { CarDetailPage } from './pages/CarDetailPage'
import { ReservationPage } from './pages/ReservationPage'
import { AuthPage } from './pages/AuthPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'

const VehicleRegistrationPage = lazy(() => import('./pages/VehicleRegistrationPage').then((module) => ({ default: module.VehicleRegistrationPage })))
const VehicleEditPage = lazy(() => import('./pages/VehicleEditPage').then((module) => ({ default: module.VehicleEditPage })))
const DriverProfilePage = lazy(() => import('./pages/DriverProfilePage').then((module) => ({ default: module.DriverProfilePage })))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })))
const MyReservationsPage = lazy(() => import('./pages/MyReservationsPage').then((module) => ({ default: module.MyReservationsPage })))

function LoadingScreen({ message = 'Carregando...' }: { message?: string }) {
  return <main className="min-h-screen flex items-center justify-center bg-neutral-background font-inter text-body-lg text-neutral-text">{message}</main>
}

function DeferredPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <LoadingScreen message="Verificando sua sessão..." />
    )
  }

  if (!user) {
    const redirect = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/auth?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  return children
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin, adminLoading } = useAuth()
  const location = useLocation()

  if (loading || adminLoading) {
    return (
      <LoadingScreen message="Verificando sua autorização..." />
    )
  }

  if (!user) {
    const redirect = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/auth?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  if (!isAdmin) return <Navigate to="/" replace />

  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/carros" element={<CarListingPage />} />
          <Route path="/carros/:id" element={<CarDetailPage />} />
          <Route
            path="/reserva/:id"
            element={<RequireAuth><ReservationPage /></RequireAuth>}
          />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/minha-conta"
            element={<RequireAuth><DeferredPage><DriverProfilePage /></DeferredPage></RequireAuth>}
          />
          <Route
            path="/minhas-reservas"
            element={<RequireAuth><DeferredPage><MyReservationsPage /></DeferredPage></RequireAuth>}
          />
          <Route
            path="/admin"
            element={<RequireAdmin><DeferredPage><AdminDashboardPage /></DeferredPage></RequireAdmin>}
          />
          <Route
            path="/cadastro-veiculo"
            element={<RequireAdmin><DeferredPage><VehicleRegistrationPage /></DeferredPage></RequireAdmin>}
          />
          <Route
            path="/veiculos/:id/editar"
            element={<RequireAdmin><DeferredPage><VehicleEditPage /></DeferredPage></RequireAdmin>}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
