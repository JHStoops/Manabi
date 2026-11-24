import { CHOICE_TYPE, MATCH_PAIRS_TYPE, TYPED_ANSWER_TYPE, WORD_BANK_TYPE } from '@manabi/core';
import { registerExerciseRenderer } from './registry';

// Every exercise renderer the app registers, one line per type id. Imported once by main.tsx.
registerExerciseRenderer(CHOICE_TYPE, () => import('./ChoiceRenderer'));
registerExerciseRenderer(MATCH_PAIRS_TYPE, () => import('./MatchPairsRenderer'));
registerExerciseRenderer(TYPED_ANSWER_TYPE, () => import('./TypedAnswerRenderer'));
registerExerciseRenderer(WORD_BANK_TYPE, () => import('./WordBankRenderer'));
