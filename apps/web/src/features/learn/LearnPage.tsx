import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import type { Theme } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CoursePath, LessonState, LessonType } from '@manabi/core';
import { useApi } from '../../state/session';
import { readableOn, tapTarget } from '../../theme';
import { apiErrorMessage } from '../auth/ui';
import { CoursePathProvider, useCoursePath, useCoursePathDispatch } from './coursePath';

type PathLesson = CoursePath['sections'][number]['units'][number]['lessons'][number];

// NFR-31: state is carried by an icon and the accessible label, never by color alone.
export const stateIcons: Record<LessonState, string> = {
  locked: '🔒',
  available: '★',
  completed: '✓',
};

// Product Spec sections 3 and 10: each lesson type keeps its color; kana takes the section's.
function lessonColor(theme: Theme, type: LessonType, sectionColor: string): string {
  if (type === 'kana') return sectionColor;
  if (type === 'unit_review') return theme.lessonColors.review;
  return theme.lessonColors[type];
}

// Winding path: horizontal offsets in node widths, repeating.
const winding = [0, 0.6, 1, 0.6, 0, -0.6, -1, -0.6];

const Header = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  h1 {
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.title};
  }
  select {
    ${({ theme }) => tapTarget(theme)};
    padding: 0 ${({ theme }) => theme.spacing(2)};
    border-radius: ${({ theme }) => theme.radii.small};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.body};
  }
`;

const Path = styled.div`
  max-width: 560px;
  margin: 0 auto;
`;

const Band = styled.section<{ bandColor: string }>`
  margin-bottom: ${({ theme }) => theme.spacing(6)};
  > h2 {
    margin: 0 0 ${({ theme }) => theme.spacing(4)};
    padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
    border-radius: ${({ theme }) => theme.radii.medium};
    background: ${({ bandColor }) => bandColor};
    color: #ffffff;
    font-size: ${({ theme }) => theme.fontSizes.body};
  }
  h3 {
    text-align: center;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.small};
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.spacing(3)};
  }
`;

const Node = styled.button<{ nodeColor: string; windOffset: number; lessonState: LessonState }>`
  ${({ theme }) => tapTarget(theme)};
  width: 64px;
  height: 64px;
  border-radius: 50%;
  transform: translateX(${({ windOffset }) => windOffset * 64}px);
  border: 4px solid ${({ nodeColor }) => nodeColor};
  background: ${({ nodeColor, lessonState, theme }) =>
    lessonState === 'locked' ? theme.colors.surface : nodeColor};
  // WCAG 1.4.11: the state icon is the NFR-31 cue, so it needs 3:1 on the lesson color.
  color: ${({ nodeColor, lessonState, theme }) =>
    lessonState === 'locked'
      ? theme.colors.textMuted
      : readableOn(
          nodeColor,
          '#ffffff',
          theme.mode === 'light' ? theme.colors.text : theme.colors.background,
        )};
  opacity: ${({ lessonState }) => (lessonState === 'locked' ? 0.6 : 1)};
  font-size: ${({ theme }) => theme.fontSizes.title};
  cursor: ${({ lessonState }) => (lessonState === 'locked' ? 'not-allowed' : 'pointer')};
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
  &:active:not(:disabled) {
    transform: translate(${({ windOffset }) => windOffset * 64}px, 3px);
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
  }
`;

function LessonNode(props: { lesson: PathLesson; color: string; offset: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lesson } = props;
  return (
    <li>
      <Node
        type="button"
        nodeColor={props.color}
        windOffset={props.offset}
        lessonState={lesson.state}
        disabled={lesson.state === 'locked'}
        data-state={lesson.state}
        aria-label={t('learn.lessonLabel', {
          title: lesson.title,
          type: t(`learn.lessonType.${lesson.type}`),
          state: t(`learn.state.${lesson.state}`),
        })}
        // Product Spec section 3: an open lesson starts at its intro in the lesson player.
        onClick={() => navigate(`/lesson/${lesson.id}`)}
      >
        <span aria-hidden="true">{stateIcons[lesson.state]}</span>
      </Node>
    </li>
  );
}

function CourseHeader() {
  const { t } = useTranslation();
  const api = useApi();
  const dispatch = useCoursePathDispatch();
  const { courses, activeId, path } = useCoursePath();
  const enrolled = courses?.filter((c) => c.enrolled) ?? [];

  // FR-023: enrolling again in an enrolled course only makes it the active one.
  async function switchTo(courseId: number) {
    try {
      await api.POST('/api/v1/courses/{id}/enroll', {
        params: { path: { id: String(courseId) } },
        body: {},
      });
      dispatch({ type: 'activated', courseId });
    } catch (error) {
      dispatch({ type: 'failed', error });
    }
  }

  return (
    <Header>
      <h1>{path?.course.title ?? t('area.learn')}</h1>
      {enrolled.length > 1 && (
        <select
          aria-label={t('learn.course')}
          value={activeId ?? ''}
          onChange={(e) => void switchTo(Number(e.target.value))}
        >
          {enrolled.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      )}
    </Header>
  );
}

function PathScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { courses, activeId, path, error } = useCoursePath();

  let body;
  if (error) body = <p role="alert">{apiErrorMessage(t, error)}</p>;
  else if (courses && activeId === null) body = <p>{t('learn.noCourse')}</p>;
  else if (!path) body = <p>{t('app.loading')}</p>;
  else {
    let n = 0; // node count along the whole path, so the winding continues across units
    body = (
      <Path>
        {path.sections.map((section, s) => {
          const color = theme.sectionColors[s % theme.sectionColors.length]!;
          return (
            <Band key={section.id} bandColor={color} aria-labelledby={`section-${section.id}`}>
              <h2 id={`section-${section.id}`}>{section.title}</h2>
              {section.units.map((unit) => (
                <section key={unit.id} aria-labelledby={`unit-${unit.id}`}>
                  <h3 id={`unit-${unit.id}`}>{unit.title}</h3>
                  <ol>
                    {unit.lessons.map((lesson) => (
                      <LessonNode
                        key={lesson.id}
                        lesson={lesson}
                        color={lessonColor(theme, lesson.type, color)}
                        offset={winding[n++ % winding.length]!}
                      />
                    ))}
                  </ol>
                </section>
              ))}
            </Band>
          );
        })}
      </Path>
    );
  }

  return (
    <>
      <CourseHeader />
      {body}
    </>
  );
}

/** FR-020, FR-023, IF-01: the Learn tab, the active course's path with a course switcher. */
export default function LearnPage() {
  return (
    <CoursePathProvider>
      <PathScreen />
    </CoursePathProvider>
  );
}
