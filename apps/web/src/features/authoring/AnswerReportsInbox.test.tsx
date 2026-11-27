import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiRequestError } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import type { AnswerReport } from '@manabi/core';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { AnswerReportsInbox } from './AnswerReportsInbox';

// Component tests for the answer reports inbox (#63): FR-229, Product Spec section 11.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

function report(id: number, overrides: Partial<AnswerReport> = {}): AnswerReport {
  return {
    id,
    status: 'open',
    exerciseType: 'typed_answer',
    exercisePayload: {
      prompt: `Meaning of word ${id}`,
      answerLanguage: 'base',
      accept: [{ text: 'water', tiles: [] }],
    },
    givenAnswer: `answer ${id}`,
    exerciseId: null,
    currentAccept: null,
    itemId: null,
    lessonId: 3,
    courseId: 1,
    courseTitle: 'Japanese',
    plugin: 'ja',
    reporter: 'kenji',
    createdAt: '2026-11-20T00:00:00.000Z',
    resolvedAt: null,
    ...overrides,
  };
}

function show(pages: { items: AnswerReport[]; nextCursor: string | null }[], post?: jest.Mock) {
  const api = {
    GET: jest.fn(() => Promise.resolve(pages.shift())),
    POST: post ?? jest.fn(() => Promise.resolve({})),
  };
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>
        <AnswerReportsInbox />
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
  return api;
}

describe('AnswerReportsInbox', () => {
  it('lists open reports with the answer and the current accept list', async () => {
    const api = show([
      {
        items: [
          report(1),
          report(2, { exerciseId: 9, currentAccept: ['みず', 'お水'], reporter: null }),
        ],
        nextCursor: null,
      },
    ]);
    const items = await screen.findAllByRole('listitem');
    expect(api.GET).toHaveBeenCalledWith('/api/v1/authoring/reports', {
      params: { query: { status: 'open' } },
    });
    expect(items[0]!.textContent).toContain('Japanese · typed_answer · reported by kenji');
    expect(items[0]!.textContent).toContain('Meaning of word 1');
    expect(items[0]!.textContent).toContain('Reported answer: answer 1');
    expect(items[0]!.textContent).toContain('Accepted now: water');
    expect(items[0]!.textContent).toContain('accepting pins it');
    // A stored exercise shows its own accept list; a deleted reporter is named as such.
    expect(items[1]!.textContent).toContain('Accepted now: みず, お水');
    expect(items[1]!.textContent).toContain('reported by a deleted account');
    expect(items[1]!.textContent).not.toContain('accepting pins it');
  });

  it('accepts and dismisses a report, removing it from the inbox', async () => {
    const api = show([{ items: [report(1), report(2)], nextCursor: null }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept answer 1' }));
    expect(
      await screen.findByText('answer 1 was added to the accept list.', { exact: false }),
    ).toBeTruthy();
    expect(api.POST).toHaveBeenCalledWith('/api/v1/authoring/reports/{id}/accept', {
      params: { path: { id: '1' } },
      body: {},
    });
    expect(screen.queryByRole('button', { name: 'Accept answer 1' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss answer 2' }));
    expect(await screen.findByText('The report of answer 2 was dismissed.')).toBeTruthy();
    expect(api.POST).toHaveBeenLastCalledWith('/api/v1/authoring/reports/{id}/dismiss', {
      params: { path: { id: '2' } },
      body: {},
    });
    expect(screen.getByText('No open answer reports.')).toBeTruthy();
  });

  it('keeps a report whose resolution failed, and says why', async () => {
    const post = jest.fn(() =>
      Promise.reject(new ApiRequestError(409, 'conflict', 'This report is already resolved')),
    );
    show([{ items: [report(1)], nextCursor: null }], post);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept answer 1' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept answer 1' })).toBeTruthy();
  });

  it('loads more reports after the first page', async () => {
    const api = show([
      { items: [report(1)], nextCursor: 'Mg' },
      { items: [report(2)], nextCursor: null },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Show more reports' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(api.GET).toHaveBeenLastCalledWith('/api/v1/authoring/reports', {
      params: { query: { status: 'open', cursor: 'Mg' } },
    });
    expect(within(screen.getAllByRole('listitem')[1]!).getByText('answer 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more reports' })).toBeNull();
  });
});
