import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { useChatStore } from '@/features/schedule-intelligence/chat/chatStore';
import { ScheduleProvider, useSchedule } from '@/features/projects/ScheduleContext';
import { OrgProvider, useOrg } from '@/shared/context/OrgContext';
import Loader from '@/shared/components/Loader';

// Route components are code-split so heavy deps (Plotly, three.js, framer-motion,
// the diagram pages) load only when their route is visited.
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Login = lazy(() => import('@/features/auth/Login'));
const Signup = lazy(() => import('@/features/auth/Signup'));
const ResetPassword = lazy(() => import('@/features/auth/ResetPassword'));
const Architecture = lazy(() => import('@/pages/Architecture'));
const FutureArchitecture = lazy(() => import('@/pages/FutureArchitecture'));
// Internal research tooling. Not linked from any navigation; the backend
// restricts it to platform operators.
const Evaluation = lazy(() => import('@/pages/Evaluation'));
const OrgOnboarding = lazy(() => import('@/features/organization/OrgOnboarding'));
const AcceptInvite = lazy(() => import('@/features/organization/AcceptInvite'));

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <Loader />
    </div>
  );
}

/** Dashboard, or the create-organisation screen when the user has no org.
 *
 * A signed-in user must always land somewhere: with no org there is nothing a
 * dashboard could show, and no project could be created, because a project is
 * created into an org. */
function DashboardOrOnboarding() {
  const { isLoaded, needsOnboarding } = useOrg();
  if (!isLoaded) return <FullScreenLoader />;
  return needsOnboarding ? <OrgOnboarding /> : <Dashboard />;
}

function AppInner() {
  const { user, isLoaded } = useAuth();
  const chatStore = useChatStore();
  const schedule = useSchedule();

  // Set user ID in chat store and schedule context when user logs in
  useEffect(() => {
    if (isLoaded && user) {
      chatStore.setUser(user.id);
      schedule.setUserId(user.id);
    } else if (isLoaded && !user) {
      chatStore.setUser(null);
      schedule.setUserId(null);
    }
  }, [isLoaded, user, chatStore, schedule]);

  if (!isLoaded) {
    return <FullScreenLoader />;
  }

  return (
    <Suspense fallback={<FullScreenLoader />}>
    <Routes>
      {/* Landing page route */}
      <Route
        path="/"
        element={
          user ? <Navigate to="/dashboard" replace /> : <LandingPage />
        }
      />

      {/* Auth routes */}
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/signup"
        element={user ? <Navigate to="/dashboard" replace /> : <Signup />}
      />
      <Route
        path="/reset-password"
        element={user ? <Navigate to="/dashboard" replace /> : <ResetPassword />}
      />

      {/* Dashboard route */}
      <Route
        path="/dashboard"
        element={
          user ? <DashboardOrOnboarding /> : <Navigate to="/login" replace />
        }
      />

      {/* Invitation landing. Public on purpose: an invitee must be able to see
          which organisation is inviting them before creating an account. */}
      <Route path="/invite/:token" element={<AcceptInvite />} />

      {/* System architecture (public — view without signing in) */}
      <Route path="/arch" element={<Architecture />} />

      {/* Future / vision architecture (public) */}
      <Route path="/futurearch" element={<FutureArchitecture />} />

      {/* Model evaluation (internal research). Signed-in only, and deliberately
          absent from the dashboard and every user-facing menu. */}
      <Route
        path="/evaluation"
        element={user ? <Evaluation /> : <Navigate to="/login" replace />}
      />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <OrgProvider>
      <ScheduleProvider>
        <AppInner />
      </ScheduleProvider>
    </OrgProvider>
  );
}

export default App;
