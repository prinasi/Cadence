"use client";

let currentAudio: HTMLAudioElement | null = null;

export function stopPronunciation(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function playAudioUrl(url: string): void {
  if (typeof window === "undefined") return;
  stopPronunciation();
  const audio = new Audio(url);
  currentAudio = audio;
  void audio.play().catch(() => {
    currentAudio = null;
  });
}

export function speak(text: string, rate = 0.9): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  stopPronunciation();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((candidate) => /Samantha|Ava|Allison|Serena/i.test(candidate.name)) ??
    voices.find((candidate) => candidate.lang === "en-US") ??
    voices.find((candidate) => candidate.lang.startsWith("en"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}
