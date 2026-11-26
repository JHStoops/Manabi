import {
  CHOICE_TYPE,
  CONJUGATE_TYPE,
  FILL_BLANK_TYPE,
  MATCH_PAIRS_TYPE,
  READING_IN_CONTEXT_TYPE,
  REORDER_TYPE,
  STROKE_TRACE_TYPE,
  TYPED_ANSWER_TYPE,
  WORD_BANK_TYPE,
} from '@manabi/core';
import { registerExerciseRenderer } from './registry';

// Every exercise renderer the app registers, one line per type id. Imported once by main.tsx.
registerExerciseRenderer(CHOICE_TYPE, () => import('./ChoiceRenderer'));
registerExerciseRenderer(MATCH_PAIRS_TYPE, () => import('./MatchPairsRenderer'));
registerExerciseRenderer(TYPED_ANSWER_TYPE, () => import('./TypedAnswerRenderer'));
registerExerciseRenderer(WORD_BANK_TYPE, () => import('./WordBankRenderer'));
registerExerciseRenderer(FILL_BLANK_TYPE, () => import('./FillBlankRenderer'));
registerExerciseRenderer(REORDER_TYPE, () => import('./ReorderRenderer'));
registerExerciseRenderer(READING_IN_CONTEXT_TYPE, () => import('./ReadingInContextRenderer'));
registerExerciseRenderer(CONJUGATE_TYPE, () => import('./ConjugateRenderer'));
registerExerciseRenderer(STROKE_TRACE_TYPE, () => import('./StrokeTraceRenderer'));
