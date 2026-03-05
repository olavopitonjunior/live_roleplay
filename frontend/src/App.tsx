import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Session } from './pages/Session';
import { Feedback } from './pages/Feedback';
import { History } from './pages/History';
import { Profile } from './pages/Profile';
import { AdminScenarios } from './pages/Admin/Scenarios';
import { ApiDashboard } from './pages/Admin/ApiDashboard';
import { ProtectedRoute } from './components/Auth';

// Lazy-load PipecatTest to code-split Three.js (~1.5 MB) from main bundle
const PipecatTest = lazy(() => import('./pages/PipecatTest').then(m => ({ default: m.PipecatTest })));

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />

        {/* Protected routes */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/session/:scenarioId"
          element={
            <ProtectedRoute>
              <Session />
            </ProtectedRoute>
          }
        />

        <Route
          path="/feedback/:sessionId"
          element={
            <ProtectedRoute>
              <Feedback />
            </ProtectedRoute>
          }
        />

        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin/scenarios"
          element={
            <ProtectedRoute adminOnly>
              <AdminScenarios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/api-dashboard"
          element={
            <ProtectedRoute adminOnly>
              <ApiDashboard />
            </ProtectedRoute>
          }
        />

        {/* Dev: Pipecat PoC test (no auth, lazy-loaded) */}
        <Route path="/pipecat-test" element={<Suspense fallback={<div className="flex items-center justify-center h-screen text-white">Carregando...</div>}><PipecatTest /></Suspense>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SpeedInsights />
    </BrowserRouter>
  );
}

export default App;
