import * as path from 'path';

// Path rules for the given platform, so Windows paths are handled correctly even
// when the code runs elsewhere (as in the unit tests).
function pathFor(platform: NodeJS.Platform): path.PlatformPath {
  return platform === 'win32' ? path.win32 : path.posix;
}

export function normalizeWorkspacePath(targetPath: string, platform: NodeJS.Platform = process.platform): string {
  return pathFor(platform).normalize(targetPath).replace(/[\\/]+$/, '');
}

export function sameWorkspacePath(a: string, b: string, platform: NodeJS.Platform = process.platform): boolean {
  return workspacePathKey(a, platform) === workspacePathKey(b, platform);
}

export function workspacePathKey(targetPath: string, platform: NodeJS.Platform = process.platform): string {
  const normalized = normalizeWorkspacePath(targetPath, platform);
  return platform === 'win32' ? normalized.toLowerCase() : normalized;
}

// True when `childPath` is `parentPath` itself or nested anywhere inside it.
export function isSameOrInsidePath(childPath: string, parentPath: string, platform: NodeJS.Platform = process.platform): boolean {
  const childKey = workspacePathKey(childPath, platform);
  const parentKey = workspacePathKey(parentPath, platform);
  return childKey === parentKey || childKey.startsWith(parentKey + pathFor(platform).sep);
}
