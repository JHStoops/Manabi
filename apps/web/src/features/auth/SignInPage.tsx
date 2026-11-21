import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '@manabi/api-client';
import { useApi, useSession, useSessionDispatch } from '../../state/session';
import { Card, Field, Form } from './ui';

// FR-003
export default function SignInPage() {
  const { t } = useTranslation();
  const api = useApi();
  const session = useSession();
  const dispatch = useSessionDispatch();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  if (session.status === 'signedIn') return <Navigate to="/learn" replace />;

  return (
    <Card>
      <h1>{t('area.signIn')}</h1>
      <Form
        submitLabel={t('area.signIn')}
        validate={() => (identifier.trim() && password ? null : t('signIn.required'))}
        submit={async () => {
          try {
            const { user } = await api.POST('/api/v1/auth/login', {
              body: { identifier: identifier.trim(), password, clientKind: 'web' },
            });
            dispatch({ type: 'signedIn', user });
          } catch (err) {
            // A 401 without a reason is a wrong name or password, not an ended session.
            if (err instanceof ApiRequestError && err.code === 'unauthenticated' && !err.details) {
              throw new ApiRequestError(401, 'validation_failed', t('signIn.invalid'));
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
          autoCapitalize="none"
        />
        <Field
          label={t('field.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </Form>
      <p>
        <Link to="/forgot-password">{t('signIn.forgot')}</Link>
      </p>
    </Card>
  );
}
