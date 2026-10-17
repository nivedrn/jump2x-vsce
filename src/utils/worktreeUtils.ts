import { execFile } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { WorktreeInfo } from '../types';
import { workspacePathKey } from './pathUtils';

// Parses `git worktree list --porcelain` output, excluding the repo's own
// main worktree and any bare entry.
export function parseWorktrees(porcelain: string, repoPath: string): WorktreeInfo[] {
    const repoKey = workspacePathKey(repoPath);
    const result: WorktreeInfo[] = [];

    for (const block of porcelain.split(/\r?\n\r?\n/)) {
        const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        let worktreePath: string | undefined;
        let branch: string | undefined;
        let bare = false;

        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                worktreePath = line.slice('worktree '.length).trim();
            } else if (line.startsWith('branch ')) {
                branch = line.slice('branch '.length).replace('refs/heads/', '').trim();
            } else if (line === 'bare') {
                bare = true;
            } else if (line === 'detached') {
                branch = undefined;
            }
        }

        if (!worktreePath || bare) {
            continue;
        }

        const normalized = path.normalize(worktreePath);
        if (workspacePathKey(normalized) === repoKey) {
            continue;
        }

        result.push({
            path: normalized,
            uri: vscode.Uri.file(normalized).toString(),
            label: branch || path.basename(normalized),
            branch,
        });
    }

    return result;
}

export async function getWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    const output = await runGit(repoPath, ['worktree', 'list', '--porcelain']);
    if (!output) {
        return [];
    }

    return parseWorktrees(output, repoPath);
}

// Returns the `git status --porcelain` lines for a worktree: modified, staged
// and untracked files. Ignored files (e.g. node_modules) are not listed.
export async function getWorktreeChanges(worktreePath: string): Promise<string[]> {
    const output = await execGit(worktreePath, ['status', '--porcelain'], 30000);
    return output.split(/\r?\n/).filter(Boolean);
}

// Runs from the parent repo so no process holds the worktree folder open
// (Windows cannot delete a process's working directory). Without --force, git
// itself refuses dirty, locked and main worktrees.
export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
    // No timeout: killing git mid-delete would leave a half-removed worktree.
    await execGit(repoPath, ['worktree', 'remove', worktreePath], 0);
}

function runGit(cwd: string, args: string[]): Promise<string> {
    return execGit(cwd, args).catch(() => '');
}

function execGit(cwd: string, args: string[], timeout = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd, timeout, windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr.trim() || error.message));
                return;
            }
            resolve(stdout);
        });
    });
}
