import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadence — Learn English in context",
  description:
    "An interactive, video-based English learning studio. Karaoke subtitles, contextual vocabulary, and dictation built around the original voice.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
