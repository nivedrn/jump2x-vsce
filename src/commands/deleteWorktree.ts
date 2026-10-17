import * as vscode from 'vscode';
import { WorkspaceTreeItem, WorkspaceTreeProvider } from '../providers/workspaceTreeProvider';
import { isSameOrInsidePath } from '../utils/pathUtils';
import { getWorktreeChanges, removeWorktree } from '../utils/worktreeUtils';

// The current window "is in" the worktree when one of its folders (or its
// .code-workspace file) is the worktree or lives inside it.
function isOpenInCurrentWindow(worktreePath: string): boolean {
  const openPaths = (vscode.workspace.workspaceFolders ?? [])
    .filter((folder) => folder.uri.scheme === 'file')
    .map((folder) => folder.uri.fsPath);
  const workspaceFile = vscode.workspace.workspaceFile;
  if (workspaceFile?.scheme === 'file') {
    openPaths.push(workspaceFile.fsPath);
  }
  return openPaths.some((openPath) => isSameOrInsidePath(openPath, worktreePath));
}

async function folderExists(folderPath: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(folderPath));
    return true;
  } catch {
    return false;
  }
}

// Deletes a git worktree after confirmation. Refuses when the worktree is open
// in this window or has uncommitted/untracked changes. The branch is kept.
// Returns true when the worktree was removed.
export async function confirmAndDeleteWorktree(repoPath: string, worktreePath: string, label: string): Promise<boolean> {
  if (isOpenInCurrentWindow(worktreePath)) {
    vscode.window.showWarningMessage(`Cannot delete worktree "${label}": it is open in this window.`);
    return false;
  }

  // A worktree whose folder is already gone has nothing to lose; git just
  // drops its registration.
  if (await folderExists(worktreePath)) {
    let changes: string[];
    try {
      changes = await getWorktreeChanges(worktreePath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Cannot delete worktree "${label}": failed to check for changes. ${message}`);
      return false;
    }

    if (changes.length > 0) {
      vscode.window.showWarningMessage(
        `Cannot delete worktree "${label}": it has ${changes.length} uncommitted or untracked change(s). Commit, stash or discard them first.`
      );
      return false;
    }
  }

  const choice = await vscode.window.showWarningMessage(
    `Delete worktree "${label}"?`,
    { modal: true, detail: `${worktreePath}\n\nThe worktree folder is deleted, including ignored files. The branch is kept.` },
    'Delete'
  );
  if (choice !== 'Delete') {
    return false;
  }

  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Deleting worktree "${label}"...` },
      () => removeWorktree(repoPath, worktreePath)
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to delete worktree "${label}": ${message}`);
    return false;
  }

  vscode.window.showInformationMessage(`Deleted worktree: ${label}`);
  return true;
}

export async function deleteWorktree(
  provider: WorkspaceTreeProvider,
  target: WorkspaceTreeItem
): Promise<void> {
  if (!target?.node.path || !target.node.repoPath) {
    return;
  }

  const deleted = await confirmAndDeleteWorktree(target.node.repoPath, target.node.path, String(target.node.label));
  if (deleted) {
    await provider.refresh();
  }
}
