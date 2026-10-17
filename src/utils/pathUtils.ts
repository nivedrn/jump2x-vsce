import * as path from 'path';

export function normalizeWorkspacePath(targetPath: string): string {
  return path.normalize(targetPath).replace(/[\\/]+$/, '');
}

export function sameWorkspacePath(a: string, b: string, platform: NodeJS.Platform = process.platform): boolean {
  if (platform === 'win32') {
    return normalizeWorkspacePath(a).toLowerCase() === normalizeWorkspacePath(b).toLowerCase();
  }

  return normalizeWorkspacePath(a) === normalizeWorkspacePath(b);
}

export function workspacePathKey(targetPath: string, platform: NodeJS.Platform = process.platform): string {
  const normalized = normalizeWorkspacePath(targetPath);
  return platform === 'win32' ? normalized.toLowerCase() : normalized;
}

// True when `childPath` is `parentPath` itself or nested anywhere inside it.
export function isSameOrInsidePath(childPath: string, parentPath: string, platform: NodeJS.Platform = process.platform): boolean {
  const childKey = workspacePathKey(childPath, platform);
  const parentKey = workspacePathKey(parentPath, platform);
  return childKey === parentKey || childKey.startsWith(parentKey + path.sep);
}
