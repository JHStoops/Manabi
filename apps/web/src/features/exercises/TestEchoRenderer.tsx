import type { ExerciseRendererProps } from './registry';

// Test code only: the renderer for the dummy `test_echo` exercise type from
// @manabi/core/src/testExerciseType. Never registered by the app.
export default function TestEchoRenderer({
  payload,
  onAnswer,
}: ExerciseRendererProps<{ prompt: string }, string>) {
  return (
    <label>
      {payload.prompt}
      <input onChange={(event) => onAnswer(event.target.value)} />
    </label>
  );
}
