import type { ExerciseTypeDefinition, LanguagePlugin } from './index';
import {
  acceptListSchema,
  createExerciseRegistry,
  exerciseRegistry,
  gradeExercise,
  UnknownExerciseTypeError,
  z,
} from './index';

// A minimal exercise type, used only to exercise the registry here.
const echo: ExerciseTypeDefinition<
  { accept: z.infer<typeof acceptListSchema> },
  { answer: string }
> = {
  id: 'echo',
  payloadSchema: z.object({ accept: acceptListSchema }),
  responseSchema: z.object({ answer: z.string() }),
  grade: (payload, response, { plugin }) =>
    payload.accept.some((a) => plugin.normalizeAnswer(a.text, {}) === response.answer)
      ? { result: 'correct' }
      : { result: 'wrong', feedback: payload.accept[0]?.text ?? '' },
};

const plugin = {
  normalizeAnswer: (text: string) => text.toLowerCase(),
} as unknown as LanguagePlugin;
const payload = { accept: [{ text: 'Water', tiles: [] }] };

describe('exercise registry', () => {
  it('ships with no exercise types registered', () => {
    expect(exerciseRegistry.ids).toEqual([]);
    expect(exerciseRegistry.has('echo')).toBe(false);
  });

  it('looks definitions up by type id', () => {
    const registry = createExerciseRegistry([echo]);
    expect(registry.ids).toEqual(['echo']);
    expect(registry.has('echo')).toBe(true);
    expect(registry.get('echo')).toBe(echo);
  });

  it('throws for an unknown type id', () => {
    expect(() => exerciseRegistry.get('echo')).toThrow(UnknownExerciseTypeError);
    expect(() => exerciseRegistry.get('echo')).toThrow('Unknown exercise type "echo"');
  });

  it.each([
    ['a malformed id', [{ ...echo, id: 'Echo-1' }], 'Invalid exercise type id "Echo-1"'],
    ['a duplicate id', [echo, echo], 'Exercise type "echo" is registered twice'],
  ])('rejects %s', (_label, definitions, message) => {
    expect(() => createExerciseRegistry(definitions)).toThrow(message);
  });
});

describe('gradeExercise', () => {
  const registry = createExerciseRegistry([echo]);

  it('grades a valid response with the plugin', () => {
    expect(gradeExercise(registry, 'echo', payload, { answer: 'water' }, { plugin })).toEqual({
      result: 'correct',
    });
    expect(gradeExercise(registry, 'echo', payload, { answer: 'fire' }, { plugin })).toEqual({
      result: 'wrong',
      feedback: 'Water',
    });
  });

  it('validates the payload and the response first', () => {
    expect(() =>
      gradeExercise(registry, 'echo', { accept: [] }, { answer: 'x' }, { plugin }),
    ).toThrow(z.ZodError);
    expect(() => gradeExercise(registry, 'echo', payload, { answer: 1 }, { plugin })).toThrow(
      z.ZodError,
    );
  });

  it('throws for an unregistered type', () => {
    expect(() => gradeExercise(registry, 'nope', payload, {}, { plugin })).toThrow(
      UnknownExerciseTypeError,
    );
  });
});
