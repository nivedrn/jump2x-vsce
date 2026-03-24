import * as vscode from 'vscode';
import { WorkspaceTreeProvider } from '../providers/workspaceTreeProvider';

export async function refresh(provider: WorkspaceTreeProvider): Promise<void> {
  await provider.refresh();
  const warning = provider.getWarningMessage();
  if (warning) {
    vscode.window.showWarningMessage(warning);
    return;
  }

  vscode.window.setStatusBarMessage('ContextSnap workspaces refreshed.', 2000);
}
