import { useState } from 'react';
import type { ComponentProps, FormEvent, ReactNode } from 'react';
import styled from '@emotion/styled';
import { ApiRequestError } from '@manabi/api-client';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { tapTarget } from '../../theme';

export const Card = styled.main`
  max-width: 420px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing(6)} ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.colors.text};
  font-family: system-ui, sans-serif;
`;

const FieldLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  font-size: ${({ theme }) => theme.fontSizes.small};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Input = styled.input`
  ${({ theme }) => tapTarget(theme)};
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.body};
`;

export const Button = styled.button`
  ${({ theme }) => tapTarget(theme)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  border: 0;
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primaryText};
  font-size: ${({ theme }) => theme.fontSizes.body};
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const Problem = styled.p`
  border-left: 4px solid ${({ theme }) => theme.colors.primary};
  padding-left: ${({ theme }) => theme.spacing(2)};
`;

export function Field({ label, ...input }: ComponentProps<typeof Input> & { label: string }) {
  return (
    <FieldLabel>
      {label}
      <Input {...input} />
    </FieldLabel>
  );
}

/**
 * The message for a failed request, from the i18n catalog by API error code (FR-243).
 * shortcut: validation_failed and conflict show the server's English message, which names the
 * exact rule (common password, name taken); upgrade when the API sends translatable codes.
 */
export function apiErrorMessage(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiRequestError)) return t('errors.network');
  const details = err.details as { reason?: string } | undefined;
  if (err.code === 'unauthenticated' && details?.reason === 'account_disabled') {
    return t('errors.accountDisabled');
  }
  if (err.code === 'unauthenticated' && details?.reason === 'temporary_password_expired') {
    return t('errors.temporaryPasswordExpired');
  }
  if (err.code === 'validation_failed' || err.code === 'conflict') return err.message;
  return t(`errors.${err.code}`);
}

/** A form with one error line: `validate` returns a message to block the submit; `submit` may throw. */
export function Form(props: {
  submitLabel: string;
  validate: () => string | null;
  submit: () => Promise<void>;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const invalid = props.validate();
    setProblem(invalid);
    if (invalid) return;
    setBusy(true);
    try {
      await props.submit();
    } catch (err) {
      setProblem(apiErrorMessage(t, err));
      setBusy(false);
    }
    // No reset on success: the screen is replaced by a redirect.
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {problem && <Problem role="alert">{problem}</Problem>}
      {props.children}
      <Button type="submit" disabled={busy}>
        {props.submitLabel}
      </Button>
    </form>
  );
}
