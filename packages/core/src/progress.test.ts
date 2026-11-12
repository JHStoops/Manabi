import { enrollmentSchema, itemProgressSchema, lessonProgressSchema, stageSchema } from './index';
import { describeSchema } from './testCases';

describeSchema(
  'stageSchema',
  stageSchema,
  [
    ['stage 1', 1],
    ['retired', 8],
  ],
  [
    ['stage 0', 0],
    ['stage 9', 9],
  ],
);

const enrollment = { courseId: 1, startedAt: '2026-11-11T00:00:00Z', totalXp: 0, level: 1 };

describeSchema(
  'enrollmentSchema',
  enrollmentSchema,
  [['a new enrollment', enrollment]],
  [
    ['negative XP', { ...enrollment, totalXp: -1 }],
    ['level 0', { ...enrollment, level: 0 }],
  ],
);

const lessonProgress = {
  lessonId: 4,
  completedAt: '2026-11-11T00:00:00Z',
  bestAccuracy: 100,
  timesCompleted: 1,
};

describeSchema(
  'lessonProgressSchema',
  lessonProgressSchema,
  [['a completed lesson', lessonProgress]],
  [
    ['accuracy over 100', { ...lessonProgress, bestAccuracy: 101 }],
    ['zero completions', { ...lessonProgress, timesCompleted: 0 }],
  ],
);

const itemProgress = {
  itemId: 5,
  facet: 'meaning',
  stage: 3,
  dueAt: '2026-11-12T00:00:00Z',
  lastReviewedAt: null,
  correctCount: 2,
  wrongCount: 0,
};

describeSchema(
  'itemProgressSchema',
  itemProgressSchema,
  [
    ['a due item', itemProgress],
    ['a retired item', { ...itemProgress, stage: 8, dueAt: null }],
  ],
  [
    ['a retired item with a due time', { ...itemProgress, stage: 8 }],
    ['an unretired item with no due time', { ...itemProgress, dueAt: null }],
    ['a bad facet', { ...itemProgress, facet: 'Meaning' }],
  ],
);
