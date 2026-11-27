import styled from '@emotion/styled';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '@manabi/api-client';
import type { AuthoringItem, AuthoringItemSummary, ItemField, JsonObject } from '@manabi/core';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';
import { Button, Form, Section } from '../admin/ui';
import { ItemExercises } from './ItemExercises';

// FR-221, DR-06, DR-09, Product Spec section 11 (Content editor): find an item, edit its fields
// with the imported values pre-filled, and clear an override to get the imported value back.
// #241: list, edit and remove the item's item-level exercises.
// The form is built from the field metadata the API derives from the plugin's item schema.

const Fields = styled.form`
  display: grid;
  gap: ${({ theme }) => theme.spacing(2)};
  max-width: 40rem;

  label {
    display: flex;
    flex-direction: column;
  }
  input,
  textarea {
    min-height: 44px;
  }
`;

/** A field's value as form text. */
function toText(field: ItemField, value: unknown): string {
  if (value === undefined) return '';
  if (field.kind === 'text' || field.kind === 'longText' || field.kind === 'number')
    return String(value);
  if (field.kind === 'textList') return (value as string[]).join('\n');
  return JSON.stringify(value, null, 2);
}

/** Form text back to a value; undefined for an empty field. Throws on malformed JSON. */
function fromText(field: ItemField, text: string): unknown {
  if (text.trim() === '') return field.kind === 'textList' ? [] : undefined;
  if (field.kind === 'text' || field.kind === 'longText') return text;
  if (field.kind === 'number') return Number(text);
  if (field.kind === 'textList') return text.split('\n').filter((line) => line.trim() !== '');
  return JSON.parse(text) as unknown;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function ItemEditor({ courseId }: { courseId: number }) {
  const { t } = useTranslation();
  const api = useApi();
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<AuthoringItemSummary[] | null>(null);
  const [item, setItem] = useState<AuthoringItem | null>(null);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState({ key: '', level: '', pattern: '' });

  async function run<T>(request: Promise<T>, then: (value: T) => void) {
    setMessage('');
    try {
      then(await request);
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
    }
  }

  function find(event: FormEvent) {
    event.preventDefault();
    const query = { course: String(courseId), ...(search ? { q: search } : {}) };
    void run(api.GET('/api/v1/authoring/items', { params: { query } }), (body) =>
      setFound(body.items),
    );
  }

  // FR-222: a new grammar point starts as a stub: its key, level and pattern.
  function create(event: FormEvent) {
    event.preventDefault();
    const body = {
      course: courseId,
      type: 'grammar',
      key: draft.key,
      level: draft.level || null,
      data: { pattern: draft.pattern },
    };
    void run(api.POST('/api/v1/authoring/items', { body }), (created) => {
      setItem(created);
      setDraft({ key: '', level: '', pattern: '' });
    });
  }

  const open = (id: number) =>
    void run(
      api.GET('/api/v1/authoring/items/{id}', { params: { path: { id: String(id) } } }),
      setItem,
    );

  return (
    <Section aria-labelledby="authoring-items">
      <h2 id="authoring-items">{t('authoring.items.heading')}</h2>
      <Form onSubmit={find} role="search">
        <label>
          {t('authoring.items.search')}
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Button type="submit">{t('authoring.items.find')}</Button>
      </Form>
      <Form onSubmit={create} aria-label={t('authoring.items.newGrammar')}>
        {(['key', 'level', 'pattern'] as const).map((name) => (
          <label key={name}>
            {t(`authoring.items.grammar.${name}`)}
            <input
              value={draft[name]}
              required={name !== 'level'}
              onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
            />
          </label>
        ))}
        <Button type="submit">{t('authoring.items.create')}</Button>
      </Form>
      {message && <p role="alert">{message}</p>}
      {found && found.length === 0 && <p>{t('authoring.items.none')}</p>}
      {found && found.length > 0 && (
        <ul aria-label={t('authoring.items.results')}>
          {found.map((i) => (
            <li key={i.id}>
              <Button type="button" onClick={() => open(i.id)}>
                {i.key}
                {i.overridden && ` (${t('authoring.items.edited')})`}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {item && (
        <ItemForm
          key={`${item.id}:${JSON.stringify(item.overrides)}`}
          item={item}
          onSaved={setItem}
        />
      )}
      {item && <ItemExercises key={item.id} itemId={item.id} itemKey={item.key} />}
    </Section>
  );
}

function ItemForm({
  item,
  onSaved,
}: {
  item: AuthoringItem;
  onSaved: (item: AuthoringItem) => void;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const [values, setValues] = useState(() =>
    Object.fromEntries(item.fields.map((f) => [f.name, toText(f, item.effective[f.name])])),
  );
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // FR-222: an authored item's level and related items; an imported item's come from its import.
  const authored = item.source === null;
  const [level, setLevel] = useState(item.levelCode ?? '');
  const [related, setRelated] = useState(item.related.join('\n'));

  async function save(overrides: JsonObject, withLinks = false) {
    setMessage('');
    setFieldErrors({});
    const links = {
      level: level.trim() || null,
      related: related.split('\n').flatMap((line) => line.trim() || []),
    };
    try {
      onSaved(
        await api.PATCH('/api/v1/authoring/items/{id}', {
          params: { path: { id: String(item.id) } },
          body: withLinks ? { overrides, ...links } : { overrides },
        }),
      );
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
      if (err instanceof ApiRequestError && Array.isArray(err.details)) {
        const issues = err.details as { path: (string | number)[]; message: string }[];
        setFieldErrors(Object.fromEntries(issues.map((i) => [String(i.path[1] ?? ''), i.message])));
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // Only fields that differ from the imported data become overrides (DR-09).
    const overrides: JsonObject = {};
    for (const field of item.fields) {
      let value: unknown;
      try {
        value = fromText(field, values[field.name] ?? '');
      } catch {
        setFieldErrors({ [field.name]: t('authoring.items.badJson') });
        return;
      }
      // An empty list matches a list field the data leaves out (its schema default).
      const imported = item.data[field.name] ?? (field.kind === 'textList' ? [] : undefined);
      if (value !== undefined && !same(value, imported)) overrides[field.name] = value;
    }
    void save(overrides, authored);
  }

  function clear(name: string) {
    void save(Object.fromEntries(Object.entries(item.overrides).filter(([k]) => k !== name)));
  }

  return (
    <Fields onSubmit={submit} aria-labelledby="authoring-item">
      <h3 id="authoring-item">{item.key}</h3>
      <p>
        {item.source
          ? t('authoring.items.imported', {
              source: item.source,
              version: item.datasetVersion ?? '',
            })
          : t('authoring.items.authored')}
      </p>
      {message && <p role="alert">{message}</p>}
      {authored && (
        <>
          <label>
            {t('authoring.level')}
            <input value={level} onChange={(e) => setLevel(e.target.value)} />
          </label>
          <label>
            {t('authoring.items.related')}
            <textarea rows={2} value={related} onChange={(e) => setRelated(e.target.value)} />
          </label>
        </>
      )}
      {item.fields.map((field) => {
        const id = `item-field-${field.name}`;
        const overridden = Object.hasOwn(item.overrides, field.name);
        const multiline = field.kind !== 'text' && field.kind !== 'number';
        const input = {
          id,
          value: values[field.name] ?? '',
          'aria-describedby': `${id}-note`,
          'aria-invalid': field.name in fieldErrors,
          onChange: (e: { target: { value: string } }) =>
            setValues((v) => ({ ...v, [field.name]: e.target.value })),
        };
        return (
          <div key={field.name}>
            <label htmlFor={id}>
              {field.name}
              {field.kind === 'textList' && ` (${t('authoring.items.onePerLine')})`}
              {field.kind === 'json' && ' (JSON)'}
            </label>
            {multiline ? (
              <textarea {...input} rows={field.kind === 'textList' ? 3 : 6} />
            ) : (
              <input {...input} type={field.kind === 'number' ? 'number' : 'text'} />
            )}
            <div id={`${id}-note`}>
              {fieldErrors[field.name] && <p>{fieldErrors[field.name]}</p>}
              {overridden && (
                <p>
                  {t('authoring.items.importedValue', {
                    value: toText(field, item.data[field.name]) || '—',
                  })}{' '}
                  <Button type="button" onClick={() => clear(field.name)}>
                    {t('authoring.items.clear', { field: field.name })}
                  </Button>
                </p>
              )}
            </div>
          </div>
        );
      })}
      <Button type="submit">{t('authoring.save')}</Button>
    </Fields>
  );
}
