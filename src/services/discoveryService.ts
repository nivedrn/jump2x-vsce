import * as path from 'path';
import * as vscode from 'vscode';
import { Jump2xSettings, DiscoveredWorkspace } from '../types';
import { isCodeWorkspaceFile, isGitRepository, isIgnoredDirectory, shouldTraverseDirectory } from '../utils/discoveryUtils';
import { workspacePathKey } from '../utils/pathUtils';

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
      includeCodeWorkspaceFiles: config.get<boolean>('includeCodeWorkspaceFiles', true),
    };
  }

  public async discoverWorkspaces(): Promise<{ items: DiscoveredWorkspace[]; warning?: string }> {
    const settings = this.getSettings();

    if (settings.workspacesDirectories.length === 0) {
      return { items: [] };
    }

    const dedup = new Map<string, DiscoveredWorkspace>();
    const excludedKeys = new Set(settings.excludedDirectories.map((d) => workspacePathKey(d)));
    const warnings: string[] = [];

    for (const rootPath of settings.workspacesDirectories) {
      const root = vscode.Uri.file(rootPath);
      if (!(await this.pathExists(root))) {
        warnings.push(`Configured path does not exist: ${rootPath}`);
        continue;
      }
      await this.scanRoot(root, settings, dedup, excludedKeys);
    }

    const items = Array.from(dedup.values()).sort((a, b) => a.label.localeCompare(b.label));
    return { items, warning: warnings.length > 0 ? warnings.join('\n') : undefined };
  }

  private async scanRoot(
    root: vscode.Uri,
    settings: Jump2xSettings,
    dedup: Map<string, DiscoveredWorkspace>,
    excludedKeys: Set<string>
  ): Promise<void> {
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

      // Check if current directory is a git repository
      const isCurrentGitRepo = current.depth > 0 && isGitRepository(entries);
      if (isCurrentGitRepo) {
        const folderName = current.uri.fsPath.split(path.sep).pop() || '';
        this.upsertDiscovered(dedup, {
          path: path.normalize(current.uri.fsPath),
          uri: current.uri.toString(),
          label: folderName,
          isCodeWorkspaceFile: false,
        });
      }

      for (const [name, fileType] of entries) {
        const childUri = vscode.Uri.joinPath(current.uri, name);
        const childPath = path.normalize(childUri.fsPath);

        if (fileType === vscode.FileType.Directory) {
          if (
            !isCurrentGitRepo &&
            shouldTraverseDirectory(current.depth, settings.recursiveScan, settings.maxScanDepth) &&
            !isIgnoredDirectory(name) &&
            !excludedKeys.has(workspacePathKey(childPath))
          ) {
            queue.push({ uri: childUri, depth: current.depth + 1 });
          }
        }

        if (
          fileType === vscode.FileType.File &&
          settings.includeCodeWorkspaceFiles &&
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
}
