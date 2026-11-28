import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiRequestError } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { RecordingUpload, uploadType } from './RecordingUpload';

// Component tests for recording uploads (#66): FR-132, SDD section 11 (Uploads).

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

function setup(status = { uploaded: false, stale: false }) {
  const api = {
    GET: jest.fn(() => Promise.resolve(status)),
    PUT: jest.fn(() => Promise.resolve({ uploaded: true, stale: false })),
    DELETE: jest.fn(() => Promise.resolve({ uploaded: false, stale: false })),
  };
  render(
    <AppThemeProvider>
      <ApiContext.Provider value={api as unknown as ApiClient}>
        <RecordingUpload ownerType="item" ownerId={3} />
      </ApiContext.Provider>
    </AppThemeProvider>,
  );
  return api;
}

const choose = (file: File) =>
  fireEvent.change(screen.getByLabelText(/Recording file/), { target: { files: [file] } });

describe('RecordingUpload', () => {
  it('says which clip plays and offers the current clip to listen to', async () => {
    const api = setup();
    expect(await screen.findByText('Plays the generated voice.')).toBeTruthy();
    expect(api.GET).toHaveBeenCalledWith('/api/v1/authoring/audio/{ownerType}/{ownerId}', {
      params: { path: { ownerType: 'item', ownerId: '3' } },
    });
    expect(screen.getByLabelText('Current clip').getAttribute('src')).toBe(
      '/api/v1/media/audio/item/3',
    );
    expect(screen.queryByRole('button', { name: 'Remove recording' })).toBeNull();
  });

  it('warns when the upload was made for an older reading', async () => {
    setup({ uploaded: true, stale: true });
    expect(await screen.findByText(/made for an older reading/)).toBeTruthy();
  });

  it('uploads the raw file with its audio type', async () => {
    const api = setup();
    await screen.findByText('Plays the generated voice.');
    const file = new File(['RIFF'], 'mizu.wav', { type: 'audio/wav' });
    choose(file);
    fireEvent.click(screen.getByRole('button', { name: 'Upload recording' }));
    expect(await screen.findByText('Recording saved.')).toBeTruthy();
    const [path, init] = api.PUT.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(path).toBe('/api/v1/authoring/audio/{ownerType}/{ownerId}');
    expect(init.params).toEqual({ path: { ownerType: 'item', ownerId: '3' } });
    expect(init.body).toBe(file);
    expect(init.headers).toEqual({ 'content-type': 'audio/wav' });
    // Sent as is, never as JSON.
    expect((init.bodySerializer as (b: unknown) => unknown)(file)).toBe(file);
    expect(screen.getByText('Plays your uploaded recording.')).toBeTruthy();
  });

  it('refuses a file that is not audio without sending it', async () => {
    const api = setup();
    await screen.findByText('Plays the generated voice.');
    choose(new File(['x'], 'notes.txt', { type: 'text/plain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload recording' }));
    expect(
      await screen.findByText('Choose an Ogg, Opus, MP3, WAV, WebM, M4A or FLAC file.'),
    ).toBeTruthy();
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it("shows the server's reason when it refuses a file", async () => {
    const api = setup();
    api.PUT.mockRejectedValue(
      new ApiRequestError(400, 'bad_request', 'Recordings can be at most 30 seconds long'),
    );
    await screen.findByText('Plays the generated voice.');
    choose(new File(['x'], 'long.mp3', { type: 'audio/mpeg' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload recording' }));
    expect(await screen.findByText('Recordings can be at most 30 seconds long')).toBeTruthy();
  });

  it('removes an uploaded recording', async () => {
    const api = setup({ uploaded: true, stale: false });
    fireEvent.click(await screen.findByRole('button', { name: 'Remove recording' }));
    await waitFor(() => expect(api.DELETE).toHaveBeenCalled());
    expect(await screen.findByText(/generated voice plays again/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove recording' })).toBeNull();
    // Focus stays in the panel although the button it was on is gone.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Recording file')),
    );
    // Focus stays in the panel although the button it was on is gone.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Recording file')),
    );
  });
});

describe('uploadType', () => {
  it("uses the file's own audio type, else its extension", () => {
    expect(uploadType({ name: 'a.webm', type: 'audio/webm;codecs=opus' })).toBe('audio/webm');
    expect(uploadType({ name: 'a.m4a', type: '' })).toBe('audio/mp4');
    expect(uploadType({ name: 'a.opus', type: 'application/octet-stream' })).toBe('audio/opus');
    expect(uploadType({ name: 'a.txt', type: 'text/plain' })).toBeNull();
  });
});
