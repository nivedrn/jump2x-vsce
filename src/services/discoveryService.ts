import * as path from 'path';
import * as vscode from 'vscode';
import { Snap2xSettings, DiscoveredWorkspace } from '../types';
import { isCodeWorkspaceFile, isGitRepository, isIgnoredDirectory, shouldTraverseDirectory } from '../utils/discoveryUtils';
import { workspacePathKey } from '../utils/pathUtils';

interface DirectoryQueueItem {
  uri: vscode.Uri;
  depth: number;
}

export class DiscoveryService {
  public getSettings(): Snap2xSettings {
    const config = vscode.workspace.getConfiguration('snap2x');
    return {
      workspacesDirectory: config.get<string>('workspacesDirectory', '').trim(),
      recursiveScan: config.get<boolean>('recursiveScan', true),
      includeCodeWorkspaceFiles: config.get<boolean>('includeCodeWorkspaceFiles', true),
    };
  }

  public async discoverWorkspaces(): Promise<{ items: DiscoveredWorkspace[]; warning?: string }> {
    const settings = this.getSettings();

    if (!settings.workspacesDirectory) {
      return { items: [] };
    }

    const root = vscode.Uri.file(settings.workspacesDirectory);
    const rootExists = await this.pathExists(root);
    if (!rootExists) {
      return {
        items: [],
        warning: `Configured path does not exist: ${settings.workspacesDirectory}`,
      };
    }

    const dedup = new Map<string, DiscoveredWorkspace>();
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
      if (current.depth > 0 && isGitRepository(entries)) {
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
          if (shouldTraverseDirectory(current.depth, settings.recursiveScan) && !isIgnoredDirectory(name)) {
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

    const items = Array.from(dedup.values()).sort((a, b) => a.label.localeCompare(b.label));
    return { items };
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
}
