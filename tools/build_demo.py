#!/usr/bin/env python3
"""Build the original Cadence demo lesson.

The narration is synthesized locally with macOS `say`; word boundaries are
recovered with faster-whisper and aligned back to the authored script. No
third-party video, audio or transcript is used.
"""

from __future__ import annotations

import json
import math
import re
import subprocess
import wave
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
TMP = ROOT / ".tmp" / "demo-build"
PUBLIC = ROOT / "public" / "demo"
CONTENT = ROOT / "content"
TMP.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)
CONTENT.mkdir(parents=True, exist_ok=True)

VOICE = "Samantha"
RATE = 165
GAP = 0.42
SAMPLE_RATE = 24000

SENTENCES = [
    ("Most of us wait for a big moment to change our lives.", "我们大多数人都在等待一个重大时刻来改变人生。"),
    ("But real progress rarely arrives in a single, dramatic leap.", "但真正的进步很少来自一次戏剧性的飞跃。"),
    ("It grows quietly, through small choices repeated day after day.", "它安静地生长，源于日复一日重复的小选择。"),
    ("A page read before bed becomes a finished book.", "睡前读一页，最终会变成一本读完的书。"),
    ("A short walk after lunch becomes a stronger body.", "午饭後散一小段步，最终会变成更强健的身体。"),
    ("And five minutes of English practice becomes a conversation you never expected to have.", "而每天五分钟的英语练习，会变成一场你从未想过自己能进行的对话。"),
    ("So instead of waiting for motivation, build a system you can return to.", "所以，与其等待动力，不如建立一个你可以不断回到其中的系统。"),
    ("Start small, stay consistent, and let the ordinary do its work.", "从小处开始，保持持续，让平凡的事发挥作用。"),
    ("You do not need a perfect morning or a brand new plan.", "你不需要一个完美的早晨，也不需要一份全新的计划。"),
    ("You only need the next small step, and the willingness to take it again tomorrow.", "你只需要下一个小步骤，以及明天再迈出一步的意愿。"),
]

FOCUS_PHRASES = [
    {"text": "a big moment", "translation": "一个重大时刻", "sentence": 0},
    {"text": "dramatic leap", "translation": "戏剧性的飞跃", "sentence": 1},
    {"text": "day after day", "translation": "日复一日", "sentence": 2},
    {"text": "before bed", "translation": "睡前", "sentence": 3},
    {"text": "after lunch", "translation": "午饭后", "sentence": 4},
    {"text": "expected to have", "translation": "曾期待会拥有", "sentence": 5},
    {"text": "instead of", "translation": "而不是；代替", "sentence": 6},
    {"text": "return to", "translation": "回到；重新投入", "sentence": 6},
    {"text": "stay consistent", "translation": "保持持续", "sentence": 7},
    {"text": "brand new", "translation": "全新的", "sentence": 8},
    {"text": "the willingness to", "translation": "愿意去……", "sentence": 9},
]

WORD_RE = re.compile(r"[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*")
TOKEN_RE = re.compile(r"[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*|[^\sA-Za-z0-9]+")
STOPWORDS = {"the", "a", "an", "of", "to", "and", "or", "but", "in", "on", "for", "with", "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "these", "those", "i", "you", "we", "they", "he", "she", "my", "your", "our", "their", "as", "at", "by", "from", "so", "do", "does", "did", "not", "never", "can", "could", "will", "would", "should", "may", "might", "must", "have", "has", "had"}


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, **kwargs)


def synth(text: str, path: Path) -> None:
    run(["say", "-v", VOICE, "-r", str(RATE), "-o", str(path), text])


def to_wav(src: Path, dst: Path, rate: int = SAMPLE_RATE) -> None:
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", str(rate), "-c:a", "pcm_s16le", str(dst)])


