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
import { ExplorePage } from '@/pages/ExplorePage';
import { EventsCalendarPage } from '@/pages/EventsCalendarPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { MenuPage } from '@/pages/MenuPage';
import { ModerationPage } from '@/pages/ModerationPage';
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

/*
 * The four pages that touch MapLibre, split out for the same reason.
 *
 * MapLibre is 762 kB — bigger than the rest of the app put together — and it
 * arrives through MapView (Discover, route navigation) and LocationPicker
 * (submitting content, creating an event). Left in the main chunk, someone
 * opening the landing page on mobile data downloads a map engine to read four
 * paragraphs and tap "Browse as guest". Now it loads when a map does.
 */
const DiscoverPage = lazy(() =>
  import('@/pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage })),
);
const RouteNavigationPage = lazy(() =>
  import('@/pages/RouteNavigationPage').then((m) => ({ default: m.RouteNavigationPage })),
);
const SubmitContentPage = lazy(() =>
  import('@/pages/SubmitContentPage').then((m) => ({ default: m.SubmitContentPage })),
);
const CreateEventPage = lazy(() =>
  import('@/pages/CreateEventPage').then((m) => ({ default: m.CreateEventPage })),
);

/** One place to say what a page looks like while its chunk is arriving. */
function Lazy({ children, label }: { children: React.ReactNode; label: string }) {
  return <Suspense fallback={<LoadingBlock label={label} />}>{children}</Suspense>;
}

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
        <Route
          path="/discover"
          element={
            <Lazy label="Loading the map…">
              <DiscoverPage />
            </Lazy>
          }
        />
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
              <Lazy label="Loading the form…">
                <SubmitContentPage />
              </Lazy>
            </PrivateRoute>
          }
        />
        <Route
          path="/events/new"
          element={
            <PrivateRoute requires="create_event">
              <Lazy label="Loading the form…">
                <CreateEventPage />
              </Lazy>
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
      <Route
        path="/route/:routeId"
        element={
          <Lazy label="Loading the route…">
            <RouteNavigationPage />
          </Lazy>
        }
      />

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
