import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiRequestError } from '@manabi/api-client';
import { MIN_PASSWORD_LENGTH, opaqueTokenSchema } from '@manabi/core';
import { useApi } from '../../state/session';
import { Card, Field, Form } from './ui';

/** FR-005: choose a new password from an emailed link (`/reset-password?token=…`). */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const api = useApi();
  const token = useSearchParams()[0].get('token') ?? '';
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (!opaqueTokenSchema.safeParse(token).success) {
    return (
      <Card>
        <h1>{t('passwordReset.resetTitle')}</h1>
        <p role="alert">{t('passwordReset.invalidLink')}</p>
        <Link to="/forgot-password">{t('signIn.forgot')}</Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1>{t('passwordReset.resetTitle')}</h1>
      {message ? (
        <p role="status">{message}</p>
      ) : (
        <Form
          submitLabel={t('passwordReset.save')}
          validate={() => {
            if (next.length < MIN_PASSWORD_LENGTH) {
              return t('field.passwordTooShort', { min: MIN_PASSWORD_LENGTH });
            }
            return next === confirm ? null : t('field.passwordMismatch');
          }}
          submit={async () => {
            try {
              await api.POST('/api/v1/auth/password-reset/confirm', {
                body: { token, newPassword: next },
              });
              setMessage(t('passwordReset.done'));
            } catch (err) {
              // Used up, expired or unknown link.
              if (err instanceof ApiRequestError && err.code === 'not_found') {
                return setMessage(t('passwordReset.invalidLink'));
              }
              throw err;
            }
          }}
        >
          <Field
            label={t('changePassword.new')}
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
          <Field
            label={t('field.confirmPassword')}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Form>
      )}
      <p>
        <Link to="/sign-in">{t('passwordReset.signIn')}</Link>
      </p>
    </Card>
  );
}
