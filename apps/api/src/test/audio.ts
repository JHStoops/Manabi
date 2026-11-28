/**
 * A 16-bit PCM WAV: 0.5 s of silence, `toneSeconds` of a 440 Hz tone, 0.5 s of silence. Stereo
 * and padded by default so tests see the downmix and the trim.
 */
export function wav(toneSeconds = 1.5, { rate = 24000, channels = 2 } = {}): Uint8Array {
  const pad = rate / 2;
  const frames = pad * 2 + Math.round(rate * toneSeconds);
  const frameBytes = 2 * channels;
  const buf = Buffer.alloc(44 + frames * frameBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + frames * frameBytes, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * frameBytes, 28);
  buf.writeUInt16LE(frameBytes, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(frames * frameBytes, 40);
  for (let i = pad; i < frames - pad; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000);
    for (let c = 0; c < channels; c++) buf.writeInt16LE(v, 44 + i * frameBytes + c * 2);
  }
  return buf;
}
