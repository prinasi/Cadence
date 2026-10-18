# Cadence

An interactive, video-based English learning studio. Watch a real clip, follow word-by-word subtitles, look up a word in context, keep it with its timestamp, then rebuild the same line from sound in a dictation room.

This repository is the **Phase 1 MVP**: a local-first Next.js app built around one original 41-second demo lesson, a line-by-line dictation room, and a local video + SRT/VTT import path.

![Cadence home](docs/assets/home.jpg)

![Line-by-line dictation with contextual vocabulary](docs/assets/practice.jpg)

## What works

- Custom HTML5 player with karaoke word highlighting, sentence loop, speed control, captions toggle, and fullscreen.
- Click any word or drag across words to inspect a word/phrase in context.
- Curated dictionary entries with IPA, Chinese gloss, definitions, collocations, examples, pronunciation, and the original timestamp.
- **Lines-first dictation**: the default session walks through the lesson in order (all 10 demo lines, up to 12 per round), with original audio, slow playback, replay count, hints, exact scoring, and a round summary. Word and phrase drills remain available as focus modes.
- **Start anywhere, skip freely**: choose “Start from” any line inside the dictation room, or press **Start here** on the line you are watching. **Skip** advances without recording an attempt or lowering accuracy; skipped lines are reported separately in the summary.
- **Readable feedback**: after every check the correct sentence is always shown; wrong words in the attempt are red, missing words are listed in red, and both **Try again** and **Next line** are available.
- **Cross-cue sentence repair**: imported SRT/VTT cues that split a sentence are joined automatically, while abbreviations, initials, and decimals are not treated as sentence endings.
- “I don’t know” / reveal flow: the answer opens immediately and the words worth keeping appear in a line vocabulary panel.
- Public dictionary integration: curated entries first, then **Free Dictionary API** for meanings and examples, **Datamuse** for common phrase hints, and **MyMemory** for a clearly labelled Chinese quick gloss when no curated Chinese entry exists.
- Notebook with manual add, search, type filters, source replay, single-item practice, delete, and **JSON + CSV export**.
- Import a local **MP4, WebM, MOV, M4V or MKV** video + SRT/VTT. The video is stored in IndexedDB and restored on reload; learning items live in localStorage.
- MKV is accepted as a container, but the browser must be able to decode its codecs. The importer checks playback before enabling import; unsupported MKV files are blocked with an `ffmpeg` conversion hint.
- Responsive desktop/mobile layouts, including a mobile dictionary bottom sheet.

## Demo media

The demo is entirely original: a synthesized English narration, a generated poster, and a generated video. No third-party footage, audio, or transcript is bundled.

- `public/demo/small-habits.mp4` — 41.07s, 10 sentences, 115 words (the same file can be remuxed to `.mkv` for import testing)
- `public/demo/small-habits.srt` — usable for import testing
- `content/demo-lesson.json` — word-level timing data
- `tools/build_demo.py` — reproducible asset pipeline (`say` + faster-whisper); not needed at runtime

Word timings in the demo are ASR-derived and aligned back to the authored script. They are not human-verified frame by frame. Imported SRT/VTT lessons estimate word timing from cue boundaries and are labelled **estimated** in the UI.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Production:

```bash
npm run build
npm start
```

Checks:

```bash
npm run typecheck
npm run lint
npm test
```

## Structure

```text
app/                    Next.js App Router shell and design system
components/             player, transcript, inspector, line dictation + vocabulary, notebook, import
lib/                    types, subtitle parsing, exercises, dictionary, video probe, storage, CSV
content/                generated demo lesson JSON
public/demo/            original demo video/audio/poster/SRT
tests/                  unit tests for parsing, timing, scoring, exercises, notebook CSV
tools/                  demo builder and Chrome validation scripts
docs/implementation-plan.md
```

## Notebook and export

Open the notebook from the header. Use **Add** for words, phrases, or full lines, save items directly from the dictation feedback panel, and export the collection as JSON or CSV. The CSV includes context, translation, definitions, senses, examples, phrases, source timing, and practice counts.

## Scope and limitations

This is deliberately not a SaaS yet. There is no account system, server, cross-device sync, YouTube importer, or FSRS review queue. Line sessions cover up to 12 sentences; public dictionary calls need a network connection; MyMemory Chinese glosses are machine translations and are labelled accordingly. See [the implementation plan](docs/implementation-plan.md) for the feasibility analysis, risk register, revised architecture, and phased roadmap.

## License

Application code: TBD by the project owner.  
Demo video, audio, poster, and generated transcript: original assets created for this repository; no third-party content is included.
