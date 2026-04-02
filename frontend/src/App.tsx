import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Session } from './pages/Session';
import { Feedback } from './pages/Feedback';
import { History } from './pages/History';
import { Profile } from './pages/Profile';
import { TrackDetailPage } from './pages/TrackDetail';
import { AdminScenarios } from './pages/Admin/Scenarios';
import { ApiDashboard } from './pages/Admin/ApiDashboard';

// Lazy-load Admin Tracks page
const AdminTracks = lazy(() => import('./pages/Admin/Tracks'));
import { ProtectedRoute } from './components/Auth';

// Lazy-load PipecatTest to code-split Three.js (~1.5 MB) from main bundle
const PipecatTest = lazy(() => import('./pages/PipecatTest').then(m => ({ default: m.PipecatTest })));

// Lazy-load new multi-tenant pages (Phase 2+)
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword').then(m => ({ default: m.ResetPassword })));
const InviteAccept = lazy(() => import('./pages/Auth/InviteAccept').then(m => ({ default: m.InviteAccept })));

// Org admin pages
const OrgDashboard = lazy(() => import('./pages/Org/Dashboard'));
const OrgBilling = lazy(() => import('./pages/Org/Billing'));
const OrgSettings = lazy(() => import('./pages/Org/Settings'));
const OrgUsers = lazy(() => import('./pages/Org/Users'));
const OrgTeams = lazy(() => import('./pages/Org/Teams'));
const OrgAnalytics = lazy(() => import('./pages/Org/Analytics'));
const OrgAccessCodes = lazy(() => import('./pages/Org/AccessCodes'));
const OrgAuditLog = lazy(() => import('./pages/Org/AuditLog'));

// Trainee pages
const Assignments = lazy(() => import('./pages/Assignments'));

// Team (manager) pages
const TeamDashboard = lazy(() => import('./pages/Team/Dashboard'));
const TeamMemberDetail = lazy(() => import('./pages/Team/Members'));
const TeamAssignments = lazy(() => import('./pages/Team/Assignments'));

// Public website pages
const Landing = lazy(() => import('./pages/Public/Landing'));
const PricingPage = lazy(() => import('./pages/Public/Pricing'));
const ContactPage = lazy(() => import('./pages/Public/Contact'));
const SignupPage = lazy(() => import('./pages/Public/Signup'));
const CheckoutSuccess = lazy(() => import('./pages/Public/CheckoutSuccess'));
const CheckoutCancel = lazy(() => import('./pages/Public/CheckoutCancel'));

// Platform admin pages
const PlatformLogin = lazy(() => import('./pages/Platform/Login'));
const PlatformDashboard = lazy(() => import('./pages/Platform/Dashboard'));
const PlatformTenants = lazy(() => import('./pages/Platform/Tenants'));
const PlatformTenantDetail = lazy(() => import('./pages/Platform/TenantDetail'));
const PlatformPlans = lazy(() => import('./pages/Platform/Plans'));
const PlatformPlanEditor = lazy(() => import('./pages/Platform/PlanEditor'));
const PlatformLeads = lazy(() => import('./pages/Platform/Leads'));
const PlatformCosts = lazy(() => import('./pages/Platform/Costs'));
const PlatformHealth = lazy(() => import('./pages/Platform/Health'));
const PlatformAlerts = lazy(() => import('./pages/Platform/Alerts'));
const PlatformScenarios = lazy(() => import('./pages/Platform/Scenarios'));
const PlatformAudit = lazy(() => import('./pages/Platform/Audit'));
const PlatformStaff = lazy(() => import('./pages/Platform/Staff'));

// Notifications
const Notifications = lazy(() => import('./pages/Notifications'));

