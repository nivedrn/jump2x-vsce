import * as path from 'path';
import * as vscode from 'vscode';
import { WorkspaceTreeItem, WorkspaceTreeProvider } from '../providers/workspaceTreeProvider';
import { StorageManager } from '../storage/storageManager';

function resolveWorkspaceToAdd(target?: WorkspaceTreeItem): vscode.Uri | undefined {
  if (target?.node.uri) {
    return target.node.uri;
  }

  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri;
  }

  return undefined;
}

export async function addCurrentWorkspace(
  storageManager: StorageManager,
  provider: WorkspaceTreeProvider,
  target?: WorkspaceTreeItem
): Promise<void> {
  const workspaceUri = resolveWorkspaceToAdd(target);

  if (!workspaceUri) {
    vscode.window.showWarningMessage('No folder workspace is open in the current window.');
    return;
  }

  const label = path.basename(workspaceUri.fsPath) || workspaceUri.fsPath;
  const result = await storageManager.addFavorite(workspaceUri, label);

  if (!result.added) {
    vscode.window.showInformationMessage(result.reason ?? 'Workspace is already in favorites.');
    return;
  }

  await provider.refresh();
  vscode.window.showInformationMessage(`Added to favorites: ${label}`);
}
