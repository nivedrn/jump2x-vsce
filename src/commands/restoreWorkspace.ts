import { WorkspaceTreeItem, WorkspaceTreeProvider } from '../providers/workspaceTreeProvider';
import { StorageManager } from '../storage/storageManager';

export async function restoreWorkspace(
  storageManager: StorageManager,
  provider: WorkspaceTreeProvider,
  target: WorkspaceTreeItem
): Promise<void> {
  if (!target?.node.path) {
    return;
  }

  await storageManager.restoreWorkspace(target.node.path);
  await provider.refresh();
}
