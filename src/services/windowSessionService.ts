import * as path from 'path';
import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { sameWorkspacePath } from '../utils/pathUtils';

interface SessionWorkspace {
  path: string;
  uri: string;
  label: string;
}

interface SessionRecord {
  sessionId: string;
  workspace?: SessionWorkspace;
  updatedAt: number;
}

export interface ActiveWindowSession {
  sessionId: string;
  workspacePath?: string;
  workspaceLabel?: string;
  updatedAt: number;
}

export class WindowSessionService implements vscode.Disposable {
  private readonly context: vscode.ExtensionContext;
  private readonly sessionId: string;
  private readonly heartbeatMs: number;
  private readonly staleAfterMs: number;
  private heartbeatHandle: NodeJS.Timeout | undefined;

  constructor(context: vscode.ExtensionContext, heartbeatMs = 15000, staleAfterMs = 45000) {
    this.context = context;
    this.sessionId = randomUUID();
    this.heartbeatMs = heartbeatMs;
    this.staleAfterMs = staleAfterMs;
  }

  public async start(): Promise<void> {
    await this.ensureSessionsDirectory();
    await this.writeHeartbeat();
    this.heartbeatHandle = setInterval(() => {
      void this.writeHeartbeat();
    }, this.heartbeatMs);
  }

  public async writeHeartbeat(): Promise<void> {
    const record: SessionRecord = {
      sessionId: this.sessionId,
      workspace: this.getCurrentWorkspace(),
      updatedAt: Date.now(),
    };

    await this.ensureSessionsDirectory();
    const target = this.sessionFileUri(this.sessionId);
    const payload = Buffer.from(JSON.stringify(record), 'utf8');
    await vscode.workspace.fs.writeFile(target, payload);
  }

  public async findActiveSessionsForPath(targetPath: string): Promise<ActiveWindowSession[]> {
    const sessions = await this.readLiveSessions();
    return sessions.filter(
      (session) =>
        session.sessionId !== this.sessionId &&
        typeof session.workspacePath === 'string' &&
        sameWorkspacePath(session.workspacePath, targetPath)
    );
  }

  public async dispose(): Promise<void> {
    if (this.heartbeatHandle) {
      clearInterval(this.heartbeatHandle);
      this.heartbeatHandle = undefined;
    }

    try {
      await vscode.workspace.fs.delete(this.sessionFileUri(this.sessionId));
    } catch {
      // Session files are best-effort metadata.
    }
  }

  private getSessionsDirectory(): vscode.Uri {
    return vscode.Uri.joinPath(this.context.globalStorageUri, 'active-sessions');
  }

  private sessionFileUri(sessionId: string): vscode.Uri {
    return vscode.Uri.joinPath(this.getSessionsDirectory(), `${sessionId}.json`);
  }

  private async ensureSessionsDirectory(): Promise<void> {
    try {
      await vscode.workspace.fs.createDirectory(this.getSessionsDirectory());
    } catch {
      // createDirectory is safe to call repeatedly; ignore race/errors.
    }
  }

  private getCurrentWorkspace(): SessionWorkspace | undefined {
    if (vscode.workspace.workspaceFile) {
      const file = vscode.workspace.workspaceFile;
      return {
        path: file.fsPath,
        uri: file.toString(),
        label: path.basename(file.fsPath),
      };
    }

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }

    const primary = folders[0];
    return {
      path: primary.uri.fsPath,
      uri: primary.uri.toString(),
      label: primary.name,
    };
  }

  private async readLiveSessions(): Promise<ActiveWindowSession[]> {
    const now = Date.now();
    const live: ActiveWindowSession[] = [];

    let entries: [string, vscode.FileType][] = [];
    try {
      entries = await vscode.workspace.fs.readDirectory(this.getSessionsDirectory());
    } catch {
      return [];
    }

    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File || !name.endsWith('.json')) {
        continue;
      }

      const fileUri = vscode.Uri.joinPath(this.getSessionsDirectory(), name);
      const parsed = await this.readSession(fileUri);
      if (!parsed) {
        await this.safeDelete(fileUri);
        continue;
      }

      if (now - parsed.updatedAt > this.staleAfterMs) {
        await this.safeDelete(fileUri);
        continue;
      }

      live.push({
        sessionId: parsed.sessionId,
        workspacePath: parsed.workspace?.path,
        workspaceLabel: parsed.workspace?.label,
        updatedAt: parsed.updatedAt,
      });
    }

    return live;
  }

  private async readSession(fileUri: vscode.Uri): Promise<SessionRecord | undefined> {
    try {
      const raw = await vscode.workspace.fs.readFile(fileUri);
      const decoded = Buffer.from(raw).toString('utf8');
      const parsed = JSON.parse(decoded) as SessionRecord;
      if (typeof parsed?.sessionId !== 'string' || typeof parsed?.updatedAt !== 'number') {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }

  private async safeDelete(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.delete(uri);
    } catch {
      // ignore cleanup failures
    }
  }
}