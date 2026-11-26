import { Suspense, lazy } from 'react';
import styled from '@emotion/styled';
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './i18n';
import { ActivePluginProvider } from './state/plugins';
import { useSession } from './state/session';
import { tapTarget, useMediaQuery } from './theme';

// SDD section 9: one lazy chunk per area. Admin and authoring chunks load only behind RequireAdmin.
const LearnPage = lazy(() => import('./features/learn/LearnPage'));
const LessonPlayerPage = lazy(() => import('./features/learn/LessonPlayerPage'));
const ReviewPage = lazy(() => import('./features/review/ReviewPage'));
const LibraryPage = lazy(() => import('./features/library/LibraryPage'));
const KanjiDetailPage = lazy(() => import('./features/library/KanjiDetailPage'));
const GrammarReferencePage = lazy(() => import('./features/library/GrammarReferencePage'));
const GrammarPointPage = lazy(() => import('./features/library/GrammarPointPage'));
const WordPage = lazy(() => import('./features/library/WordPage'));
const SocialPage = lazy(() => import('./features/social/SocialPage'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));
const AuthoringPage = lazy(() => import('./features/authoring/AuthoringPage'));
const LessonEditorPage = lazy(() => import('./features/authoring/LessonEditorPage'));
// Password reset by emailed link (#23).
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage'));

const SignInPage = lazy(() => import('./features/auth/SignInPage'));
const AcceptInvitePage = lazy(() => import('./features/auth/AcceptInvitePage'));
const ChangePasswordPage = lazy(() => import('./features/auth/ChangePasswordPage'));

const tabs = ['learn', 'review', 'library', 'social', 'profile'] as const;

// IF-01: bottom tab bar below 768 px, side rail above.
const Shell = styled.div<{ wide: boolean }>`
  display: flex;
  flex-direction: ${({ wide }) => (wide ? 'row' : 'column')};
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  font-family: system-ui, sans-serif;
`;

const Nav = styled.nav<{ wide: boolean }>`
  display: flex;
  flex-direction: ${({ wide }) => (wide ? 'column' : 'row')};
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)};
  position: sticky;
  ${({ wide, theme }) =>
    wide
      ? `top: 0; height: 100vh; border-right: 1px solid ${theme.colors.border};`
      : `bottom: 0; border-top: 1px solid ${theme.colors.border};`}
  background: ${({ theme }) => theme.colors.surface};
`;

const Tab = styled(NavLink)`
  ${({ theme }) => tapTarget(theme)};
  flex: 1 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.radii.medium};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.small};
  text-decoration: none;

  &.active {
    color: ${({ theme }) => theme.colors.primary};
    font-weight: 700;
  }
`;

const Main = styled.main`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(4)};
`;

function Loading() {
  const { t } = useTranslation();
  return <p>{t('app.loading')}</p>;
}

function Layout() {
  const { t } = useTranslation();
  const { user } = useSession();
  const wide = useMediaQuery('(min-width: 768px)');
  const nav = (
    <Nav wide={wide} aria-label={t('nav.label')} data-layout={wide ? 'rail' : 'tab-bar'}>
      {tabs.map((tab) => (
        <Tab key={tab} to={`/${tab}`}>
          {t(`area.${tab}`)}
        </Tab>
      ))}
      {user?.role === 'admin' && <Tab to="/admin">{t('area.admin')}</Tab>}
    </Nav>
  );
  // IF-03: DOM order matches visual order, so the rail comes before main and the tab bar after.
  return (
    <Shell wide={wide}>
      {wide && nav}
      <Main>
        <Suspense fallback={<Loading />}>
          <ActivePluginProvider>
            <Outlet />
          </ActivePluginProvider>
        </Suspense>
      </Main>
      {!wide && nav}
    </Shell>
  );
}

function RequireSignedIn() {
  const { status, user } = useSession();
  const { pathname } = useLocation();
  if (status === 'loading') return <Loading />;
  if (status !== 'signedIn') return <Navigate to="/sign-in" replace />;
  // FR-005: a temporary password must be changed before anything else.
  if (user.mustChangePassword && pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

function RequireAdmin() {
  return useSession().user?.role === 'admin' ? <Outlet /> : <Navigate to="/learn" replace />;
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/invite/:token" element={<AcceptInvitePage />} />
        {/* Password reset by emailed link (#23). */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireSignedIn />}>
          {/* Full screen, outside the tab layout (Product Spec section 2). */}
          <Route path="/lesson/:lessonId" element={<LessonPlayerPage />} />
          <Route path="/unit/:unitId/test-out" element={<LessonPlayerPage />} />
          {/* FR-114: the review session runs in the same player, full screen. */}
          <Route path="/review/session" element={<LessonPlayerPage review />} />
          {/* FR-224: the lesson preview runs the real player, full screen. */}
          <Route element={<RequireAdmin />}>
            <Route
              path="/authoring/lessons/:lessonId/preview"
              element={<LessonPlayerPage preview />}
            />
          </Route>
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<Layout />}>
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/kanji/:key" element={<KanjiDetailPage />} />
            <Route path="/library/grammar" element={<GrammarReferencePage />} />
            <Route path="/library/grammar/:key" element={<GrammarPointPage />} />
            <Route path="/library/words/:key" element={<WordPage />} />
            <Route path="/social" element={<SocialPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/authoring" element={<AuthoringPage />} />
              <Route path="/authoring/lessons/:lessonId" element={<LessonEditorPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/learn" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
