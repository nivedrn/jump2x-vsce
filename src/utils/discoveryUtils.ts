import * as vscode from 'vscode';

export function isCodeWorkspaceFile(name: string): boolean {
  return name.toLowerCase().endsWith('.code-workspace');
}

export function isGitRepository(entries: [string, vscode.FileType][]): boolean {
  return entries.some(([name]) => name === '.git');
}

export function isIgnoredDirectory(name: string): boolean {
  const ignored = new Set(['.git', '.svn', 'node_modules', '.hg']);
  return ignored.has(name);
}

export function shouldTraverseDirectory(depth: number, recursiveScan: boolean, maxScanDepth: number): boolean {
  if (recursiveScan) {
    // -1 means unlimited depth.
    if (maxScanDepth < 0) {
      return true;
    }

    // depth represents current folder depth from scan root.
    // Traverse to children only while current depth is less than the configured max.
    return depth < maxScanDepth;
  }

  return depth === 0;
}
