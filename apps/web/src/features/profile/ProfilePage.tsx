import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  colorModeSchema,
  dailyGoalSchema,
  learnerSettingsSchema,
  MAX_NEW_ITEM_CAP,
  MAX_REVIEW_CAP,
  readingAnnotationModeSchema,
  textSizeSchema,
  themeSchema,
} from '@manabi/core';
import type { User, z } from '@manabi/core';
import { useApi, useSession, useSessionDispatch } from '../../state/session';
import { tapTarget } from '../../theme';
import { apiErrorMessage, Button, Field } from '../auth/ui';
import SessionsList from '../auth/SessionsList';
import SignOutButton from '../auth/SignOutButton';

// The active course changes only by enrolling, so PATCH /me refuses it.
const editable = learnerSettingsSchema.omit({ activeCourseId: true });
type Settings = z.infer<typeof editable>;

const GOALS = dailyGoalSchema.options.map((goal) => goal.value);

const Group = styled.fieldset`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.medium};
  margin: 0 0 ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const Label = styled.label`
  ${({ theme }) => tapTarget(theme)};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const Select = styled.select`
  ${({ theme }) => tapTarget(theme)};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.body};
`;

function Toggle(props: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <Label>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      {props.label}
    </Label>
  );
}

function Choice<T extends string | number>(props: {
  label: string;
  value: T;
  options: readonly T[];
  optionLabel: (option: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <Label>
      {props.label}
      <Select
        value={String(props.value)}
        onChange={(e) => props.onChange(props.options.find((o) => String(o) === e.target.value)!)}
      >
        {props.options.map((option) => (
          <option key={option} value={option}>
            {props.optionLabel(option)}
          </option>
        ))}
      </Select>
    </Label>
  );
}

// FR-007, Product Spec section 11: the learner's profile and settings, saved through PATCH /me.
// Most settings are stored here and take effect in the features that read them.
function SettingsForm({ user }: { user: User }) {
  const { t } = useTranslation();
  const api = useApi();
  const dispatch = useSessionDispatch();
  const theme = useTheme();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [timeZone, setTimeZone] = useState(user.timeZone);
  const [settings, setSettings] = useState<Settings>(() => editable.parse(user.settings));
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Settings>) => {
    setSaved(false);
    setSettings((current) => ({ ...current, ...patch }));
  };
  const s = settings;
  // The stored zone first: the runtime's list may lack it (some omit 'UTC').
  const zones = [...new Set([timeZone, ...Intl.supportedValuesOf('timeZone')])];

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    if (!displayName.trim()) {
      setProblem(t('invite.noDisplayName'));
      return;
    }
    setProblem(null);
    setBusy(true);
    try {
      const updated = await api.PATCH('/api/v1/me', { body: { displayName, timeZone, settings } });
      dispatch({ type: 'signedIn', user: updated });
      setSaved(true);
    } catch (err) {
      setProblem(apiErrorMessage(t, err));
    }
    setBusy(false);
  }

  const group = (legend: string, children: ReactNode) => (
    <Group>
      <legend>{legend}</legend>
      {children}
    </Group>
  );

  return (
    <form onSubmit={save} noValidate>
      {group(
        t('profile.groups.profile'),
        <>
          <Field
            label={t('invite.displayName')}
            value={displayName}
            maxLength={100}
            onChange={(e) => {
              setSaved(false);
              setDisplayName(e.target.value);
            }}
          />
          <Label>
            {t('profile.avatarColor')}
            {/* Null derives the color from the name; the picker shows the theme color until set. */}
            <input
              type="color"
              value={s.avatarColor ?? theme.colors.primary}
              onChange={(e) => set({ avatarColor: e.target.value })}
            />
          </Label>
          <Field
            label={t('profile.avatarInitial')}
            value={s.avatarInitial ?? ''}
            onChange={(e) => set({ avatarInitial: e.target.value || null })}
          />
          <Choice
            label={t('profile.timeZone')}
            value={timeZone}
            options={zones}
            optionLabel={(zone) => zone}
            onChange={(zone) => {
              setSaved(false);
              setTimeZone(zone);
            }}
          />
          <p>
            <Link to="/change-password">{t('changePassword.submit')}</Link>
          </p>
        </>,
      )}
      {group(
        t('profile.groups.study'),
        <>
          <Choice
            label={t('invite.dailyGoal')}
            value={s.dailyGoal}
            options={GOALS}
            optionLabel={(count) => t('invite.goalXp', { count })}
            onChange={(dailyGoal) => set({ dailyGoal })}
          />
          <Field
            label={t('profile.newItemCap')}
            type="number"
            min={0}
            max={MAX_NEW_ITEM_CAP}
            value={s.newItemCap}
            onChange={(e) => set({ newItemCap: Number(e.target.value) })}
          />
          <Field
            label={t('profile.reviewCap')}
            type="number"
            min={1}
            max={MAX_REVIEW_CAP}
            value={s.reviewCap}
            onChange={(e) => set({ reviewCap: Number(e.target.value) })}
          />
          <Toggle
            label={t('profile.drawingExercises')}
            checked={s.drawingExercises}
            onChange={(drawingExercises) => set({ drawingExercises })}
          />
          <Toggle
            label={t('profile.preferWordBank')}
            checked={s.preferWordBank}
            onChange={(preferWordBank) => set({ preferWordBank })}
          />
        </>,
      )}
      {group(
        t('profile.groups.display'),
        <>
          <Choice
            label={t('profile.theme')}
            value={s.theme}
            options={themeSchema.options}
            optionLabel={(name) => t(`profile.themes.${name}`)}
            onChange={(theme) => set({ theme })}
          />
          <Choice
            label={t('profile.colorMode')}
            value={s.colorMode}
            options={colorModeSchema.options}
            optionLabel={(mode) => t(`profile.colorModes.${mode}`)}
            onChange={(colorMode) => set({ colorMode })}
          />
          {/* shortcut: always shown with Japanese labels since ja is the only course; show only
              when the course's plugin enables features.readingAnnotations once a second language lands. */}
          <Choice
            label={t('profile.readingAnnotations')}
            value={s.readingAnnotations}
            options={readingAnnotationModeSchema.options}
            optionLabel={(mode) => t(`profile.readingAnnotationModes.${mode}`)}
            onChange={(readingAnnotations) => set({ readingAnnotations })}
          />
          <Choice
            label={t('profile.targetTextSize')}
            value={s.targetTextSize}
            options={textSizeSchema.options}
            optionLabel={(size) => t(`profile.textSizes.${size}`)}
            onChange={(targetTextSize) => set({ targetTextSize })}
          />
        </>,
      )}
      {group(
        t('profile.groups.soundMotion'),
        <>
          <Toggle
            label={t('profile.soundEffects')}
            checked={s.soundEffects}
            onChange={(soundEffects) => set({ soundEffects })}
          />
          <Toggle
            label={t('profile.audioAutoplay')}
            checked={s.audioAutoplay}
            onChange={(audioAutoplay) => set({ audioAutoplay })}
          />
          <Toggle
            label={t('profile.reducedMotion')}
            checked={s.reducedMotion}
            onChange={(reducedMotion) => set({ reducedMotion })}
          />
        </>,
      )}
      {group(
        t('profile.groups.social'),
        <>
          <Toggle
            label={t('profile.appearOnLeaderboard')}
            checked={s.appearOnLeaderboard}
            onChange={(appearOnLeaderboard) => set({ appearOnLeaderboard })}
          />
          <Toggle
            label={t('profile.allowNudges')}
            checked={s.allowNudges}
            onChange={(allowNudges) => set({ allowNudges })}
          />
        </>,
      )}
      {/* The Data group (export my progress, delete my account) comes with #74. */}
      {problem && <p role="alert">{problem}</p>}
      <p role="status">{saved ? t('profile.saved') : ''}</p>
      <Button type="submit" disabled={busy}>
        {t('profile.save')}
      </Button>
    </form>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useSession();
  return (
    <>
      <h1>{t('area.profile')}</h1>
      {user && <SettingsForm user={user} />}
      <SignOutButton />
      <SessionsList />
    </>
  );
}
