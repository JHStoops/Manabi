import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '@manabi/api-client';
import { MIN_PASSWORD_LENGTH, opaqueTokenSchema, usernameSchema } from '@manabi/core';
import { useApi, useSession, useSessionDispatch } from '../../state/session';
import { Card, Field, Form } from './ui';

const GOALS = [10, 20, 30, 50] as const;

// FR-001, NFR-32: the invite link opens here; accepting signs the new learner in.
export default function AcceptInvitePage() {
  const { t } = useTranslation();
  const api = useApi();
  const session = useSession();
  const dispatch = useSessionDispatch();
  const { token = '' } = useParams();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [dailyGoal, setDailyGoal] = useState<(typeof GOALS)[number]>(20);

  if (session.status === 'signedIn') return <Navigate to="/learn" replace />;

  // A link cut short by a mail client: say so before the form is filled.
  if (!opaqueTokenSchema.safeParse(token).success) {
    return (
      <Card>
        <h1>{t('invite.title')}</h1>
        <p role="alert">{t('invite.invalid')}</p>
      </Card>
    );
  }

  function validate() {
    if (!usernameSchema.safeParse(username).success) return t('invite.badUsername');
    if (!displayName.trim()) return t('invite.noDisplayName');
    if (password.length < MIN_PASSWORD_LENGTH) {
      return t('field.passwordTooShort', { min: MIN_PASSWORD_LENGTH });
    }
    return password === confirm ? null : t('field.passwordMismatch');
  }

  return (
    <Card>
      <h1>{t('invite.title')}</h1>
      <Form
        submitLabel={t('invite.submit')}
        validate={validate}
        submit={async () => {
          try {
            const { user } = await api.POST('/api/v1/auth/accept-invite', {
              body: {
                token,
                username,
                displayName: displayName.trim(),
                password,
                dailyGoal,
                clientKind: 'web',
              },
            });
            dispatch({ type: 'signedIn', user });
          } catch (err) {
            // A bad, used, expired or revoked token is a 404; say so instead of "not found".
            if (err instanceof ApiRequestError && err.code === 'not_found') {
              throw new ApiRequestError(404, 'validation_failed', t('invite.invalid'));
            }
            throw err;
          }
        }}
      >
        <Field
          label={t('invite.username')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
        />
        <Field
          label={t('invite.displayName')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
        />
        <Field
          label={t('field.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <Field
          label={t('field.confirmPassword')}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        <fieldset>
          <legend>{t('invite.dailyGoal')}</legend>
          {GOALS.map((goal) => (
            <label key={goal}>
              <input
                type="radio"
                name="dailyGoal"
                checked={dailyGoal === goal}
                onChange={() => setDailyGoal(goal)}
              />
              {t('invite.goalXp', { count: goal })}
            </label>
          ))}
        </fieldset>
      </Form>
    </Card>
  );
}
