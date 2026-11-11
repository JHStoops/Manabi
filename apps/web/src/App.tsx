import styled from '@emotion/styled';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

const Shell = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  font-family: system-ui, sans-serif;
`;

const Nav = styled.nav`
  display: flex;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  a {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const Main = styled.main`
  padding: ${({ theme }) => theme.spacing(4)};
`;

// PLACEHOLDER pages: each route is replaced by its feature under src/features/.
function Placeholder({ title }: { title: string }) {
  return <h1>{title}</h1>;
}

const routes = ['learn', 'review', 'library', 'social', 'profile', 'admin'] as const;

export function App() {
  return (
    <Shell>
      <Nav>
        {routes.map((route) => (
          <NavLink key={route} to={`/${route}`}>
            {route}
          </NavLink>
        ))}
      </Nav>
      <Main>
        <Routes>
          <Route path="/" element={<Navigate to="/learn" replace />} />
          {routes.map((route) => (
            <Route key={route} path={`/${route}`} element={<Placeholder title={route} />} />
          ))}
        </Routes>
      </Main>
    </Shell>
  );
}
