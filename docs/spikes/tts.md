# Spike: self-hosted TTS engine

Issue #1. Requirements: FR-131 (generated audio through a free, self-hosted provider), IF-09 (engine only behind the provider interface, internal network), NFR-07 (mono Opus at 32 kbps or less, silence trimmed), FR-135 (device voice fallback). Rules: SDD section 10 (Audio generation) and section 14 (Spikes).

Status: measurements done; **owner listening, device testing and the decision are still open** (see [Owner decision](#owner-decision)).

## Summary

| | VOICEVOX | Kokoro |
| --- | --- | --- |
| What it is | Japanese-only TTS engine with ~44 character voice libraries | Small (82M) multi-language model; 5 Japanese voices |
| Japanese readings of kanji | Correct for all 40 samples when sent the written form, with dictionary pitch accent | Misreads some kanji (上手 → uwate, 明日 → asu, 川 → gawa); fine when sent kana |
| Pitch accent | Modelled from the OpenJTalk dictionary; editable per accent phrase | Not modelled explicitly; the model guesses it from phonemes |
| Isolated words recognised by Whisper | 24–25 of 30 | 17–21 of 30 |
| Speed at 4 vCPU (threads tuned) | 0.67 s per word, 1.04 s per sentence | 0.20 s per word, 0.36 s per sentence |
| Memory | ~0.3 GB with one voice loaded (+~0.15–0.25 GB per extra voice) | ~1.35 GB |
| Clip size (Opus 24 kbps) | ~1.7 kB per word, ~4.3–5.5 kB per sentence | ~1.9 kB per word, ~4.5 kB per sentence |
| Licence | Engine LGPL-3.0; each voice has its own terms; **credit required** (`VOICEVOX:キャラ名`) | Apache-2.0 (weights and server); no credit required |
| Author's own quality grade | n/a | C+ (jf_alpha) down to C- (jm_kumo, jf_nezumi) |

**Recommendation: VOICEVOX** with one calm standard voice (the samples use 四国めたん ノーマル), sending the written form and checking the engine's reading against the item's kana, falling back to the kana when they differ. Details in [Recommendation](#recommendation). Kokoro is the runner-up: faster, no credit, but weaker Japanese.

## Setup

- Host: 20 cores / 31 GB. Each engine was also run limited to the target LXC size with `--cpus=4 --memory=6g`.
- Images (pulled 2026-11-11):
  - `voicevox/voicevox_engine:cpu-latest` (engine 0.26.1, digest `sha256:46fe4dda…`), 4.5 GB image.
  - `ghcr.io/remsky/kokoro-fastapi-cpu:latest` (Kokoro-FastAPI v0.10.0, Kokoro-82M v1.0, digest `sha256:f54c5960…`), 4.9 GB image.
  - `linuxserver/ffmpeg:latest` (ffmpeg 9.0.2) for conversion.
- Samples: 30 N5 words and 10 short sentences in [tts-samples/samples.json](tts-samples/samples.json), each with written form and kana reading.
- Voices: VOICEVOX 四国めたん ノーマル (id 2), 玄野武宏 ノーマル (11), 冥鳴ひまり ノーマル (14); Kokoro `jf_alpha`, `jf_tebukuro`, `jm_kumo`.
- Each clip was requested once, sequentially, after one warm-up request. CPU time is the container cgroup's `cpu.stat usage_usec` delta per request; memory is the cgroup's `memory.peak` and `memory.stat anon`.
- Conversion (what the worker would do, per NFR-07):

  ```sh
  ffmpeg -i in.wav \
    -af "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse" \
    -ac 1 -c:a libopus -b:a 24k -application voip out.opus
  ```

  This trims leading and trailing silence (keeping 50 ms), downmixes to mono and encodes Ogg Opus at 24 kbps. Output is 48 kHz mono Opus.

## Resource use

Average per clip, sequential requests, first voice of each engine (VOICEVOX 四国めたん, Kokoro jf_alpha) with kana input. "CPU" is CPU-seconds summed over all cores.

| Run | Engine | Word: wall / CPU | Sentence: wall / CPU | First request (loads voice) | Peak memory (cgroup) | Resident (anon) after run |
| --- | --- | --- | --- | --- | --- | --- |
| Unlimited (20 cores) | VOICEVOX | 0.33 s / 6.5 s | 0.57 s / 10.6 s | 1.1 s | 325 MiB | 250 MiB |
| Unlimited (20 cores) | Kokoro | 0.21 s / 1.2 s | 0.36 s / 2.1 s | 0.36 s | 1366 MiB | 1329 MiB |
| 4 CPU / 6 GB, default threads | VOICEVOX | 1.73 s / 6.9 s | 2.66 s / 10.6 s | 4.4 s | 324 MiB | 250 MiB |
| 4 CPU / 6 GB, default threads | Kokoro | 0.32 s / 1.3 s | 0.54 s / 2.1 s | 0.46 s | 1336 MiB | 1300 MiB |
| **4 CPU / 6 GB, threads = 4** | **VOICEVOX** | **0.67 s / 2.7 s** | **1.04 s / 4.2 s** | 1.8 s | 322 MiB | 235 MiB |
| **4 CPU / 6 GB, threads = 4** | **Kokoro** | **0.20 s / 0.8 s** | **0.36 s / 1.4 s** | 0.34 s | 1347 MiB | 1319 MiB |

Notes:

- **Set the thread count to the LXC's vCPUs.** Both engines size their thread pools from the host's visible cores (20 here), not the container's CPU quota. Under a 4-CPU quota that wastes CPU on spinning threads: VOICEVOX was 2.6x slower until `VV_CPU_NUM_THREADS=4`; Kokoro saved ~40% CPU with `OMP_NUM_THREADS=4`. In an LXC with 4 real vCPUs the visible core count is already 4, so this matters less there, but set it explicitly anyway.
- **VOICEVOX memory grows per voice used**: idle 85 MiB, ~320 MiB after the first voice, ~470 MiB after a second, ~650–700 MiB after a third. Using one voice keeps it near 0.3 GB.
- **Kokoro holds ~1.2 GB as soon as it starts** (all languages' pipelines share one model) and peaks near 1.35 GB.
- Startup: VOICEVOX answers within ~1 s; Kokoro needs ~6–7 s to load.
- Whole-course estimate (assume ~3,750 words and ~3,000 sentences for N5–N3, from scratch, at 4 vCPU with tuned threads): VOICEVOX ~1.6 hours, Kokoro ~0.5 hours. Both are fine for a background job that runs once and then only for new or changed items; the TTS container can be stopped afterwards (SDD 12, `tts` Compose profile).

Idle CPU, measured in 10-second windows after a burst of requests (4 CPU, threads = 4):

| Window after the last request | VOICEVOX | Kokoro |
| --- | --- | --- |
| 0–10 s | 2.8% of one core | 0.3% |
| 20–30 s | 0.1% | 0.2% |
| 60–70 s and 120–130 s | 0.1% | 0.1% |

Both engines are effectively idle when not generating, so leaving the container running costs memory only.

## Clip size

After trimming and conversion to mono Opus 24 kbps. Same numbers in every run (output is deterministic).

| Set | Words: avg duration / avg size | Sentences: avg duration / avg size | All 40 clips |
| --- | --- | --- | --- |
| VOICEVOX 四国めたん, written form | 0.54 s / 1.77 kB | 1.39 s / 4.3 kB | 94 kB |
| VOICEVOX 四国めたん, kana | 0.53 s / 1.75 kB | 1.88 s / 5.6 kB | 106 kB |
| VOICEVOX 冥鳴ひまり, kana | 0.48 s / 1.60 kB | 1.94 s / 5.5 kB | 101 kB |
| VOICEVOX 玄野武宏, kana | 0.45 s / 1.46 kB | 1.87 s / 5.3 kB | 94 kB |
| Kokoro jf_alpha, kana | 0.59 s / 1.89 kB | 1.45 s / 4.5 kB | 100 kB |
| Kokoro jf_alpha, written form | 0.58 s / 1.88 kB | 1.44 s / 4.6 kB | 99 kB |
| Kokoro jf_tebukuro, kana | 0.64 s / 2.04 kB | 1.39 s / 4.3 kB | 102 kB |
| Kokoro jm_kumo, kana | 0.66 s / 2.18 kB | 1.46 s / 4.6 kB | 109 kB |

- Effective bitrate is 23–27 kbps (Ogg container overhead on very short clips), inside NFR-07's 32 kbps limit. SDD's estimate of ~3 kB per second of speech holds.
- Whole-course storage at these sizes: roughly 3,750 × 1.8 kB + 3,000 × 5 kB ≈ 22 MB. Far under the SDD's 1 GB budget.
- VOICEVOX kana sentences are longer than written-form ones because **spaces in kana become pauses** (`、`) in VOICEVOX. Strip spaces before sending kana to VOICEVOX.
- Opus played in headless Chromium (desktop). Whether Safari on the family's iPhones plays Ogg Opus is one of the things the device test page checks; SDD 10 keeps an MP3 copy as the fallback only if a browser needs it.

## Quality

I could not listen to the clips, so quality below is from objective checks only. **The owner should listen** before deciding: open [tts-samples/index.html](tts-samples/index.html) from a local clone (it plays every clip side by side), or the files directly:

- VOICEVOX: [四国めたん text](tts-samples/voicevox/metan-text/), [四国めたん kana](tts-samples/voicevox/metan-kana/), [冥鳴ひまり kana](tts-samples/voicevox/himari-kana/), [玄野武宏 kana](tts-samples/voicevox/takehiro-kana/)
- Kokoro: [jf_alpha kana](tts-samples/kokoro/alpha-kana/), [jf_alpha text](tts-samples/kokoro/alpha-text/), [jf_tebukuro kana](tts-samples/kokoro/tebukuro-kana/), [jm_kumo kana](tts-samples/kokoro/kumo-kana/)

Things to listen for: natural pitch accent on single words (水, 雨, 先生, 切手), long vowels (先生, 時計, コーヒー), small っ (学校, 切手), and whether sentences sound like one phrase or word by word.

### Readings: written form versus kana

What each engine would say, from VOICEVOX's `audio_query` `kana` field (`'` marks the accent, `_` a devoiced vowel) and Kokoro's `/dev/phonemize`. Only rows where the two inputs differ in a way that matters:

| Sample | Expected | VOICEVOX, written form | VOICEVOX, kana | Kokoro, written form | Kokoro, kana |
| --- | --- | --- | --- | --- | --- |
| 水 | みず (heiban) | ミズ' (correct) | ミ'ズ (wrong accent) | mʲizɨ | mʲizɨ |
| 雨 | あめ (head-high) | ア'メ (correct) | アメ' (wrong accent: 飴) | ame | ame |
| 行く | いく (heiban) | イク' (correct) | イ'ク (wrong accent) | ikɯ | ikɯ |
| 切手 | きって (heiban) | キッテ' (correct) | キ'ッテ (wrong accent) | kʲiʔte | kʲiʔte |
| 先生 | せんせい (accent on せ) | センセ'エ (correct) | センセイ' (wrong accent) | seɴseː | seɴseː |
| 川 | かわ | カワ' | カワ' | **ɡaβa (wrong: rendaku)** | kaβa |
| 明日 | あした | ア_シタ' | ア_シタ' | **asɨ (あす, not the taught reading)** | aɕita |
| 上手 | じょうず | ジョオズ' | ジョオズ' | **ɯβate (wrong: うわて)** | ʥoːzɨ |
| 日本語 | にほんご | ニホンゴ' | ニホンゴ' | ɲiʔpoŋɡo (にっぽんご) | ɲihoŋɡo |
| 私は学生です | わたしは… | ワタシワ'… | ワタシワ'… | **βatakɯɕi (わたくし)** | βataɕi |
| 時計 | とけい | トケエ' | トケイ' | tokeː | toke i (split vowel) |

What this means for "send the kana reading where the engine allows" (SDD 10):

- **Kokoro must be sent kana.** Its Japanese front end (misaki with pyopenjtalk) got the reading wrong in 5 of 40 written-form samples (川, 明日 twice, 上手, 私) and said にっぽんご for 日本語; with kana every reading was right.
- **VOICEVOX should be sent the written form, not bare kana.** VOICEVOX read all 40 written forms correctly and the dictionary gives the right pitch accent. Bare kana is ambiguous (あめ is 雨 or 飴), so the accent went wrong on 5 of 30 words, and spaces in the kana add pauses. The safe pattern is: send the written form, compare the reading VOICEVOX returns in `audio_query.kana` with the item's kana, and only if they differ resend as kana (spaces removed). VOICEVOX also accepts AquesTalk-style kana with accent marks (`/accent_phrases?is_kana=true`), which would allow exact accent overrides later, but the content pipeline has no pitch-accent data today.

### Round-trip intelligibility (speech recognition)

As a rough, objective stand-in for listening, every Opus clip was transcribed by Whisper (`medium`, faster-whisper, language forced to Japanese, in the `onerahmet/openai-whisper-asr-webservice` container) and counted as a match when the transcript equals the sample's written form or kana (after normalising script and punctuation).

| Set | Words recognised | Sentences recognised |
| --- | --- | --- |
| VOICEVOX 四国めたん, written form | 24/30 | 10/10 |
| VOICEVOX 四国めたん, kana | 24/30 | 9/10 |
| VOICEVOX 冥鳴ひまり, kana | 24/30 | 9/10 |
| VOICEVOX 玄野武宏, kana | 25/30 | 10/10 |
| Kokoro jf_alpha, kana | 21/30 | 10/10 |
| Kokoro jf_alpha, written form | 17/30 | 10/10 |
| Kokoro jf_tebukuro, kana | 19/30 | 9/10 |
| Kokoro jm_kumo, kana | 18/30 | 10/10 |

How to read this:

- Single words with no context are hard for speech recognition, so no set scores 30/30, and some "misses" are homophones that sound right (切手 heard as 切って or 聞いて, 時計 heard as オッケー by several voices, 飲む as ナム for both engines). Sentences, where context helps, are recognised almost perfectly by both engines.
- The misses that point at real pronunciation problems are mostly Kokoro's: 犬 heard as いいなぁ / いいの, 学校 as だっこ, 見る as 見える, 行く as 一個, 駅 as IQ / レッキー, 一人 as フィトリア, and with written-form input 上手 as うわて and 明日 as 汗. VOICEVOX's misses are mostly short or devoiced words (水 → ミス, 駅 → でき, 電車 → 列車).
- Overall this supports the reading check above: VOICEVOX is more intelligible on isolated words, which is what most Manabi clips are. It does not replace listening.

## Licence, usage and credit terms

Checked 2026-11-11 against official sources. Not legal advice. Manabi is self-hosted, non-commercial, for family and friends.

### VOICEVOX

- **Software** ([VOICEVOX terms](https://voicevox.hiroshiba.jp/term/)): free for commercial and non-commercial use; a credit showing VOICEVOX was used is required; each voice library's own terms also apply. Forbidden: redistributing the software without permission, reverse engineering, acts harming the creator or third parties, acts against public order. Manabi pulls the official image and does not redistribute the software, so do not bake VOICEVOX into Manabi's own images.
- **Engine source** ([voicevox_engine](https://github.com/VOICEVOX/voicevox_engine)): dual-licensed LGPL-3.0, or a separate licence from the author that does not require publishing source. Running the unmodified official container is fine under LGPL.
- **Voices**: each character has its own terms. The engine serves the summary at `GET /speaker_info?speaker_uuid=…` (`policy` field); quoted below from engine 0.26.1 and the linked official pages.

| Voice | Credit text (exact) | Commercial | Extra conditions | Official terms |
| --- | --- | --- | --- | --- |
| 四国めたん | `VOICEVOX:四国めたん` | Yes | Common rules for the Tohoku/Shikoku family: no political or religious use, no deceptive content, no adult entertainment business, no use by antisocial forces. In apps, credit goes on an intro screen or somewhere easy to find. Use without credit needs a paid contract (¥400,000 + tax per character). | [zunko.jp](https://zunko.jp/con_ongen_kiyaku.html) |
| ずんだもん | `VOICEVOX:ずんだもん` | Yes | Same as 四国めたん | [zunko.jp](https://zunko.jp/con_ongen_kiyaku.html) |
| 冥鳴ひまり | `VOICEVOX:冥鳴ひまり` | Yes | No public-order violations, no harm to third parties, nothing tied to specific ideologies, nothing the rights holder deems inappropriate | [meimeihimari.com](https://www.meimeihimari.com/terms-of-use) |
| 玄野武宏, 白上虎太郎 | `VOICEVOX:玄野武宏` / `VOICEVOX:白上虎太郎` | Yes | VirVox terms: no using output to train other voice models; no political/religious promotion; no harm to the character's image; credit removal needs permission | [virvoxproject.com](https://www.virvoxproject.com/voicevoxの利用規約) |
| 青山龍星 | `VOICEVOX:青山龍星` | Yes, for individuals | Same VirVox terms; use involving a company needs prior approval; credit cannot be removed | [virvoxproject.com](https://www.virvoxproject.com/voicevoxの利用規約) |
| 春日部つむぎ | `VOICEVOX:春日部つむぎ` | Yes | See official page (site was unreachable from here; summary from the engine) | [tsumugi-official.studio.site](https://tsumugi-official.studio.site/rule) |
| 雨晴はう | `VOICEVOX:雨晴はう` | Yes | See official page | [amehau.com](https://amehau.com/?page_id=225) |
| 波音リツ | `VOICEVOX:波音リツ` | Yes | See official page | [canon-voice.com](http://canon-voice.com/kiyaku.html) |
| No.7 | `VOICEVOX:No.7` | **Non-commercial only** without prior approval | | [voiceseven.com](https://voiceseven.com/#j0200) |
| もち子さん | `VOICEVOX:もち子(cv 明日葉よもぎ)` | Yes, except voice works, voice material, games | Company involvement needs approval | [mochizora](https://vtubermochio.wixsite.com/mochizora/利用規約) |

What Manabi must do if VOICEVOX is chosen:

- Show `VOICEVOX:<character>` for every voice used, on the About page (which already lists dataset licences) and in the audio settings or next to the speaker control. Store the credit text with the voice choice (`ttsVoice`) so it follows if the voice changes.
- Keep content within the voice's rules (Manabi's course content is fine).
- Prefer one voice per language. Avoid No.7 and もち子さん (extra restrictions) and anything needing approval.

### Kokoro

- **Model weights**: Apache-2.0 ([Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)). No credit required for generated audio.
- **Server**: Kokoro-FastAPI is Apache-2.0; its StyleTTS2-derived inference code is MIT ([Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI)).
- **Japanese front end**: misaki (Apache-2.0) with pyopenjtalk / OpenJTalk dictionary.
- **Training data**: the model card lists CC BY audio used in training (the Japanese voices' listed sources are readings of public-domain stories: gongitsune, nezuminoyomeiri, tebukurowokaini, kumonoito). This attribution concerns the training data, not the output; listing "Kokoro-82M (Apache-2.0)" on the About page is a courtesy, not a requirement.
- **Quality caveat from the author**: Japanese training data is "H hours" (1–10 h), voices are graded C+ (jf_alpha) to C- (jm_kumo, jf_nezumi), and the voice list warns that non-English support "may be absent or thin due to weak G2P and/or lack of training data".

### Device voices (Web Speech API)

No licence question: the voice belongs to the learner's OS or browser and is played only on their device.

## Device voices

Test page: [tts-device-voices.html](tts-device-voices.html) (single file, no external scripts). Open it on each phone and browser (serve it from the home server or send the file; some browsers only list voices on `https` or `http://localhost`). It:

- lists the Japanese voices the browser offers and whether each is on-device or network;
- speaks the same 30 words and 10 sentences with `speechSynthesis` (kana or written form, adjustable rate);
- reports `canPlayType` for Ogg Opus, WebM Opus and MP3, and plays one embedded Ogg Opus clip from VOICEVOX to check that stored clips will play;
- builds a Markdown row for the table below.

Checked on this machine with headless Chromium only: the page loads without errors, Ogg Opus plays, and headless Chromium has no speech voices (expected).

**TODO (owner):** fill in one row per family device and browser.

| Device | Browser | Japanese voices | Voice used | Quality (1–5) | Opus | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

## Recommendation

**VOICEVOX**, one voice for all Japanese audio, recommended to start with 四国めたん ノーマル (speaker id 2) unless the owner prefers another after listening.

Why:

1. **Japanese quality is the point of the app.** VOICEVOX is built for Japanese, reads written forms correctly and models pitch accent from a dictionary. Kokoro's own author grades its Japanese voices C+ at best, trained on a few hours of audio, and its front end misreads common N5 kanji unless given kana. For a learner copying pronunciation, pitch accent and correct readings matter more than speed.
2. **It fits the server.** About 0.3 GB of memory with one voice, against Kokoro's 1.35 GB. It is slower (0.7–1 s per clip at 4 vCPU), but a one-off batch of about 1.6 hours for the whole N3 course is acceptable for a background job, and the container can be stopped afterwards.
3. **Its terms work for Manabi.** Free for this use; the cost is a visible `VOICEVOX:四国めたん` credit, which fits on the About page.

Kokoro is the right choice instead if the owner, after listening, finds its voices good enough and prefers no credit, a 3x faster batch, or one engine for future languages (Kokoro also covers English, Spanish, French, Hindi, Italian, Portuguese and Chinese). The provider interface makes switching later cheap: regenerate the audio.

Deployment notes for the real implementation (separate issue):

- Compose service under the optional `tts` profile, on the internal network only (IF-09), no published port. Pin the image by version or digest, not `cpu-latest`.
- Set `VV_CPU_NUM_THREADS` to the LXC's vCPU count.
- Allow ~1 GB of memory for the container while generating.

## TtsProvider request shape

SDD 10 sketches `synthesize(text, voice)`. VOICEVOX (and Kokoro) need a little more: the kana reading next to the written form, and something to report which input was used and the credit.

```ts
// packages/core: engine-neutral types.
export type TtsVoice = {
  locale: string;   // 'ja-JP'
  provider: string; // 'voicevox' | 'kokoro'
  voice: string;    // VOICEVOX speaker style id ('2') or Kokoro voice name ('jf_alpha')
  credit?: string;  // text the app must show, e.g. 'VOICEVOX:四国めたん'
};

export type TtsRequest = {
  text: string;     // written form, e.g. '水を飲みます。'
  reading?: string; // kana reading from the item or sentence, e.g. 'みずを のみます。'
  voice: TtsVoice;
  speed?: number;   // 1.0 default; VOICEVOX speedScale, Kokoro speed
};

export type TtsResult = {
  audio: Uint8Array;      // WAV from the engine; the worker trims and converts to Opus
  mimeType: 'audio/wav';
  input: 'text' | 'reading'; // what was finally sent, stored on audio_assets for review
  engineReading?: string;   // VOICEVOX's reading of the text, for logs and author review
};

export interface TtsProvider {
  synthesize(req: TtsRequest): Promise<TtsResult>;
}
```

VOICEVOX provider (apps/api worker), two HTTP calls per clip:

1. `POST /audio_query?text=<text>&speaker=<id>` returns an AudioQuery JSON with `kana` (the engine's reading, e.g. `ミズオ'/ノミマ'_ス`), `accent_phrases`, `speedScale`, `prePhonemeLength`, `postPhonemeLength`, `outputSamplingRate` (24000), `outputStereo` (false).
2. If `reading` is given and the language plugin says the engine's reading does not match it, call `audio_query` again with the reading (spaces removed).
3. Set `speedScale` from `speed`, then `POST /synthesis?speaker=<id>` with the AudioQuery as the JSON body; the response is `audio/wav` (24 kHz, 16-bit mono).

Comparing the engine's katakana reading (`ミズオ'/ノミマ'_ス`, long vowels written as オオ/エエ) with the item's kana (`みずを のみます`) is Japanese-specific, so it belongs in `packages/lang-ja` behind the `LanguagePlugin` interface (for example a `readingsMatch(engineReading, reading)` helper), not in the provider or the worker.

Kokoro provider, one call: `POST /v1/audio/speech` with `{ "model": "kokoro", "input": reading ?? text, "voice": "jf_alpha", "lang_code": "j", "response_format": "wav", "speed": 1.0 }`, always sending the reading when there is one.

## Owner decision

**Open: the owner picks.** Before deciding:

- [ ] Listen to the samples ([tts-samples/index.html](tts-samples/index.html)).
- [ ] Run [tts-device-voices.html](tts-device-voices.html) on the family's phones and browsers and fill in the device table.
- [ ] Choose one:
  - [ ] VOICEVOX, voice: ______ (credit text: `VOICEVOX:______`)
  - [ ] Kokoro, voice: ______
  - [ ] Device voices only for v1 (SDD 14 fallback)
- [ ] Record the date and reasoning here, then update SDD 10/14 and `ttsVoice` in `packages/lang-ja`.

Decision: _(pending)_

## Reproducing

Scripts used are not committed (throwaway). Outline:

```sh
docker run -d --name vv --cpus=4 --memory=6g -e VV_CPU_NUM_THREADS=4 -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest
docker run -d --name kk --cpus=4 --memory=6g -e OMP_NUM_THREADS=4 -p 127.0.0.1:8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
# VOICEVOX: POST /audio_query?text=…&speaker=2, then POST /synthesis?speaker=2 with the query as body
# Kokoro:   POST /v1/audio/speech {"model":"kokoro","input":"…","voice":"jf_alpha","lang_code":"j","response_format":"wav"}
# CPU and memory: /sys/fs/cgroup/system.slice/docker-<id>.scope/{cpu.stat,memory.peak,memory.stat}
```
