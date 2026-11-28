import styled from '@emotion/styled';
import { useEffect, useReducer, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '@manabi/api-client';
import { AUDIO_UPLOAD_MAX_BYTES, AUDIO_UPLOAD_TYPES } from '@manabi/core';
import type { AuthoringAudioStatus } from '@manabi/core';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';
import { Button, Form } from '../admin/ui';
import { clipUrl } from '../audio/speech';

// FR-132, SDD section 11 (Uploads): an author's recording replaces the generated clip of an item
// or sentence. The server checks and transcodes the file; this form only picks the audio type.

const Panel = styled.section`
  margin: ${({ theme }) => theme.spacing(3)} 0;

  audio {
    display: block;
    width: 100%;
    max-width: 24rem;
    min-height: 44px;
  }
  input[type='file'] {
    max-width: 100%;
  }
`;

const EXTENSION_TYPES: Record<string, string> = {
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  flac: 'audio/flac',
};

/** The audio type to send a file as, from its own type or else its extension; null if neither. */
export function uploadType(file: { name: string; type: string }): string | null {
  const own = file.type.split(';')[0]!.trim().toLowerCase();
  if ((AUDIO_UPLOAD_TYPES as readonly string[]).includes(own)) return own;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[extension] ?? null;
}

type Owner = { ownerType: 'item' | 'sentence'; ownerId: number };

export function RecordingUpload({ ownerType, ownerId }: Owner) {
  const { t } = useTranslation();
  const api = useApi();
  const [status, setStatus] = useState<AuthoringAudioStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  // Remounts the player after a change, so it loads the clip that plays now.
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const params = { path: { ownerType, ownerId: String(ownerId) } };
  const id = `recording-${ownerType}-${ownerId}`;

  useEffect(() => {
    let live = true;
    api
      .GET('/api/v1/authoring/audio/{ownerType}/{ownerId}', {
        params: { path: { ownerType, ownerId: String(ownerId) } },
      })
      .then((s) => live && setStatus(s))
      .catch((err: unknown) => live && setMessage(apiErrorMessage(t, err)));
    return () => {
      live = false;
    };
  }, [api, t, ownerType, ownerId]);

  async function change(request: () => Promise<AuthoringAudioStatus>, done: string) {
    setBusy(true);
    setMessage('');
    try {
      setStatus(await request());
      setMessage(done);
      setFile(null);
      bump();
    } catch (err) {
      // The server says why a file was refused (too long, not audio): show its message.
      const refused = err instanceof ApiRequestError && err.code === 'bad_request';
      setMessage(refused ? err.message : apiErrorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    const type = uploadType(file);
    if (!type) return setMessage(t('authoring.recording.unsupported'));
    if (file.size > AUDIO_UPLOAD_MAX_BYTES) return setMessage(t('authoring.recording.tooLarge'));
    void change(
      () =>
        api.PUT('/api/v1/authoring/audio/{ownerType}/{ownerId}', {
          params,
          // The raw file is the body (the route reads audio types only), not JSON.
          body: file,
          bodySerializer: (body: unknown) => body as Blob,
          headers: { 'content-type': type },
        }),
      t('authoring.recording.saved'),
    );
  }

  const remove = () =>
    void change(
      () => api.DELETE('/api/v1/authoring/audio/{ownerType}/{ownerId}', { params }),
      t('authoring.recording.removed'),
    );

  const state = !status
    ? ''
    : status.stale
      ? t('authoring.recording.stale')
      : status.uploaded
        ? t('authoring.recording.uploaded')
        : t('authoring.recording.generated');

  return (
    <Panel aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>{t('authoring.recording.heading')}</h3>
      {state && <p>{state}</p>}
      <audio
        key={version}
        controls
        preload="none"
        src={clipUrl({ type: ownerType, id: ownerId })}
        aria-label={t('authoring.recording.listen')}
      />
      <p id={`${id}-limits`}>{t('authoring.recording.limits')}</p>
      <Form onSubmit={upload}>
        <label htmlFor={`${id}-file`}>
          {t('authoring.recording.file')}
          <input
            key={version}
            id={`${id}-file`}
            aria-describedby={`${id}-limits`}
            type="file"
            accept={[...AUDIO_UPLOAD_TYPES, '.opus', '.m4a', '.flac'].join(',')}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <Button type="submit" disabled={!file || busy}>
          {t('authoring.recording.upload')}
        </Button>
        {status?.uploaded && (
          <Button type="button" onClick={remove} disabled={busy}>
            {t('authoring.recording.remove')}
          </Button>
        )}
      </Form>
      <p aria-live="polite">{message}</p>
    </Panel>
  );
}
