import { Suspense, lazy } from 'react';
import styled from '@emotion/styled';
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { t } from './i18n';
import { useSession } from './state/session';
import { tapTarget, useMediaQuery } from './theme';

// SDD section 9: one lazy chunk per area. Admin and authoring chunks load only behind RequireAdmin.
const LearnPage = lazy(() => import('./features/learn/LearnPage'));
const LessonPlayerPage = lazy(() => import('./features/learn/LessonPlayerPage'));
const ReviewPage = lazy(() => import('./features/review/ReviewPage'));
const LibraryPage = lazy(() => import('./features/library/LibraryPage'));
const SocialPage = lazy(() => import('./features/social/SocialPage'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));
const AuthoringPage = lazy(() => import('./features/authoring/AuthoringPage'));

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

const loading = <p>{t('app.loading')}</p>;

function Layout() {
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
        <Suspense fallback={loading}>
          <Outlet />
        </Suspense>
      </Main>
      {!wide && nav}
    </Shell>
  );
}

function RequireSignedIn() {
  const { status } = useSession();
  if (status === 'loading') return loading;
  return status === 'signedIn' ? <Outlet /> : <Navigate to="/sign-in" replace />;
}

function RequireAdmin() {
  return useSession().user?.role === 'admin' ? <Outlet /> : <Navigate to="/learn" replace />;
}

// Stub: the sign-in screen comes with #22.
function SignInPage() {
  return <h1>{t('area.signIn')}</h1>;
}

export function App() {
  return (
    <Suspense fallback={loading}>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route element={<RequireSignedIn />}>
          {/* Full screen, outside the tab layout (Product Spec section 2). */}
          <Route path="/lesson/:lessonId" element={<LessonPlayerPage />} />
          <Route element={<Layout />}>
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/social" element={<SocialPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/authoring" element={<AuthoringPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/learn" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
