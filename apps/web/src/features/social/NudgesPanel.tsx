import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Nudge } from '@manabi/core';
import { useApi } from '../../state/session';
import { Section } from '../admin/ui';
import { apiErrorMessage } from '../auth/ui';

/** FR-183: the nudges friends sent, read on opening the tab; unseen ones are marked as new. */
export function NudgesPanel() {
  const { t } = useTranslation();
  const api = useApi();
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .GET('/api/v1/nudges')
      .then(async (body) => {
        setNudges(body.nudges);
        if (body.nudges.some((n) => !n.seen)) await api.POST('/api/v1/nudges/seen', { body: {} });
      })
      .catch((err: unknown) => setMessage(apiErrorMessage(t, err)));
  }, [api, t]);

  return (
    <Section aria-labelledby="social-nudges">
      <h2 id="social-nudges">{t('social.nudges.title')}</h2>
      {message && <p role="alert">{message}</p>}
      {nudges.length === 0 && !message && <p>{t('social.nudges.empty')}</p>}
      <ul>
        {nudges.map((n) => (
          <li key={n.id}>
            {t(`social.nudges.kinds.${n.kind}`, { name: n.fromDisplayName })}
            {!n.seen && <strong> {t('social.nudges.new')}</strong>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
