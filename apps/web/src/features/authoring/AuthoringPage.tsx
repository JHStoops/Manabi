import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CourseListEntry } from '@manabi/core';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';
import { CourseTreeEditor } from './CourseTreeEditor';

// Product Spec section 11 (Content editor). The course tree comes with #41; the item and lesson
// editors with #42 and #43.
export default function AuthoringPage() {
  const { t } = useTranslation();
  const api = useApi();
  const [courses, setCourses] = useState<CourseListEntry[]>([]);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Admins get draft courses in this list too.
    api.GET('/api/v1/courses').then(
      (body) => {
        setCourses(body.courses);
        setCourseId((id) => id ?? body.courses[0]?.id ?? null);
      },
      (err: unknown) => setMessage(apiErrorMessage(t, err)),
    );
  }, [api, t]);

  return (
    <>
      <h1>{t('area.authoring')}</h1>
      {message && <p role="alert">{message}</p>}
      {courses.length > 1 && (
        <label>
          {t('authoring.course')}{' '}
          <select value={courseId ?? ''} onChange={(e) => setCourseId(Number(e.target.value))}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {courseId !== null && <CourseTreeEditor courseId={courseId} />}
    </>
  );
}
