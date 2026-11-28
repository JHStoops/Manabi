import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { AUDIO_UPLOAD_MAX_BYTES, AUDIO_UPLOAD_MAX_SECONDS } from '@manabi/core';
import type { AudioOwnerType } from '../content/rows';

// NFR-07, docs/spikes/tts.md (Setup): trim leading and trailing silence (keeping 50 ms), downmix
// to mono and encode Ogg Opus at 24 kbps. Constrained VBR keeps a clip under the 32 kbps ceiling;
// plain VBR measured 34 kbps on a short tonal clip.
const TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05';
const ENCODE_ARGS = [
  '-af',
  `${TRIM},areverse,${TRIM},areverse`,
  ...'-ac 1 -c:a libopus -b:a 24k -vbr constrained -application voip -f ogg pipe:1'.split(' '),
];

function run(command: string, args: string[], input?: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      command,
      args,
      { encoding: 'buffer', timeout: 10_000, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
    // The child exiting early closes stdin (EPIPE); the callback above reports why.
    child.stdin?.on('error', () => {});
    child.stdin?.end(input);
  });
}

/** NFR-07: a TTS engine's WAV as a trimmed mono Opus clip. */
export function encodeOpus(wav: Uint8Array): Promise<Buffer> {
  return run(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-f', 'wav', '-i', 'pipe:0', ...ENCODE_ARGS],
    wav,
  );
}

/** Why an upload was refused; the message is safe to show the author. */
export class AudioFileError extends Error {
  override name = 'AudioFileError';
}

/**
 * SDD section 11 (Uploads): the container a file's leading bytes announce, as the ffmpeg demuxer
 * to read it with, or null for anything else. Forcing the demuxer keeps ffmpeg from guessing,
 * so a playlist or concat script posing as audio is never followed to other files or URLs.
 */
export function sniffContainer(bytes: Uint8Array): string | null {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, end: number) => b.subarray(start, end).toString('latin1');
  if (ascii(0, 4) === 'OggS') return 'ogg';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'wav';
  if (ascii(0, 4) === 'fLaC') return 'flac';
  if (b.length >= 4 && b.readUInt32BE(0) === 0x1a45dfa3) return 'matroska';
  if (ascii(4, 8) === 'ftyp') return 'mov';
  // MP3: an ID3v2 tag, or an MPEG audio frame sync (11 set bits, layer III).
  if (ascii(0, 3) === 'ID3') return 'mp3';
  if (b.length >= 2 && b[0] === 0xff && (b[1]! & 0xe6) === 0xe2) return 'mp3';
  return null;
}

/**
 * FR-132, SDD section 11 (Uploads): checks that `bytes` is one short recording and returns it as
 * a trimmed mono Opus clip like a generated one (NFR-07). The bytes sent are never stored: only
 * ffmpeg's output is. Throws AudioFileError for anything that is not acceptable audio.
 */
export async function transcodeUpload(bytes: Uint8Array): Promise<Buffer> {
  if (bytes.byteLength === 0) throw new AudioFileError('The file is empty');
  if (bytes.byteLength > AUDIO_UPLOAD_MAX_BYTES) {
    throw new AudioFileError(
      `Recordings can be at most ${AUDIO_UPLOAD_MAX_BYTES / 1024 / 1024} MB`,
    );
  }
  const format = sniffContainer(bytes);
  if (!format) {
    throw new AudioFileError('Not a supported audio file (Ogg, Opus, MP3, WAV, WebM, M4A or FLAC)');
  }
  // A file, not a pipe: MP4 may keep its index at the end, which a pipe cannot seek back to.
  const dir = await mkdtemp(join(tmpdir(), 'manabi-upload-'));
  try {
    const input = join(dir, 'input');
    await writeFile(input, bytes);
    const source = ['-protocol_whitelist', 'file', '-f', format, '-i', input];
    // An input option: the decoder stops at the limit, so a file whose header claims a short
    // duration cannot make ffmpeg decode (and areverse buffer) hours of audio.
    const capped = [
      ...source.slice(0, 4),
      '-t',
      String(AUDIO_UPLOAD_MAX_SECONDS),
      ...source.slice(4),
    ];
    let probe: { streams?: { codec_type?: string }[]; format?: { duration?: string } };
    try {
      const stdout = await run('ffprobe', [
        ...['-v', 'error', '-of', 'json', '-show_entries', 'stream=codec_type:format=duration'],
        ...source.slice(0, 4),
        input,
      ]);
      probe = JSON.parse(stdout.toString('utf8')) as typeof probe;
    } catch {
      throw new AudioFileError('The file could not be read as audio');
    }
    if (!probe.streams?.some((s) => s.codec_type === 'audio')) {
      throw new AudioFileError('The file has no audio');
    }
    const duration = Number(probe.format?.duration);
    if (Number.isFinite(duration) && duration > AUDIO_UPLOAD_MAX_SECONDS) {
      throw new AudioFileError(
        `Recordings can be at most ${AUDIO_UPLOAD_MAX_SECONDS} seconds long`,
      );
    }
    try {
      return await run('ffmpeg', [
        ...['-hide_banner', '-loglevel', 'error', ...capped],
        // The first audio stream only (no cover art).
        ...['-map', '0:a:0', '-vn', '-sn', '-dn'],
        ...ENCODE_ARGS,
      ]);
    } catch {
      throw new AudioFileError('The file could not be read as audio');
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * SDD section 11 (Uploads): a new, unguessable path on the media volume for an uploaded clip.
 * Names are generated, never taken from the client, and the volume is outside the web root.
 */
export function uploadedClipPath(ownerType: AudioOwnerType, ownerId: number): string {
  return `audio/${ownerType}/${ownerId}-uploaded-${randomBytes(8).toString('hex')}.opus`;
}

/** Writes a clip whole, then renames it into place, so a reader never sees half a file. */
export async function writeClip(mediaDir: string, path: string, clip: Uint8Array): Promise<void> {
  const file = join(mediaDir, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, clip);
  await rename(`${file}.tmp`, file);
}

/** Removes a clip file that no row points at any more; a missing file is fine. */
export async function removeClip(mediaDir: string, path: string): Promise<void> {
  await rm(join(mediaDir, path), { force: true });
}
