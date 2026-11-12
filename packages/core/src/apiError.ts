import { z } from 'zod';

/** The single error shape returned by every API endpoint. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

// Deliberate type error to verify that CI fails (reverted in the next commit).
export const ciCheck: number = 'not a number';
