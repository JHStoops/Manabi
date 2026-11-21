# @manabi/core

Shared domain types, Zod schemas, pure rules and the `LanguagePlugin` interface. Pure TypeScript:
no Node or browser APIs, so everything here runs on both the API and the web app.

## Adding an exercise type

An exercise type is one registry entry, one grader and one renderer (SDD section 6, NFR-53).

1. **Core: definition and grader.** Add `src/exercises/<id>.ts` that calls `registerExerciseType`
   with the type id (lower snake case), a `payloadSchema` for the stored payload, an
   `answerSchema` for one answer as the renderer reports it, and a pure grader,
   `grade(payload, answer, plugin)`, returning `correct`, `near-miss` with a `hint`, or `wrong`,
   plus optional `feedback` (the correct answer and a one-line reason). Language-specific checking (normalizing, near-miss)
   goes through the plugin (`plugin.checkAnswer`, `plugin.normalizeAnswer`), never into core.
   Re-export the file from `src/index.ts`, so importing `@manabi/core` registers it in the web app
   and the API alike.
2. **Web: renderer.** Write a component taking `ExerciseRendererProps<Payload, Answer>`
   (`payload` in, `onAnswer(answer)` out, see `apps/web/src/features/exercises/registry.ts`) and
   register it with `registerExerciseRenderer('<id>', () => import('./MyRenderer'))`. Test it with
   `ExerciseRendererHarness`.
3. **Generator (optional).** If the type is generated from item data, add a generator under the
   same id to the language plugin's `generators`.

Grading always goes through `gradeResponse(exercise, response, plugin)`: the web app calls it after
each attempt for instant feedback and the API calls it again to re-grade (FR-053). A response holds
one attempt, or two when the first was wrong (FR-046); the second attempt decides.

`src/testExerciseType.ts` (test code, not exported) is a complete minimal example; its renderer is
`apps/web/src/features/exercises/TestEchoRenderer.tsx`.
