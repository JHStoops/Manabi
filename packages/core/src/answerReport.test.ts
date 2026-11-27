import {
  acceptsAnswerReports,
  answerReportsQuerySchema,
  createAnswerReportRequestSchema,
} from './answerReport';

// FR-054, FR-229: answer report schemas.

describe('acceptsAnswerReports', () => {
  it('is true only for exercises with an accept list', () => {
    expect(acceptsAnswerReports({ type: 'typed_answer', payload: { accept: [] } })).toBe(true);
    expect(acceptsAnswerReports({ type: 'choice', payload: { options: [] } })).toBe(false);
    expect(acceptsAnswerReports({ type: 'x', payload: { accept: 'water' } })).toBe(false);
    expect(acceptsAnswerReports({ type: 'x', payload: null })).toBe(false);
  });
});

describe('createAnswerReportRequestSchema', () => {
  const body = {
    session: { kind: 'lesson', id: 7 },
    exercise: { type: 'typed_answer', payload: { accept: [] } },
    answer: '  H2O ',
  };

  it('trims the answer and rejects blank, overlong and unknown fields', () => {
    expect(createAnswerReportRequestSchema.parse(body).answer).toBe('H2O');
    for (const bad of [
      { ...body, answer: '  ' },
      { ...body, answer: 'x'.repeat(201) },
      { ...body, session: { kind: 'unit', id: 7 } },
      { ...body, extra: true },
    ]) {
      expect(createAnswerReportRequestSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('answerReportsQuerySchema', () => {
  it('lists open reports by default', () => {
    expect(answerReportsQuerySchema.parse({})).toMatchObject({ status: 'open', limit: 20 });
    expect(answerReportsQuerySchema.safeParse({ status: 'closed' }).success).toBe(false);
  });
});
