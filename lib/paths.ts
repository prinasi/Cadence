/**
 * Resolves a public asset path against the runtime base path (e.g. for GitHub Pages subpath).
 */
export function withBasePath(path?: string): string {
  if (!path) return "";
  if (
    path.startsWith("blob:") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (!basePath) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${cleanPath}`;
}
