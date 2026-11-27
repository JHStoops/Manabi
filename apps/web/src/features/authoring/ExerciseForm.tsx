import styled from '@emotion/styled';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '@manabi/api-client';
import { getExerciseType, z } from '@manabi/core';
import type { ExerciseWrite } from '@manabi/core';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';
import { Button } from '../admin/ui';

// FR-223, FR-238, FR-237: the exercise form. Its fields come from the exercise type's payload
// schema in the registry (as JSON Schema), so every type gets its form, tiles included, and the
// server validates the payload with the same schema. Answer text whose text changes loses its
// tiles, so the server segments it again; tiles the author edits are kept.

type Json = unknown;
type JsonObject = { [key: string]: Json };
interface Schema {
  type?: string;
  enum?: string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  anyOf?: Schema[];
  minItems?: number;
}

const isObject = (v: Json): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The payload schema of an exercise type as JSON Schema (refinements are checked on save). */
export function payloadSchema(type: string): Schema {
  return z.toJSONSchema(getExerciseType(type).payloadSchema, {
    unrepresentable: 'any',
    io: 'input',
  }) as Schema;
}

/** A nullable field's non-null variant. */
const unwrap = (s: Schema): Schema => s.anyOf?.find((v) => v.type !== 'null') ?? s;

/**
 * An empty value for a schema: required properties, and arrays at their minimum length, except
 * `tiles`, which stay empty for the server to segment.
 */
export function emptyValue(schema: Schema, key?: string): Json {
  const s = unwrap(schema);
  if (s.enum) return s.enum[0];
  switch (s.type) {
    case 'object':
      return Object.fromEntries(
        (s.required ?? []).map((k) => [k, emptyValue(s.properties![k]!, k)]),
      );
    case 'array':
      return key === 'tiles'
        ? []
        : Array.from({ length: s.minItems ?? 0 }, () => emptyValue(s.items!));
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    default:
      return '';
  }
}

const Fieldset = styled.fieldset`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.small};
  margin: ${({ theme }) => theme.spacing(1)} 0;
  padding: ${({ theme }) => theme.spacing(2)};
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: end;
  label {
    display: flex;
    flex-direction: column;
    font-size: ${({ theme }) => theme.fontSizes.small};
  }
  input,
  select {
    min-height: 44px;
  }
`;

/** One field of the payload, by its schema: text, number, choice, checkbox, list or group. */
function Field(props: {
  schema: Schema;
  label: string;
  value: Json;
  required: boolean;
  onChange: (value: Json) => void;
}) {
  const { t } = useTranslation();
  const s = unwrap(props.schema);
  const { label, value, onChange } = props;

  if (s.type === 'object') {
    const object = isObject(value) ? value : {};
    return (
      <Fieldset aria-label={label}>
        <legend>{label}</legend>
        {Object.entries(s.properties ?? {}).map(([key, child]) => (
          <Field
            key={key}
            schema={child}
            label={key}
            value={object[key]}
            required={(s.required ?? []).includes(key)}
            onChange={(v) => {
              const next = { ...object, [key]: v };
              if (v === undefined) delete next[key];
              // Changed answer text gets new tiles from the server (FR-238).
              if (key === 'text' && Array.isArray(object.tiles)) next.tiles = [];
              onChange(next);
            }}
          />
        ))}
      </Fieldset>
    );
  }

  if (s.type === 'array') {
    const list = Array.isArray(value) ? value : [];
    const set = (next: Json[]) => onChange(!props.required && next.length === 0 ? undefined : next);
    return (
      <Fieldset aria-label={label}>
        <legend>{label}</legend>
        {list.map((item, i) => (
          <div key={i}>
            <Field
              schema={s.items!}
              label={`${label} ${i + 1}`}
              value={item}
              required
              onChange={(v) => set(list.map((old, j) => (j === i ? v : old)))}
            />
            <Button
              type="button"
              aria-label={t('lessonEditor.removeEntry', { label: `${label} ${i + 1}` })}
              onClick={() => set(list.filter((_, j) => j !== i))}
            >
              {t('lessonEditor.remove')}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          aria-label={t('lessonEditor.addEntry', { label })}
          onClick={() => set([...list, emptyValue(s.items!)])}
        >
          {t('lessonEditor.add')}
        </Button>
      </Fieldset>
    );
  }

  if (s.type === 'boolean') {
    return (
      <label>
        {label}
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) =>
            onChange(e.target.checked || props.required ? e.target.checked : undefined)
          }
        />
      </label>
    );
  }

  if (s.enum) {
    return (
      <label>
        {label}
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {s.enum.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  const numeric = s.type === 'integer' || s.type === 'number';
  return (
    <label>
      {label}
      <input
        type={numeric ? 'number' : 'text'}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => {
          const text = e.target.value;
          if (text === '' && !props.required) return onChange(undefined);
          onChange(numeric ? Number(text) : text);
        }}
      />
    </label>
  );
}

/** A one-line summary of an exercise: its prompt, else its payload. */
export function exerciseSummary({ payload }: { payload: Record<string, unknown> }): string {
  return typeof payload.prompt === 'string' ? payload.prompt : JSON.stringify(payload);
}

/**
 * Writes one exercise: a new one (`exerciseId` absent) or an edit. On save it shows the blocklist
 * warning the server returns (FR-237); "Re-segment" replaces every answer text's tiles (FR-238).
 */
export function ExerciseForm(props: {
  /** The lesson a new exercise is added to; an edit needs none (#241: item-level exercises). */
  lessonId?: number;
  type: string;
  origin: 'authored' | 'pinned';
  exerciseId?: number;
  payload?: JsonObject;
  onSaved: (write: ExerciseWrite) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const schema = useMemo(() => payloadSchema(props.type), [props.type]);
  const [payload, setPayload] = useState<JsonObject>(
    () => props.payload ?? (emptyValue(schema) as JsonObject),
  );
  const [problems, setProblems] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function save(resegment: boolean) {
    setBusy(true);
    setProblems([]);
    try {
      const write = props.exerciseId
        ? await api.PATCH('/api/v1/authoring/exercises/{id}', {
            params: { path: { id: String(props.exerciseId) } },
            body: { payload, resegment },
          })
        : await api.POST('/api/v1/authoring/exercises', {
            body: {
              lessonId: props.lessonId!,
              type: props.type,
              origin: props.origin,
              payload,
              resegment,
            },
          });
      setPayload(write.exercise.payload);
      setBlocked(write.blockedWords);
      props.onSaved(write);
    } catch (err) {
      const details = err instanceof ApiRequestError ? err.details : null;
      const issues = Array.isArray(details)
        ? (details as { path: (string | number)[]; message: string }[]).map(
            (d) => `${d.path.join('.')}: ${d.message}`,
          )
        : [];
      setProblems([apiErrorMessage(t, err), ...issues]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void save(false);
  }

  return (
    <form aria-label={t('lessonEditor.exerciseForm', { type: props.type })} onSubmit={submit}>
      <Field
        schema={schema}
        label={props.type}
        value={payload}
        required
        onChange={(v) => setPayload(v as JsonObject)}
      />
      {problems.length > 0 && (
        <ul role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {blocked.length > 0 && (
        <p role="status">{t('lessonEditor.blockedWords', { words: blocked.join(', ') })}</p>
      )}
      <Button type="submit" disabled={busy}>
        {t('authoring.save')}
      </Button>
      <Button type="button" disabled={busy} onClick={() => void save(true)}>
        {t('lessonEditor.resegment')}
      </Button>
      <Button type="button" onClick={props.onCancel}>
        {t('authoring.cancel')}
      </Button>
    </form>
  );
}
