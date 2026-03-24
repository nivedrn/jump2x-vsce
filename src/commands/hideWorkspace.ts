import { WorkspaceTreeItem, WorkspaceTreeProvider } from '../providers/workspaceTreeProvider';
import { StorageManager } from '../storage/storageManager';

export async function hideWorkspace(
  storageManager: StorageManager,
  provider: WorkspaceTreeProvider,
  target: WorkspaceTreeItem
): Promise<void> {
  if (!target?.node.path || !target?.node.uri) {
    return;
  }

  await storageManager.hideWorkspace({
    path: target.node.path,
    uri: target.node.uri.toString(),
    label: String(target.node.label),
  });

  await provider.refresh();
}
