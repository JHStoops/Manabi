import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthoringItemSummary, Item, LanguagePlugin } from '@manabi/core';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';
import { Button, Form } from '../admin/ui';

// Product Spec section 11: choose the lesson's new items. Search the course's items by key, add
// them, and order or remove the chosen ones; `onChange` gets the new ids in teaching order.

export function ItemPicker(props: {
  courseId: number;
  items: Item[];
  plugin: LanguagePlugin | undefined;
  sectionLevel: string;
  onChange: (itemIds: number[]) => void;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<AuthoringItemSummary[] | null>(null);
  const [message, setMessage] = useState('');
  const ids = props.items.map((i) => i.id);
  // The plugin's term for an item, with its key; just the key for a plugin the app lacks.
  const name = (item: Item) => {
    const term = props.plugin?.teachingCard(item, props.sectionLevel).term;
    return term ? `${term} (${item.key})` : item.key;
  };

  async function search(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      const result = await api.GET('/api/v1/authoring/items', {
        params: { query: { course: String(props.courseId), q } },
      });
      setFound(result.items);
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
    }
  }

  const move = (from: number, to: number) => {
    const next = [...ids];
    next.splice(to, 0, ...next.splice(from, 1));
    props.onChange(next);
  };

  return (
    <section aria-labelledby="lesson-items">
      <h2 id="lesson-items">{t('lessonEditor.items')}</h2>
      {props.items.length === 0 ? (
        <p>{t('lessonEditor.noItems')}</p>
      ) : (
        <ol>
          {props.items.map((item, i) => (
            <li key={item.id}>
              {name(item)}{' '}
              <Button
                aria-label={t('authoring.moveUp', { title: item.key })}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                {t('authoring.up')}
              </Button>
              <Button
                aria-label={t('authoring.moveDown', { title: item.key })}
                disabled={i === ids.length - 1}
                onClick={() => move(i, i + 1)}
              >
                {t('authoring.down')}
              </Button>
              <Button
                aria-label={t('lessonEditor.removeEntry', { label: item.key })}
                onClick={() => props.onChange(ids.filter((id) => id !== item.id))}
              >
                {t('lessonEditor.remove')}
              </Button>
            </li>
          ))}
        </ol>
      )}
      <Form role="search" onSubmit={search}>
        <label>
          {t('lessonEditor.searchItems')}
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Button type="submit">{t('lessonEditor.search')}</Button>
      </Form>
      {message && <p role="alert">{message}</p>}
      {found && (
        <ul aria-label={t('lessonEditor.searchResults')}>
          {found.length === 0 && <li>{t('lessonEditor.noResults')}</li>}
          {found.map((item) => (
            <li key={item.id}>
              {item.key}{' '}
              <Button
                aria-label={t('lessonEditor.addItem', { key: item.key })}
                disabled={ids.includes(item.id)}
                onClick={() => props.onChange([...ids, item.id])}
              >
                {t('lessonEditor.add')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
