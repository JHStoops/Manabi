import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ApiRequestError } from '@manabi/api-client';
import { useApi } from '../../state/session';
import { Card, Field, Form } from './ui';

/** FR-005, IF-10: ask for a password-reset email. Works only when the server has SMTP. */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const api = useApi();
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Card>
      <h1>{t('passwordReset.forgotTitle')}</h1>
      {message ? (
        <p role="status">{message}</p>
      ) : (
        <Form
          submitLabel={t('passwordReset.send')}
          validate={() => (identifier.trim() ? null : t('passwordReset.noIdentifier'))}
          submit={async () => {
            try {
              await api.POST('/api/v1/auth/password-reset', { body: { identifier } });
              setMessage(t('passwordReset.sent'));
            } catch (err) {
              // IF-10: no SMTP on this server.
              if (err instanceof ApiRequestError && err.code === 'service_unavailable') {
                return setMessage(t('passwordReset.noEmail'));
              }
              throw err;
            }
          }}
        >
          <Field
            label={t('signIn.identifier')}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
          />
        </Form>
      )}
      <p>
        <Link to="/sign-in">{t('passwordReset.signIn')}</Link>
      </p>
    </Card>
  );
}
