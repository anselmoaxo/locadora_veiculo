import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { CarListingPage } from './pages/CarListingPage'
import { CarDetailPage } from './pages/CarDetailPage'
import { ReservationPage } from './pages/ReservationPage'
import { AuthPage } from './pages/AuthPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/carros" element={<CarListingPage />} />
        <Route path="/carros/:id" element={<CarDetailPage />} />
        <Route path="/reserva/:id" element={<ReservationPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
