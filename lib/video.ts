export const VIDEO_ACCEPT =
  "video/mp4,video/webm,video/quicktime,video/x-matroska,video/matroska,.mp4,.webm,.mov,.m4v,.mkv";

const VIDEO_EXTENSION = /\.(mp4|webm|mov|m4v|mkv)$/i;
const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/x-matroska",
  "video/matroska",
]);

export type VideoProbeResult =
  | { ok: true; duration: number }
  | { ok: false; reason: "unsupported" | "timeout" | "metadata" };

type VideoFileIdentity = { name: string; type?: string };

export function isSupportedVideoFile(file: VideoFileIdentity): boolean {
  return VIDEO_EXTENSION.test(file.name) || (file.type ? VIDEO_MIME_TYPES.has(file.type) : false);
}

export function isMatroskaFile(file: VideoFileIdentity): boolean {
  return /\.mkv$/i.test(file.name) || file.type === "video/x-matroska" || file.type === "video/matroska";
}

/**
 * Ask the browser to decode the first frame before accepting a local file.
 * Accepting an MKV extension is not enough: Matroska can carry codecs the
 * current browser cannot decode (for example HEVC, AC-3, or DTS).
 */
export function probeVideoPlayback(file: File, timeoutMs = 10000): Promise<VideoProbeResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const finish = (result: VideoProbeResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.onloadeddata = null;
      video.oncanplay = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const timer = window.setTimeout(() => finish({ ok: false, reason: "timeout" }), timeoutMs);

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        finish({ ok: false, reason: "metadata" });
        return;
      }
      finish({ ok: true, duration: video.duration });
    };
    // Safari occasionally reaches canplay without firing loadeddata for a
    // local blob; treat a finite duration as a successful decode as well.
    video.oncanplay = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        finish({ ok: true, duration: video.duration });
      }
    };
    video.onerror = () => finish({ ok: false, reason: "unsupported" });
    video.src = url;
    video.load();
  });
}

export function videoProbeMessage(file: VideoFileIdentity, result: Extract<VideoProbeResult, { ok: false }>): string {
  if (result.reason === "timeout") {
    return "This browser took too long to read the video. Try a smaller file, or convert it to MP4 (H.264/AAC).";
  }
  if (isMatroskaFile(file)) {
    return "This MKV uses a codec this browser cannot decode. Chrome or Edge with H.264/AAC is the safest choice. You can also remux or convert it with: ffmpeg -i input.mkv -c:v libx264 -c:a aac output.mp4";
  }
  return "This browser cannot decode this video. Try an MP4 encoded with H.264 video and AAC audio.";
}
