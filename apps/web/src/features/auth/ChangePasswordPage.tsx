import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MIN_PASSWORD_LENGTH } from '@manabi/core';
import { useApi, useSessionDispatch } from '../../state/session';
import { Card, Field, Form } from './ui';
import SignOutButton from './SignOutButton';

// FR-005: a session on a temporary password lands here and can reach nothing else.
export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const api = useApi();
  const dispatch = useSessionDispatch();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  return (
    <Card>
      <h1>{t('changePassword.title')}</h1>
      <p>{t('changePassword.intro')}</p>
      <Form
        submitLabel={t('changePassword.submit')}
        validate={() => {
          if (!current) return t('changePassword.noCurrent');
          if (next.length < MIN_PASSWORD_LENGTH) {
            return t('field.passwordTooShort', { min: MIN_PASSWORD_LENGTH });
          }
          return next === confirm ? null : t('field.passwordMismatch');
        }}
        submit={async () => {
          const { user } = await api.POST('/api/v1/auth/change-password', {
            body: { currentPassword: current, newPassword: next },
          });
          dispatch({ type: 'signedIn', user });
          navigate('/learn', { replace: true });
        }}
      >
        <Field
          label={t('changePassword.current')}
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
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
      <p>
        <SignOutButton />
      </p>
    </Card>
  );
}
