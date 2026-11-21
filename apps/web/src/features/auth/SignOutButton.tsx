import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi, useSessionDispatch } from '../../state/session';
import { apiErrorMessage, Button } from './ui';

// FR-004
export default function SignOutButton() {
  const { t } = useTranslation();
  const api = useApi();
  const dispatch = useSessionDispatch();
  const [problem, setProblem] = useState<string | null>(null);

  async function signOut() {
    try {
      await api.POST('/api/v1/auth/logout', { body: {} });
      dispatch({ type: 'signedOut' });
    } catch (err) {
      setProblem(apiErrorMessage(t, err));
    }
  }

  return (
    <>
      <Button type="button" onClick={signOut}>
        {t('signOut')}
      </Button>
      {problem && <p role="alert">{problem}</p>}
    </>
  );
}
