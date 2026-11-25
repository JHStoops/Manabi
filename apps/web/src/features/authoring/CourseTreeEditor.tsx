import styled from '@emotion/styled';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { lessonTypeSchema } from '@manabi/core';
import type { CourseTree, LessonType, PublishStatus } from '@manabi/core';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';
import { Button, Form, Section } from '../admin/ui';

// FR-220, FR-225, Product Spec section 11 (Content editor): the course tree. Sections, units and
// lessons can be added, renamed, published, deleted and reordered by drag or with the move
// buttons (the keyboard alternative). The item and lesson editors (#42, #43) hang off this tree.

type Kind = 'sections' | 'units' | 'lessons';

interface Actions {
  patch: (
    kind: Kind,
    id: number,
    body: { title?: string; status?: PublishStatus; position?: number },
  ) => Promise<boolean>;
  remove: (kind: Kind, id: number, title: string) => void;
  dragging: { current: { kind: Kind; id: number; parent: number } | null };
}

const List = styled.ol`
  list-style: none;
  padding-left: ${({ theme }) => theme.spacing(3)};
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

export function CourseTreeEditor({ courseId }: { courseId: number }) {
  const { t } = useTranslation();
  const api = useApi();
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [message, setMessage] = useState('');
  // The row being dragged; drops only land on rows of the same kind and parent.
  const dragging = useRef<{ kind: Kind; id: number; parent: number } | null>(null);

  useEffect(() => {
    setTree(null);
    api
      .GET('/api/v1/authoring/courses/{id}', { params: { path: { id: String(courseId) } } })
      .then(setTree, (err: unknown) => setMessage(apiErrorMessage(t, err)));
  }, [api, t, courseId]);

  /** Sends one change; the API answers with the whole tree. True when it succeeded. */
  async function send(request: Promise<CourseTree>): Promise<boolean> {
    setMessage('');
    try {
      setTree(await request);
      return true;
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
      return false;
    }
  }

  const path = (id: number) => ({ path: { id: String(id) } });
  const patch = (
    kind: Kind,
    id: number,
    body: { title?: string; status?: PublishStatus; position?: number },
  ) => send(api.PATCH(`/api/v1/authoring/${kind}/{id}`, { params: path(id), body }));
  const remove = (kind: Kind, id: number, title: string) => {
    if (window.confirm(t('authoring.confirmDelete', { title }))) {
      void send(api.DELETE(`/api/v1/authoring/${kind}/{id}`, { params: path(id) }));
    }
  };

  const actions: Actions = { patch, remove, dragging };

  if (!tree) return message ? <p role="alert">{message}</p> : <p>{t('app.loading')}</p>;

  return (
    <Section aria-labelledby="authoring-tree">
      <h2 id="authoring-tree">{tree.course.title}</h2>
      {message && <p role="alert">{message}</p>}
      <p>{t('authoring.dragHint')}</p>
      <List aria-label={t('authoring.sections')}>
        {tree.sections.map((s, i) => (
          <Node
            actions={actions}
            key={s.id}
            kind="sections"
            id={s.id}
            parent={tree.course.id}
            title={s.title}
            detail={s.levelCode}
            index={i}
            count={tree.sections.length}
          >
            <List aria-label={t('authoring.unitsOf', { title: s.title })}>
              {s.units.map((u, j) => (
                <Node
                  actions={actions}
                  key={u.id}
                  kind="units"
                  id={u.id}
                  parent={s.id}
                  title={u.title}
                  detail={t('authoring.unit')}
                  status={u.status}
                  index={j}
                  count={s.units.length}
                >
                  <List aria-label={t('authoring.lessonsOf', { title: u.title })}>
                    {u.lessons.map((l, k) => (
                      <Node
                        actions={actions}
                        key={l.id}
                        kind="lessons"
                        id={l.id}
                        parent={u.id}
                        title={l.title}
                        detail={t(`learn.lessonType.${l.type}`)}
                        status={l.status}
                        index={k}
                        count={u.lessons.length}
                      />
                    ))}
                  </List>
                  <AddForm
                    label={t('authoring.addLessonTo', { title: u.title })}
                    withType
                    onAdd={(slug, title, type) =>
                      send(
                        api.POST('/api/v1/authoring/lessons', {
                          body: { unitId: u.id, slug, title, type: type as LessonType },
                        }),
                      )
                    }
                  />
                </Node>
              ))}
            </List>
            <AddForm
              label={t('authoring.addUnitTo', { title: s.title })}
              onAdd={(slug, title) =>
                send(
                  api.POST('/api/v1/authoring/units', { body: { sectionId: s.id, slug, title } }),
                )
              }
            />
          </Node>
        ))}
      </List>
      <AddForm
        label={t('authoring.addSection')}
        withLevel
        onAdd={(slug, title, levelCode) =>
          send(
            api.POST('/api/v1/authoring/courses/{id}/sections', {
              params: path(tree.course.id),
              body: { slug, title, levelCode },
            }),
          )
        }
      />
    </Section>
  );
}

/** One section, unit or lesson: its title, status and actions, then its children. */
function Node(props: {
  actions: Actions;
  kind: Kind;
  id: number;
  parent: number;
  title: string;
  detail: string;
  status?: PublishStatus;
  index: number;
  count: number;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const { patch, remove, dragging } = props.actions;
  const { kind, id, parent, title, index, count, status } = props;
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const sameList = () => dragging.current?.kind === kind && dragging.current.parent === parent;

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (await patch(kind, id, { title: newTitle })) setRenaming(false);
  }

  return (
    <li
      draggable
      aria-label={title}
      onDragStart={(e) => {
        e.stopPropagation();
        dragging.current = { kind, id, parent };
      }}
      onDragEnd={() => (dragging.current = null)}
      onDragOver={(e) => sameList() && e.preventDefault()}
      onDrop={(e) => {
        e.stopPropagation();
        const moved = sameList() ? dragging.current : null;
        dragging.current = null;
        if (moved && moved.id !== id) void patch(kind, moved.id, { position: index });
      }}
    >
      <Row>
        {renaming ? (
          <Form onSubmit={rename}>
            <label>
              {t('authoring.title')}
              <input required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </label>
            <Button type="submit">{t('authoring.save')}</Button>
            <Button type="button" onClick={() => setRenaming(false)}>
              {t('authoring.cancel')}
            </Button>
          </Form>
        ) : (
          <strong>{title}</strong>
        )}
        <span>{props.detail}</span>
        {status && <span>{t(`authoring.status.${status}`)}</span>}
        {status && (
          <Button
            onClick={() => patch(kind, id, { status: status === 'draft' ? 'published' : 'draft' })}
          >
            {t(status === 'draft' ? 'authoring.publish' : 'authoring.unpublish')}
          </Button>
        )}
        <Button
          aria-label={t('authoring.moveUp', { title })}
          disabled={index === 0}
          onClick={() => patch(kind, id, { position: index - 1 })}
        >
          {t('authoring.up')}
        </Button>
        <Button
          aria-label={t('authoring.moveDown', { title })}
          disabled={index === count - 1}
          onClick={() => patch(kind, id, { position: index + 1 })}
        >
          {t('authoring.down')}
        </Button>
        <Button aria-label={t('authoring.rename', { title })} onClick={() => setRenaming(true)}>
          {t('authoring.renameShort')}
        </Button>
        <Button
          aria-label={t('authoring.delete', { title })}
          onClick={() => remove(kind, id, title)}
        >
          {t('authoring.deleteShort')}
        </Button>
      </Row>
      {props.children}
    </li>
  );
}

/** Adds a row: its key slug and title, plus the lesson type or section level. */
function AddForm(props: {
  label: string;
  withType?: boolean;
  withLevel?: boolean;
  onAdd: (slug: string, title: string, extra: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [extra, setExtra] = useState(props.withType ? 'vocabulary' : '');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await props.onAdd(slug, title, extra)) {
      setSlug('');
      setTitle('');
    }
  }

  return (
    <Form aria-label={props.label} onSubmit={submit}>
      <label>
        {t('authoring.slug')}
        <input
          required
          pattern="[a-z0-9][a-z0-9\-]*"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </label>
      <label>
        {t('authoring.title')}
        <input required value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      {props.withType && (
        <label>
          {t('authoring.type')}
          <select value={extra} onChange={(e) => setExtra(e.target.value)}>
            {lessonTypeSchema.options.map((type) => (
              <option key={type} value={type}>
                {t(`learn.lessonType.${type}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      {props.withLevel && (
        <label>
          {t('authoring.level')}
          <input required value={extra} onChange={(e) => setExtra(e.target.value)} />
        </label>
      )}
      <Button type="submit">{props.label}</Button>
    </Form>
  );
}
