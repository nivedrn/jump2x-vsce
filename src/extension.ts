import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { WorkspaceTreeProvider } from './providers/workspaceTreeProvider';
import { DiscoveryService } from './services/discoveryService';
import { StorageManager } from './storage/storageManager';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storageManager = new StorageManager(context);
  const discoveryService = new DiscoveryService();
  const provider = new WorkspaceTreeProvider(storageManager, discoveryService);

  const treeView = vscode.window.createTreeView('jump2x.workspaceExplorer', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  registerCommands(context, storageManager, provider, discoveryService);

  context.subscriptions.push(
    treeView,
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (
        event.affectsConfiguration('jump2x.workspacesDirectories') ||
        event.affectsConfiguration('jump2x.excludedDirectories') ||
        event.affectsConfiguration('jump2x.recursiveScan') ||
        event.affectsConfiguration('jump2x.maxScanDepth') ||
        event.affectsConfiguration('jump2x.includeCodeWorkspaceFiles')
      ) {
        await provider.refresh();
      }
    })
  );

  const pruned = await storageManager.clearMissingFavorites();
  if (pruned > 0) {
    vscode.window.setStatusBarMessage(`Jump2X removed ${pruned} missing favorite(s).`, 3000);
  }

  await provider.refresh();
}

export function deactivate(): void {
  // No-op.
}
