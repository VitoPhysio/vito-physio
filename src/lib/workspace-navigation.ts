const workspacePaths = ["/dashboard", "/cases", "/admin"];

/** Community navigation belongs outside the staff workspace, including nested pages. */
export function isWorkspacePath(pathname: string): boolean {
  return workspacePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}