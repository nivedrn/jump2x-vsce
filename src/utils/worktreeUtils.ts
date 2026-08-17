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

function runGit(cwd: string, args: string[]): Promise<string> {
    return new Promise((resolve) => {
        execFile('git', args, { cwd, timeout: 5000, windowsHide: true }, (error, stdout) => {
            resolve(error ? '' : stdout);
        });
    });
}
