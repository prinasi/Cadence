import { describe, expect, it } from "vitest";
import {
  isMatroskaFile,
  isSupportedVideoFile,
  VIDEO_ACCEPT,
  videoProbeMessage,
} from "@/lib/video";

describe("video file formats", () => {
  it("accepts MKV by extension, including uppercase names", () => {
    expect(isSupportedVideoFile({ name: "lecture.mkv", type: "" })).toBe(true);
    expect(isSupportedVideoFile({ name: "LECTURE.MKV", type: "application/octet-stream" })).toBe(true);
  });

  it("accepts MKV by Matroska MIME type when the extension is missing", () => {
    expect(isSupportedVideoFile({ name: "capture", type: "video/x-matroska" })).toBe(true);
    expect(isMatroskaFile({ name: "capture", type: "video/matroska" })).toBe(true);
  });

  it("still accepts the existing MP4/WebM/MOV/M4V formats", () => {
    for (const name of ["lesson.mp4", "lesson.webm", "lesson.mov", "lesson.m4v"]) {
      expect(isSupportedVideoFile({ name, type: "" })).toBe(true);
    }
  });

  it("rejects unrelated files", () => {
    expect(isSupportedVideoFile({ name: "notes.txt", type: "text/plain" })).toBe(false);
    expect(isSupportedVideoFile({ name: "lesson.avi", type: "video/x-msvideo" })).toBe(false);
  });

  it("advertises MKV in the file input accept list", () => {
    expect(VIDEO_ACCEPT).toContain(".mkv");
    expect(VIDEO_ACCEPT).toContain("video/x-matroska");
  });

  it("explains unsupported MKV playback with a conversion command", () => {
    const message = videoProbeMessage(
      { name: "lecture.mkv", type: "video/x-matroska" },
      { ok: false, reason: "unsupported" },
    );
    expect(message).toContain("MKV");
    expect(message).toContain("ffmpeg");
  });
});
