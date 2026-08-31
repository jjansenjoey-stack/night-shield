import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { useReminders } from '@/hooks/useReminders';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { AuthErrorBoundary } from '@/components/AuthErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
import { AppShell } from '@/components/layout/AppShell';
import { PrivateRoute } from '@/components/layout/PrivateRoute';

import { LandingPage } from '@/pages/LandingPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { SignupPage } from '@/pages/SignupPage';
import { LoginPage } from '@/pages/LoginPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { DiscoverPage } from '@/pages/DiscoverPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { EventsCalendarPage } from '@/pages/EventsCalendarPage';
import { CreateEventPage } from '@/pages/CreateEventPage';
import { RouteNavigationPage } from '@/pages/RouteNavigationPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { MenuPage } from '@/pages/MenuPage';
import { ModerationPage } from '@/pages/ModerationPage';
import { SubmitContentPage } from '@/pages/SubmitContentPage';
import { WorkshopsPage } from '@/pages/WorkshopsPage';
import { ArtRoutesPage } from '@/pages/ArtRoutesPage';
import { LoadingBlock } from '@/components/ui/LoadingSpinner';

/*
 * The organizer dashboard is the only page that uses Recharts, which is a few
 * hundred kilobytes on its own and is reachable by a handful of accounts. Split
 * it out so a citizen on a phone never downloads a charting library.
 */
const OrganizerDashboardPage = lazy(() =>
  import('@/pages/OrganizerDashboardPage').then((m) => ({ default: m.OrganizerDashboardPage })),
);

/** Everything that needs the toast context lives inside this. */
function AppRoutes() {
  const bootstrap = useAppStore((s) => s.bootstrap);

  useReminders();
  useOnlineStatus();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Inside the shell. Discover and Events stay open to guests (prompt 20). */}
      <Route element={<AppShell />}>
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/events" element={<EventsCalendarPage />} />
        <Route path="/workshops" element={<WorkshopsPage />} />
        <Route path="/art-routes" element={<ArtRoutesPage />} />
        {/* The page had its own URL before it earned a tab. */}
        <Route path="/two-weeks-only" element={<Navigate to="/art-routes" replace />} />
        {/* The page was called Grow before it earned its own tab. */}
        <Route path="/grow" element={<Navigate to="/workshops" replace />} />
        <Route path="/menu" element={<MenuPage />} />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <ProfilePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/submit"
          element={
            <PrivateRoute requires="submit_content">
              <SubmitContentPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/events/new"
          element={
            <PrivateRoute requires="create_event">
              <CreateEventPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/organizer"
          element={
            <PrivateRoute requires="view_analytics">
              <Suspense fallback={<LoadingBlock label="Loading analytics…" />}>
                <OrganizerDashboardPage />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path="/moderation"
          element={
            <PrivateRoute requires="moderate">
              <ModerationPage />
            </PrivateRoute>
          }
        />
      </Route>

      {/* Full-bleed: navigation takes the whole screen. */}
      <Route path="/route/:routeId" element={<RouteNavigationPage />} />

      <Route path="*" element={<Navigate to="/discover" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthErrorBoundary>
      {/*
        Served from a domain root in most places, but from /<repo>/ on GitHub
        Pages. BASE_URL carries whatever `vite build` was given, so every route
        below stays written as a plain absolute path either way.
      */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </BrowserRouter>
    </AuthErrorBoundary>
  );
}