const LazyFallback = (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="border-2 border-black shadow-[4px_4px_0px_#000] px-6 py-4 flex items-center gap-3">
      <div className="w-3 h-3 bg-yellow-400 animate-pulse" />
      <span className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: "'Space Mono', monospace" }}>
        Loading...
      </span>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/landing" element={<Suspense fallback={LazyFallback}><Landing /></Suspense>} />
        <Route path="/pricing" element={<Suspense fallback={LazyFallback}><PricingPage /></Suspense>} />
        <Route path="/contact" element={<Suspense fallback={LazyFallback}><ContactPage /></Suspense>} />
        <Route path="/signup" element={<Suspense fallback={LazyFallback}><SignupPage /></Suspense>} />
        <Route path="/checkout/success" element={<Suspense fallback={LazyFallback}><CheckoutSuccess /></Suspense>} />
        <Route path="/checkout/cancel" element={<Suspense fallback={LazyFallback}><CheckoutCancel /></Suspense>} />
        <Route path="/forgot-password" element={<Suspense fallback={LazyFallback}><ForgotPassword /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={LazyFallback}><ResetPassword /></Suspense>} />
        <Route path="/invite/:token" element={<Suspense fallback={LazyFallback}><InviteAccept /></Suspense>} />

        {/* Protected routes — all authenticated users */}
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

        {/* Track detail page — all authenticated users */}
        <Route
          path="/tracks/:slug"
          element={
            <ProtectedRoute>
              <TrackDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Admin routes (backward compat — redirects to /org/ equivalents) */}
        <Route
          path="/admin/scenarios"
          element={
            <ProtectedRoute adminOnly>
              <AdminScenarios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/tracks"
          element={
            <ProtectedRoute adminOnly>
              <Suspense fallback={LazyFallback}><AdminTracks /></Suspense>
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

        {/* Org admin routes — owner/admin only, JWT required */}
        <Route path="/org/dashboard" element={
          <ProtectedRoute requiredRoles={['admin']} requireJwt>
            <Suspense fallback={LazyFallback}><OrgDashboard /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/org/billing" element={
          <ProtectedRoute requiredRoles={['admin']} requireJwt>
            <Suspense fallback={LazyFallback}><OrgBilling /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/org/settings" element={
          <ProtectedRoute requiredRoles={['admin']} requireJwt>
            <Suspense fallback={LazyFallback}><OrgSettings /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/org/scenarios" element={
          <ProtectedRoute requiredRoles={['admin']} requireJwt><AdminScenarios /></ProtectedRoute>
        } />
        <Route path="/org/api-dashboard" element={
          <ProtectedRoute requiredRoles={['admin']} requireJwt><ApiDashboard /></ProtectedRoute>
        } />
        <Route path="/org/access-codes" element={
          <ProtectedRoute requiredRoles={['admin']} requireJwt>
            <Suspense fallback={LazyFallback}><OrgAccessCodes /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/org/users" element={
          <ProtectedRoute requiredRoles={['admin']} requireJwt>
            <Suspense fallback={LazyFallback}><OrgUsers /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/org/teams" element={
          <ProtectedRoute requiredRoles={['admin']} requireJwt>
            <Suspense fallback={LazyFallback}><OrgTeams /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/org/analytics" element={
          <ProtectedRoute requiredRoles={['admin']} requireJwt>
            <Suspense fallback={LazyFallback}><OrgAnalytics /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/org/audit-log" element={
          <ProtectedRoute requiredRoles={['admin']} requireJwt>
            <Suspense fallback={LazyFallback}><OrgAuditLog /></Suspense>
          </ProtectedRoute>
        } />

        {/* Trainee routes — JWT users */}
        <Route path="/assignments" element={
          <ProtectedRoute requireJwt>
            <Suspense fallback={LazyFallback}><Assignments /></Suspense>
          </ProtectedRoute>
        } />

        {/* Team/Manager routes — manager+ only */}
        <Route path="/team/dashboard" element={
          <ProtectedRoute requiredRoles={['manager']} requireJwt>
            <Suspense fallback={LazyFallback}><TeamDashboard /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/team/members/:userId" element={
          <ProtectedRoute requiredRoles={['manager']} requireJwt>
            <Suspense fallback={LazyFallback}><TeamMemberDetail /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/team/assignments" element={
          <ProtectedRoute requiredRoles={['manager']} requireJwt>
            <Suspense fallback={LazyFallback}><TeamAssignments /></Suspense>
          </ProtectedRoute>
        } />

        {/* Notifications (JWT users) */}
        <Route path="/notifications" element={
          <ProtectedRoute requireJwt>
            <Suspense fallback={LazyFallback}><Notifications /></Suspense>
          </ProtectedRoute>
        } />

        {/* Platform admin routes — no ProtectedRoute, platform auth handled in-page */}
        <Route path="/platform/login" element={<Suspense fallback={LazyFallback}><PlatformLogin /></Suspense>} />
        <Route path="/platform/dashboard" element={<Suspense fallback={LazyFallback}><PlatformDashboard /></Suspense>} />
        <Route path="/platform/tenants" element={<Suspense fallback={LazyFallback}><PlatformTenants /></Suspense>} />
        <Route path="/platform/tenants/:orgId" element={<Suspense fallback={LazyFallback}><PlatformTenantDetail /></Suspense>} />
        <Route path="/platform/plans" element={<Suspense fallback={LazyFallback}><PlatformPlans /></Suspense>} />
        <Route path="/platform/plans/:planId" element={<Suspense fallback={LazyFallback}><PlatformPlanEditor /></Suspense>} />
        <Route path="/platform/leads" element={<Suspense fallback={LazyFallback}><PlatformLeads /></Suspense>} />
        <Route path="/platform/costs" element={<Suspense fallback={LazyFallback}><PlatformCosts /></Suspense>} />
        <Route path="/platform/health" element={<Suspense fallback={LazyFallback}><PlatformHealth /></Suspense>} />
        <Route path="/platform/alerts" element={<Suspense fallback={LazyFallback}><PlatformAlerts /></Suspense>} />
        <Route path="/platform/scenarios" element={<Suspense fallback={LazyFallback}><PlatformScenarios /></Suspense>} />
        <Route path="/platform/audit" element={<Suspense fallback={LazyFallback}><PlatformAudit /></Suspense>} />
        <Route path="/platform/staff" element={<Suspense fallback={LazyFallback}><PlatformStaff /></Suspense>} />

        {/* Dev: Pipecat PoC test (no auth, lazy-loaded) */}
        <Route path="/pipecat-test" element={<Suspense fallback={<div className="flex items-center justify-center h-screen text-white">Carregando...</div>}><PipecatTest /></Suspense>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
