-- Up Migration
-- FR-229, FR-227 (#251): an accept-list answer added by accepting an answer report is marked
-- `"source": "report"` in the exercise payload, so a content pack re-import keeps only those
-- answers when the pack lacks them, and drops any other stored answer the pack no longer lists.
-- Backfill: answers accepted before the marker existed are found through their accepted report
-- (same exercise, same answer text) and marked. Payloads only; no table changes, and no progress
-- table is touched. Idempotent: a marked answer is unchanged by `|| '{"source":"report"}'`.
-- NFR-52: forward-only. This file has no Down Migration section on purpose.
UPDATE exercises e
   SET payload = jsonb_set(
         e.payload,
         '{accept}',
         (SELECT jsonb_agg(
                   CASE
                     WHEN jsonb_typeof(a.answer) = 'object'
                      AND EXISTS (SELECT 1
                                    FROM answer_reports r
                                   WHERE r.exercise_id = e.id
                                     AND r.status = 'accepted'
                                     AND r.given_answer = a.answer ->> 'text')
                     THEN a.answer || '{"source": "report"}'::jsonb
                     ELSE a.answer
                   END
                   ORDER BY a.position)
            FROM jsonb_array_elements(e.payload -> 'accept') WITH ORDINALITY AS a (answer, position)))
 WHERE jsonb_typeof(e.payload -> 'accept') = 'array'
   AND jsonb_array_length(e.payload -> 'accept') > 0
   AND EXISTS (SELECT 1 FROM answer_reports r WHERE r.exercise_id = e.id AND r.status = 'accepted');
