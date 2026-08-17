import * as path from 'path';
import * as vscode from 'vscode';
import { Jump2xSettings, DiscoveredWorkspace, WorktreeInfo } from '../types';
import { directoryHasMarker, isCodeWorkspaceFile, isGitRepository, isIgnoredDirectory, shouldTraverseDirectory } from '../utils/discoveryUtils';
import { workspacePathKey } from '../utils/pathUtils';
import { getWorktrees } from '../utils/worktreeUtils';

interface DirectoryQueueItem {
  uri: vscode.Uri;
  depth: number;
}

export class DiscoveryService {
  public getSettings(): Jump2xSettings {
    const config = vscode.workspace.getConfiguration('jump2x');

    const workspacesDirectories = config
      .get<string[]>('workspacesDirectories', [])
      .map((d) => d.trim())
      .filter(Boolean);

    return {
      workspacesDirectories,
      excludedDirectories: config
        .get<string[]>('excludedDirectories', [])
        .map((d) => d.trim())
        .filter(Boolean),
      recursiveScan: config.get<boolean>('recursiveScan', true),
      maxScanDepth: this.normalizeMaxScanDepth(config.get<number>('maxScanDepth', -1)),
      workspaceMarkers: this.normalizeMarkers(config.get<string[]>('workspaceMarkers', ['.git', '.code-workspace'])),
      includeWorktrees: config.get<boolean>('includeWorktrees', true),
    };
  }

  public async discoverWorkspaces(): Promise<{ items: DiscoveredWorkspace[]; warning?: string }> {
    const settings = this.getSettings();

    if (settings.workspacesDirectories.length === 0) {
      return { items: [] };
    }

    const dedup = new Map<string, DiscoveredWorkspace>();
    const excludedKeys = new Set(settings.excludedDirectories.map((d) => workspacePathKey(d)));
    const gitRepoKeys = new Set<string>();
    const warnings: string[] = [];

    for (const rootPath of settings.workspacesDirectories) {
      const root = vscode.Uri.file(rootPath);
      if (!(await this.pathExists(root))) {
        warnings.push(`Configured path does not exist: ${rootPath}`);
        continue;
      }
      await this.scanRoot(root, settings, dedup, excludedKeys, gitRepoKeys);
    }

    if (settings.includeWorktrees) {
      await this.attachWorktrees(dedup, gitRepoKeys);
    }

    const items = Array.from(dedup.values()).sort((a, b) => a.label.localeCompare(b.label));
    return { items, warning: warnings.length > 0 ? warnings.join('\n') : undefined };
  }

  public getWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    return getWorktrees(repoPath);
  }

  // Attaches git worktrees to each discovered repo and removes any worktree
  // path that was independently discovered as its own top-level entry.
  private async attachWorktrees(dedup: Map<string, DiscoveredWorkspace>, gitRepoKeys: Set<string>): Promise<void> {
    const repos = Array.from(dedup.values()).filter((item) => gitRepoKeys.has(workspacePathKey(item.path)));

    await Promise.all(
      repos.map(async (repo) => {
        const worktrees = await getWorktrees(repo.path);
        if (worktrees.length > 0) {
          repo.worktrees = worktrees;
        }
      })
    );

    for (const repo of repos) {
      for (const worktree of repo.worktrees ?? []) {
        dedup.delete(workspacePathKey(worktree.path));
      }
    }
  }

  private async scanRoot(
    root: vscode.Uri,
    settings: Jump2xSettings,
    dedup: Map<string, DiscoveredWorkspace>,
    excludedKeys: Set<string>,
    gitRepoKeys: Set<string>
  ): Promise<void> {
    const directoryMarkers = settings.workspaceMarkers.filter((marker) => marker !== '.code-workspace');
    const includeCodeWorkspace = settings.workspaceMarkers.includes('.code-workspace');
    const queue: DirectoryQueueItem[] = [{ uri: root, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      let entries: [string, vscode.FileType][] = [];
      try {
        entries = await vscode.workspace.fs.readDirectory(current.uri);
      } catch {
        continue;
      }

      // Check if current directory matches a configured workspace marker.
      const isCurrentWorkspace = current.depth > 0 && directoryHasMarker(entries, directoryMarkers);
      if (isCurrentWorkspace) {
        const folderName = current.uri.fsPath.split(path.sep).pop() || '';
        const normalizedPath = path.normalize(current.uri.fsPath);
        this.upsertDiscovered(dedup, {
          path: normalizedPath,
          uri: current.uri.toString(),
          label: folderName,
          isCodeWorkspaceFile: false,
        });
        if (isGitRepository(entries)) {
          gitRepoKeys.add(workspacePathKey(normalizedPath));
        }
      }

      for (const [name, fileType] of entries) {
        const childUri = vscode.Uri.joinPath(current.uri, name);
        const childPath = path.normalize(childUri.fsPath);

        if (fileType === vscode.FileType.Directory) {
          if (
            !isCurrentWorkspace &&
            shouldTraverseDirectory(current.depth, settings.recursiveScan, settings.maxScanDepth) &&
            !isIgnoredDirectory(name) &&
            !excludedKeys.has(workspacePathKey(childPath))
          ) {
            queue.push({ uri: childUri, depth: current.depth + 1 });
          }
        }

        if (
          fileType === vscode.FileType.File &&
          includeCodeWorkspace &&
          isCodeWorkspaceFile(name)
        ) {
          this.upsertDiscovered(dedup, {
            path: childPath,
            uri: childUri.toString(),
            label: name,
            isCodeWorkspaceFile: true,
          });
        }
      }
    }
  }

  private upsertDiscovered(map: Map<string, DiscoveredWorkspace>, item: DiscoveredWorkspace): void {
    const key = workspacePathKey(item.path);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  private async pathExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  private normalizeMaxScanDepth(value: number): number {
    if (!Number.isFinite(value)) {
      return -1;
    }

    return Math.floor(value);
  }

  private normalizeMarkers(markers: string[]): string[] {
    if (!Array.isArray(markers)) {
      return [];
    }
    return Array.from(new Set(markers.map((marker) => marker.trim()).filter(Boolean)));
  }
}
