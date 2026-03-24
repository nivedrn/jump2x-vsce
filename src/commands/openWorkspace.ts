import * as vscode from 'vscode';
import { WorkspaceTreeItem } from '../providers/workspaceTreeProvider';

async function targetExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function openWorkspace(
  target: WorkspaceTreeItem
): Promise<void> {
  const targetUri = target?.node.uri;
  const targetLabel = target?.node.label;

  if (!targetUri) {
    return;
  }

  const exists = await targetExists(targetUri);
  if (!exists) {
    vscode.window.showWarningMessage(`Workspace path is missing: ${target.node.path ?? targetLabel}`);
    return;
  }

  // Always open in new window
  await vscode.commands.executeCommand('vscode.openFolder', targetUri, { forceNewWindow: true });
}
