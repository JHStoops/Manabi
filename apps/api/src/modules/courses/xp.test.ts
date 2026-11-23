import { query } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedLesson, seedUser } from '../../test/fixtures';
import { insertEnrollment, insertXpEvent } from './queries';
import { awardLessonXp, awardXp, rebuildXpTotals } from './service';

// Integration tests for the XP ledger (issue #36): FR-055, FR-160, FR-162, DR-04, DR-05.

describeWithDb('XP ledger', () => {
  const pool = useTestDatabase();

  async function enrolled(timeZone = 'Asia/Tokyo', username = 'learner') {
    const user = await seedUser(pool(), { username, timeZone });
    const courseId =
      (await query<{ id: number }>(pool(), `SELECT id FROM courses`))[0]?.id ??
      (await seedCourse(pool()));
    await insertEnrollment(pool(), user.id, courseId);
    return { userId: user.id, courseId };
  }

  function enrollment(userId: number, courseId: number) {
    return query(
      pool(),
      `SELECT total_xp, level FROM enrollments WHERE user_id = $1 AND course_id = $2`,
      [userId, courseId],
    );
  }

  it('records each award and updates the course total and level', async () => {
    const { userId, courseId } = await enrolled();
    for (let i = 0; i < 4; i++) {
      await awardXp(pool(), { userId, courseId, reason: 'test_out', refId: null });
    }
    expect(await enrollment(userId, courseId)).toEqual([{ total_xp: 120, level: 2 }]);
    expect(
      await query(pool(), `SELECT base_amount, multiplier, amount, reason FROM xp_events`),
    ).toHaveLength(4);
  });

  it('refuses an award for a course the learner is not enrolled in', async () => {
    const { courseId } = await enrolled();
    const other = await seedUser(pool(), { username: 'other' });
    await expect(
      awardXp(pool(), { userId: other.id, courseId, reason: 'drill', refId: null }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(await query(pool(), `SELECT 1 FROM xp_events`)).toEqual([]);
  });

  it('stores local_date in the learner time zone around midnight (DR-05)', async () => {
    const tokyo = await enrolled('Asia/Tokyo', 'tokyo');
    const la = await enrolled('America/Los_Angeles', 'la');
    // 14:59 UTC is 23:59 in Tokyo; 15:00 UTC is midnight there. Los Angeles is still on the 23rd.
    const before = new Date('2026-11-23T14:59:59Z');
    const after = new Date('2026-11-23T15:00:00Z');
    for (const at of [before, after]) {
      for (const who of [tokyo, la]) {
        await awardXp(pool(), { ...who, reason: 'drill', refId: null, at });
      }
    }
    // And 08:00 UTC on the 24th is midnight on the 24th in Los Angeles.
    await awardXp(pool(), {
      ...la,
      reason: 'drill',
      refId: null,
      at: new Date('2026-11-24T08:00:00Z'),
    });
    const rows = await query<{ user_id: number; local_date: string }>(
      pool(),
      `SELECT user_id, local_date FROM xp_events ORDER BY id`,
    );
    expect(rows.map((r) => [r.user_id, r.local_date])).toEqual([
      [tokyo.userId, '2026-11-23'],
      [la.userId, '2026-11-23'],
      [tokyo.userId, '2026-11-24'],
      [la.userId, '2026-11-23'],
      [la.userId, '2026-11-24'],
    ]);
  });

  it('awards 10 + 5 for a new lesson, then 5 for each replay (FR-055)', async () => {
    const { userId, courseId } = await enrolled();
    const { lessonId } = await seedLesson(pool(), courseId);
    expect(await awardLessonXp(pool(), userId, lessonId, 95)).toEqual({
      xpEarned: 15,
      totalXp: 15,
      level: 1,
    });
    expect(await awardLessonXp(pool(), userId, lessonId, 100)).toEqual({
      xpEarned: 5,
      totalXp: 20,
      level: 1,
    });
    expect(await query(pool(), `SELECT reason, amount, ref_id FROM xp_events ORDER BY id`)).toEqual(
      [
        { reason: 'lesson_new', amount: 10, ref_id: lessonId },
        { reason: 'lesson_accuracy_bonus', amount: 5, ref_id: lessonId },
        { reason: 'lesson_replay', amount: 5, ref_id: lessonId },
      ],
    );
  });

  it('rebuilds totals and levels from the ledger (DR-04)', async () => {
    const a = await enrolled('Asia/Tokyo', 'a');
    const b = await enrolled('Asia/Tokyo', 'b');
    const empty = await enrolled('Asia/Tokyo', 'c');
    for (let i = 0; i < 11; i++) await awardXp(pool(), { ...a, reason: 'test_out', refId: null });
    await awardXp(pool(), { ...b, reason: 'drill', refId: null });
    // A ledger row written without going through awardXp, so the cache is stale.
    await insertXpEvent(pool(), {
      ...b,
      baseAmount: 100,
      multiplier: 1,
      amount: 100,
      reason: 'test_out',
      refId: null,
      earnedAt: new Date(),
      localDate: new Date().toISOString().slice(0, 10),
    });
    const expected = await query(
      pool(),
      `SELECT user_id, total_xp, level FROM enrollments ORDER BY user_id`,
    );
    expected[1] = { user_id: b.userId, total_xp: 105, level: 2 };
    // Corrupt every cached total, then rebuild.
    await query(pool(), `UPDATE enrollments SET total_xp = 7, level = 9`);

    expect(await rebuildXpTotals(pool())).toBe(3);
    expect(
      await query(pool(), `SELECT user_id, total_xp, level FROM enrollments ORDER BY user_id`),
    ).toEqual(expected);
    expect(expected).toEqual([
      { user_id: a.userId, total_xp: 330, level: 3 },
      { user_id: b.userId, total_xp: 105, level: 2 },
      { user_id: empty.userId, total_xp: 0, level: 1 },
    ]);
  });
});
