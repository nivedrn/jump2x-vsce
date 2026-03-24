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

export function shouldTraverseDirectory(depth: number, recursiveScan: boolean): boolean {
  if (recursiveScan) {
    return true;
  }

  return depth === 0;
}
