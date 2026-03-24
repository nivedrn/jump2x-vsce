import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { WorkspaceTreeProvider } from './providers/workspaceTreeProvider';
import { DiscoveryService } from './services/discoveryService';
import { StorageManager } from './storage/storageManager';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storageManager = new StorageManager(context);
  const discoveryService = new DiscoveryService();
  const provider = new WorkspaceTreeProvider(storageManager, discoveryService);

  const treeView = vscode.window.createTreeView('snap2x.workspaceExplorer', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  registerCommands(context, storageManager, provider, discoveryService);

  context.subscriptions.push(
    treeView,
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (
        event.affectsConfiguration('snap2x.workspacesDirectory') ||
        event.affectsConfiguration('snap2x.recursiveScan') ||
        event.affectsConfiguration('snap2x.includeCodeWorkspaceFiles')
      ) {
        await provider.refresh();
      }
    })
  );

  const pruned = await storageManager.clearMissingFavorites();
  if (pruned > 0) {
    vscode.window.setStatusBarMessage(`Snap2x removed ${pruned} missing favorite(s).`, 3000);
  }

  await provider.refresh();
}

export function deactivate(): void {
  // No-op.
}
