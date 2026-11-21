import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiRequestError } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';

// Component tests for the password-reset pages (#23): FR-005, IF-10.

const TOKEN = 'a'.repeat(43);

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

function show(ui: JSX.Element, post: jest.Mock, path = '/') {
  render(
    <ApiContext.Provider value={{ POST: post } as unknown as ApiClient}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
}

describe('ForgotPasswordPage', () => {
  it('asks for a reset email', async () => {
    const post = jest.fn().mockResolvedValue(undefined);
    show(<ForgotPasswordPage />, post);
    fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'hana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/reset link is on its way/)).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/api/v1/auth/password-reset', {
      body: { identifier: 'hana' },
    });
  });

  it('points to an admin when the server has no email', async () => {
    const post = jest
      .fn()
      .mockRejectedValue(new ApiRequestError(503, 'service_unavailable', 'no email'));
    show(<ForgotPasswordPage />, post);
    fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'hana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/Ask an admin for a temporary password/)).toBeTruthy();
  });
});

describe('ResetPasswordPage', () => {
  function fill(password: string, repeat = password) {
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: repeat } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
  }

  it('checks the password before sending, then saves it with the link token', async () => {
    const post = jest.fn().mockResolvedValue(undefined);
    show(<ResetPasswordPage />, post, `/reset-password?token=${TOKEN}`);
    fill('short');
    expect(await screen.getByText('Use a password of at least 10 characters.')).toBeTruthy();
    fill('a brand new secret', 'something else');
    expect(await screen.findByText('The two passwords do not match.')).toBeTruthy();
    expect(post).not.toHaveBeenCalled();

    fill('a brand new secret');
    expect(await screen.findByText(/Your password is changed/)).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/api/v1/auth/password-reset/confirm', {
      body: { token: TOKEN, newPassword: 'a brand new secret' },
    });
  });

  it('refuses a link without a well-formed token', () => {
    show(<ResetPasswordPage />, jest.fn(), '/reset-password?token=nope');
    expect(screen.getByRole('alert').textContent).toMatch(/not valid or has expired/);
  });

  it('says when the link is used up or expired', async () => {
    const post = jest.fn().mockRejectedValue(new ApiRequestError(404, 'not_found', 'nope'));
    show(<ResetPasswordPage />, post, `/reset-password?token=${TOKEN}`);
    fill('a brand new secret');
    expect(await screen.findByText(/not valid or has expired/)).toBeTruthy();
  });
});
