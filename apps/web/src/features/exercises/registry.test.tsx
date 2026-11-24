import { fireEvent, render, screen } from '@testing-library/react';
import { gradeResponse } from '@manabi/core';
import { TEST_EXERCISE_TYPE, testExercise, testPlugin } from '@manabi/core/src/testExerciseType';
import '../../i18n';
import { ExerciseRendererHarness } from './ExerciseRendererHarness';
import { getExerciseRenderer, registerExerciseRenderer } from './registry';

// NFR-53: the dummy type travels the whole path: core registry, lazy renderer, shared grader.

const load = jest.fn(() => import('./TestEchoRenderer'));
registerExerciseRenderer(TEST_EXERCISE_TYPE, load);

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

describe('exercise renderer registry', () => {
  it('loads the renderer lazily and reports an answer the shared grader accepts', async () => {
    expect(load).not.toHaveBeenCalled();
    const onAnswer = jest.fn();
    render(
      <ExerciseRendererHarness exercise={testExercise} plugin={testPlugin} onAnswer={onAnswer} />,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();

    fireEvent.change(await screen.findByLabelText('Type "Water"'), {
      target: { value: 'Water' },
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenLastCalledWith('Water');
    const answer: unknown = onAnswer.mock.lastCall?.[0];
    expect(gradeResponse(testExercise, { attempts: [answer] }, testPlugin)).toEqual({
      result: 'correct',
    });
  });

  it('rejects a duplicate type id and an unknown one', () => {
    expect(() => registerExerciseRenderer(TEST_EXERCISE_TYPE, load)).toThrow('registered twice');
    expect(() => getExerciseRenderer('nope')).toThrow('No renderer is registered');
  });
});
