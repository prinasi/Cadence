import { describe, expect, it, afterEach } from "vitest";
import { withBasePath } from "@/lib/paths";

describe("withBasePath", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    process.env.NEXT_PUBLIC_BASE_PATH = originalEnv;
  });

  it("returns unchanged path when no base path is set", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(withBasePath("/demo/small-habits.mp4")).toBe("/demo/small-habits.mp4");
    expect(withBasePath("")).toBe("");
    expect(withBasePath(undefined)).toBe("");
  });

  it("prefixes path with base path when configured", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/Cadence";
    expect(withBasePath("/demo/small-habits.mp4")).toBe("/Cadence/demo/small-habits.mp4");
    expect(withBasePath("demo/small-habits.jpg")).toBe("/Cadence/demo/small-habits.jpg");
  });

  it("does not modify blob or external URLs", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/Cadence";
    expect(withBasePath("blob:http://localhost:3000/12345")).toBe("blob:http://localhost:3000/12345");
    expect(withBasePath("https://example.com/video.mp4")).toBe("https://example.com/video.mp4");
    expect(withBasePath("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
  });
});
