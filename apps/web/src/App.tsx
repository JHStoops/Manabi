import { Suspense, lazy } from 'react';
import styled from '@emotion/styled';
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './i18n';
import { CelebrationHost } from './features/achievements/CelebrationHost';
import { CelebrationProvider, CelebrationScope } from './state/celebrations';
import { ActivePluginProvider } from './state/plugins';
import { useSession } from './state/session';
import { tapTarget, useMediaQuery } from './theme';

// SDD section 9: one lazy chunk per area. Admin and authoring chunks load only behind RequireAdmin.
const LearnPage = lazy(() => import('./features/learn/LearnPage'));
const LessonPlayerPage = lazy(() => import('./features/learn/LessonPlayerPage'));
const ReviewPage = lazy(() => import('./features/review/ReviewPage'));
const LibraryPage = lazy(() => import('./features/library/LibraryPage'));
const CharacterLibraryPage = lazy(() => import('./features/library/CharacterLibraryPage'));
const KanjiDetailPage = lazy(() => import('./features/library/KanjiDetailPage'));
const KanaDetailPage = lazy(() => import('./features/library/KanaDetailPage'));
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
  min-height: 100dvh;
`;

const Nav = styled.nav<{ wide: boolean }>`
  display: flex;
  flex-direction: ${({ wide }) => (wide ? 'column' : 'row')};
  gap: ${({ theme }) => theme.spacing(1)};
  position: sticky;
  z-index: 1;
  background: ${({ theme }) => theme.colors.surface};
  ${({ wide, theme }) =>
    wide
      ? `top: 0;
         flex: 0 0 auto;
         width: 120px;
         height: 100dvh;
         padding: ${theme.spacing(4)} ${theme.spacing(2)};
         border-right: 1px solid ${theme.colors.border};`
      : `bottom: 0;
         padding: ${theme.spacing(1)} ${theme.spacing(1)} max(${theme.spacing(1)}, env(safe-area-inset-bottom));
         border-top: 1px solid ${theme.colors.border};
         /* Equal shares, so six tabs still fit at 360 px. */
         gap: 0;
         > a { flex: 1 1 0; justify-content: center; padding: ${theme.spacing(2)} 2px; font-size: 0.75rem; }`}
`;

const Tab = styled(NavLink)`
  ${({ theme }) => tapTarget(theme)};
  min-width: 0;
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.radii.small};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.small};
  font-weight: 600;
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
  /* The current tab is marked by weight and a tint, not color alone (NFR-31). */
  &.active {
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.primary};
    font-weight: 800;
  }
`;

const Main = styled.main`
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing(6)} ${({ theme }) => theme.spacing(4)}
    ${({ theme }) => theme.spacing(10)};
  @media (min-width: 768px) {
    padding: ${({ theme }) => theme.spacing(8)} ${({ theme }) => theme.spacing(8)};
  }
  &:focus {
    outline: none;
  }
`;

// IF-03: keyboard users can jump past the rail; hidden until focused.
const SkipLink = styled.a`
  position: absolute;
  left: ${({ theme }) => theme.spacing(2)};
  top: ${({ theme }) => theme.spacing(2)};
  z-index: 2;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primaryText};
  transform: translateY(-200%);
  &:focus {
    transform: none;
  }
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
      <SkipLink href="#main">{t('nav.skip')}</SkipLink>
      {wide && nav}
      <Main id="main" tabIndex={-1}>
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
  // FR-165: celebrations show over every signed-in screen, the full-screen player included.
  return (
    <CelebrationProvider>
      <CelebrationScope>
        <Outlet />
      </CelebrationScope>
      <CelebrationHost />
    </CelebrationProvider>
  );
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
            <Route path="/library/kanji" element={<CharacterLibraryPage />} />
            <Route path="/library/kanji/:key" element={<KanjiDetailPage />} />
            <Route path="/library/kana/:key" element={<KanaDetailPage />} />
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
