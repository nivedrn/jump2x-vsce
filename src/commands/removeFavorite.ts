import * as vscode from 'vscode';
import { WorkspaceTreeItem, WorkspaceTreeProvider } from '../providers/workspaceTreeProvider';
import { StorageManager } from '../storage/storageManager';

export async function removeFavorite(
  storageManager: StorageManager,
  provider: WorkspaceTreeProvider,
  target: WorkspaceTreeItem
): Promise<void> {
  if (!target?.node.path) {
    return;
  }

  const removed = await storageManager.removeFavorite(target.node.path);
  if (!removed) {
    vscode.window.showInformationMessage('Favorite was not found.');
    return;
  }

  await provider.refresh();
  vscode.window.showInformationMessage(`Removed favorite: ${target.node.label}`);
}