def read_pcm(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as f:
        rate = f.getframerate()
        channels = f.getnchannels()
        width = f.getsampwidth()
        data = f.readframes(f.getnframes())
    assert channels == 1 and width == 2, (channels, width)
    return np.frombuffer(data, dtype=np.int16), rate


def tokenize(text: str) -> list[dict]:
    """Tokenize into words while keeping punctuation attached for display."""
    matches = list(TOKEN_RE.finditer(text))
    out: list[dict] = []
    pending = ""
    for m in matches:
        piece = m.group(0)
        if WORD_RE.fullmatch(piece):
            out.append({"text": piece, "display": pending + piece, "prefix": pending, "suffix": ""})
            pending = ""
        elif out:
            out[-1]["suffix"] += piece
            out[-1]["display"] += piece
        else:
            pending += piece
    return out


def normalize_word(word: str) -> str:
    return re.sub(r"[^a-z0-9']", "", word.lower().replace("’", "'"))


def align_words(original: list[dict], recognized: list[dict], duration: float) -> list[dict]:
    """Align whisper word timings to authored words, interpolating gaps."""
    norm_orig = [normalize_word(t["text"]) for t in original]
    norm_rec = [normalize_word(w["word"]) for w in recognized]
    out = [None] * len(original)
    matcher = SequenceMatcher(a=norm_orig, b=norm_rec, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                out[i1 + k] = {
                    "start": float(recognized[j1 + k]["start"]),
                    "end": float(recognized[j1 + k]["end"]),
                }

    # Fill unmatched runs using neighbouring anchors and character weights.
    i = 0
    while i < len(original):
        if out[i] is not None:
            i += 1
            continue
        j = i
        while j < len(original) and out[j] is None:
            j += 1
        lo = out[i - 1]["end"] if i > 0 else 0.0
        hi = out[j]["start"] if j < len(original) else duration
        if hi - lo < 0.08:
            hi = min(duration, lo + 0.08 * (j - i))
        weights = [max(2, len(norm_orig[k])) for k in range(i, j)]
        total = sum(weights)
        cursor = lo
        for k, weight in zip(range(i, j), weights):
            span = (hi - lo) * weight / total
            out[k] = {"start": cursor, "end": cursor + span}
            cursor += span
        i = j

    # Ensure monotonic, stable timings.
    result = []
    for idx, (tok, timing) in enumerate(zip(original, out)):
        start = max(0.0, min(float(timing["start"]), duration))
        end = max(start + 0.04, min(float(timing["end"]), duration))
        if idx > 0:
            start = max(start, result[-1]["end"] - 0.02)
            end = max(end, start + 0.04)
        result.append({**tok, "start": round(start, 3), "end": round(end, 3)})
    return result


def build_poster(path: Path) -> None:
    W, H = 1600, 900
    top = np.array([244, 238, 224], dtype=float)
    bottom = np.array([226, 217, 197], dtype=float)
    grad = np.linspace(0, 1, H)[:, None, None]
    base = (top[None, None, :] * (1 - grad) + bottom[None, None, :] * grad)
    base = np.repeat(base, W, axis=1)
    arr = np.clip(base, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, "RGB")

    overlay = Image.new("RGB", (W, H))
    od = ImageDraw.Draw(overlay)
    od.ellipse((1010, -170, 1730, 550), fill=(197, 214, 190))
    od.ellipse((1230, 270, 1700, 740), fill=(57, 87, 68))
    od.ellipse((1410, 430, 1590, 610), fill=(218, 90, 54))
    od.ellipse((-220, 600, 380, 1200), fill=(236, 198, 112))
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse((1010, -170, 1730, 550), fill=235)
    md.ellipse((1230, 270, 1700, 740), fill=210)
    md.ellipse((1410, 430, 1590, 610), fill=255)
    md.ellipse((-220, 600, 380, 1200), fill=120)
    img = Image.composite(overlay, img, mask.filter(ImageFilter.GaussianBlur(1)))

    # Fine paper grain.
    rng = np.random.default_rng(7)
    grain = rng.normal(0, 4.2, (H, W, 1)).repeat(3, axis=2)
    img = Image.fromarray(np.clip(np.asarray(img, dtype=float) + grain, 0, 255).astype(np.uint8))

    d = ImageDraw.Draw(img)
    didot = ImageFont.truetype("/System/Library/Fonts/Supplemental/Didot.ttc", 92)
    didot_small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Didot.ttc", 38)
    avenir = ImageFont.truetype("/System/Library/Fonts/Avenir Next.ttc", 22)
    avenir_bold = ImageFont.truetype("/System/Library/Fonts/Avenir Next.ttc", 22)
    avenir_small = ImageFont.truetype("/System/Library/Fonts/Avenir Next.ttc", 17)

    def spaced(draw, xy, text, font, fill, spacing=4, anchor=None):
        x, y = xy
        for ch in text:
            draw.text((x, y), ch, font=font, fill=fill, anchor=anchor)
            x += draw.textlength(ch, font=font) + spacing

    spaced(d, (122, 104), "CADENCE  /  MINI-LESSON 01", avenir_bold, (48, 65, 54), 3.2)
    d.line((122, 148, 442, 148), fill=(48, 65, 54), width=2)
    d.text((118, 218), "The Quiet Power", font=didot, fill=(24, 33, 29))
    d.text((118, 320), "of Small Habits", font=didot, fill=(24, 33, 29))
    d.text((122, 456), "A short lesson on consistency, motivation,", font=avenir, fill=(68, 80, 72))
    d.text((122, 492), "and the ordinary work of becoming better.", font=avenir, fill=(68, 80, 72))
    d.line((122, 582, 122, 660), fill=(218, 90, 54), width=4)
    d.text((146, 586), "LISTEN  ·  NOTICE  ·  REPEAT", font=avenir_small, fill=(80, 95, 84))
    d.text((146, 618), "Original narration  ·  General American", font=avenir_small, fill=(110, 119, 110))

    # Hand-drawn orbit lines.
    for r, alpha in [(250, 38), (310, 28), (370, 20)]:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.arc((1430 - r, 400 - r, 1430 + r, 400 + r), 110, 252, fill=(255, 251, 238, alpha), width=2)
        img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")

    d = ImageDraw.Draw(img)
    d.text((1500, 760), "01", font=ImageFont.truetype("/System/Library/Fonts/Supplemental/Didot.ttc", 118), fill=(247, 241, 226), anchor="ra")
    img.save(path, quality=94, subsampling=1)


def build_video(poster: Path, audio: Path, out: Path, duration: float) -> None:
    filters = (
        "[0:v]scale=1760:990,"
        "zoompan=z='min(zoom+0.000045,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=30,"
        "eq=saturation=1.02:contrast=1.01,"
        "noise=alls=3:allf=t+u,"
        "vignette=PI/5.2,format=yuv420p[v]"
    )
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-loop", "1", "-framerate", "30", "-i", str(poster),
        "-i", str(audio),
        "-t", f"{duration:.3f}",
        "-filter_complex", filters,
        "-map", "[v]", "-map", "1:a",
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", "-shortest", str(out),
    ]
    run(cmd)


def main() -> None:
    print("Synthesizing narration…")
    pcm_parts: list[np.ndarray] = []
    line_files: list[Path] = []
    gaps = np.zeros(int(SAMPLE_RATE * GAP), dtype=np.int16)
    for i, (text, _) in enumerate(SENTENCES):
        aiff = TMP / f"line-{i:02d}.aiff"
        wav = TMP / f"line-{i:02d}.wav"
        wav16 = TMP / f"line-{i:02d}-16k.wav"
        synth(text, aiff)
        to_wav(aiff, wav)
        to_wav(aiff, wav16, 16000)
        pcm, rate = read_pcm(wav)
        assert rate == SAMPLE_RATE
        pcm_parts.append(pcm)
        if i < len(SENTENCES) - 1:
            pcm_parts.append(gaps)
        line_files.append(wav)

    combined = np.concatenate(pcm_parts)
    narration = TMP / "narration.wav"
    with wave.open(str(narration), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE)
        f.writeframes(combined.tobytes())

    print("Recovering word-level timings with faster-whisper…")
    model = WhisperModel("tiny.en", device="cpu", compute_type="int8", download_root=str(TMP / "models"))
    sentences = []
    cursor = 0.0
    for i, ((text, translation), wav) in enumerate(zip(SENTENCES, line_files)):
        wav16 = TMP / f"line-{i:02d}-16k.wav"
        pcm, _ = read_pcm(wav)
        asr_pcm, asr_rate = read_pcm(wav16)
        assert asr_rate == 16000
        duration = len(pcm) / SAMPLE_RATE
        segments, _ = model.transcribe(
            asr_pcm.astype(np.float32) / 32768.0, language="en", beam_size=5, word_timestamps=True,
            condition_on_previous_text=False, vad_filter=False,
        )
        recognized = []
        for seg in segments:
            for w in seg.words or []:
                recognized.append({"word": w.word.strip(), "start": w.start, "end": w.end})
        tokens = tokenize(text)
        aligned = align_words(tokens, recognized, duration)
        first = aligned[0]["start"] if aligned else 0.0
        last = aligned[-1]["end"] if aligned else duration
        start = max(0.0, cursor + first - 0.14)
        end = cursor + min(duration, last + 0.30)
        for token in aligned:
            token["start"] = round(cursor + token["start"], 3)
            token["end"] = round(cursor + token["end"], 3)
            token["id"] = f"s{i + 1}-w{aligned.index(token) + 1}"
        sentences.append({
            "id": f"s{i + 1}",
            "index": i,
            "text": text,
            "translation": translation,
            "start": round(start, 3),
            "end": round(end, 3),
            "words": aligned,
        })
        cursor += duration + GAP
        print(f"  {i + 1:02d}  {text[:62]:<64} {start:6.2f}–{end:6.2f}")

    duration = len(combined) / SAMPLE_RATE
    audio_out = PUBLIC / "small-habits.m4a"
    to_wav(TMP / "narration.wav", TMP / "narration-48.wav", 48000)
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(TMP / "narration-48.wav"), "-c:a", "aac", "-b:a", "144k", str(audio_out)])

    print("Rendering poster and video…")
    poster = PUBLIC / "small-habits.jpg"
    build_poster(poster)
    build_video(poster, narration, PUBLIC / "small-habits.mp4", duration)

    lesson = {
        "id": "small-habits",
        "title": "The Quiet Power of Small Habits",
        "subtitle": "Why consistency beats motivation — and what that means for learning English.",
        "speaker": "Samantha · Cadence Studio",
        "accent": "General American",
        "level": "B1–B2",
        "duration": round(duration, 3),
        "videoSrc": "/demo/small-habits.mp4",
        "poster": "/demo/small-habits.jpg",
        "sourceNote": "Original narration synthesized for this demo. No third-party footage or transcript.",
        "alignment": "exact",
        "tags": ["Mindset", "Habits", "Learning"],
        "sentences": sentences,
        "focusPhrases": FOCUS_PHRASES,
    }
    (CONTENT / "demo-lesson.json").write_text(json.dumps(lesson, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # A portable subtitle artifact, useful for import testing and for users.
    def ts(seconds: float, sep: str = ",") -> str:
        ms = round(seconds * 1000)
        h, rem = divmod(ms, 3600000)
        m, rem = divmod(rem, 60000)
        s, ms = divmod(rem, 1000)
        return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"
    srt = []
    for i, sentence in enumerate(sentences, 1):
        srt.append(f"{i}\n{ts(sentence['start'])} --> {ts(sentence['end'])}\n{sentence['text']}\n")
    (PUBLIC / "small-habits.srt").write_text("\n".join(srt), encoding="utf-8")

    manifest = {
        "duration": round(duration, 3),
        "words": sum(len(s["words"]) for s in sentences),
        "sentences": len(sentences),
        "audio": str(audio_out.relative_to(ROOT)),
        "video": "public/demo/small-habits.mp4",
    }
    (PUBLIC / "demo-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
