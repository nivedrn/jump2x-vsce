import * as vscode from 'vscode';
import { addCurrentWorkspace } from './addCurrentWorkspace';
import { openWorkspace } from './openWorkspace';
import { quickOpenWorkspace } from './quickOpenWorkspace';
import { removeFavorite } from './removeFavorite';
import { refresh } from './refresh';
import { WorkspaceTreeItem, WorkspaceTreeProvider } from '../providers/workspaceTreeProvider';
import { DiscoveryService } from '../services/discoveryService';
import { StorageManager } from '../storage/storageManager';

export function registerCommands(
  context: vscode.ExtensionContext,
  storageManager: StorageManager,
  provider: WorkspaceTreeProvider,
  discoveryService: DiscoveryService
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('snap2x.addCurrentWorkspace', async (target?: WorkspaceTreeItem) => {
      await addCurrentWorkspace(storageManager, provider, target);
    }),
    vscode.commands.registerCommand('snap2x.openWorkspace', async (target?: WorkspaceTreeItem) => {
      if (!target) {
        return;
      }
      await openWorkspace(target);
    }),
    vscode.commands.registerCommand('snap2x.removeFavorite', async (target?: WorkspaceTreeItem) => {
      if (!target) {
        return;
      }
      await removeFavorite(storageManager, provider, target);
    }),
    vscode.commands.registerCommand('snap2x.refreshWorkspaces', async () => {
      await refresh(provider);
    }),
    vscode.commands.registerCommand('snap2x.openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'snap2x.workspacesDirectory');
    }),
    vscode.commands.registerCommand('snap2x.quickOpenWorkspace', async () => {
      await quickOpenWorkspace(storageManager, discoveryService);
    })
  );
}
