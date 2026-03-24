import * as path from 'path';
import * as vscode from 'vscode';
import { FAVORITES_STORAGE_KEY, HIDDEN_STORAGE_KEY, FavoriteWorkspace, HiddenWorkspace } from '../types';
import { normalizeWorkspacePath, sameWorkspacePath } from '../utils/pathUtils';

export class StorageManager {
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public getFavorites(): FavoriteWorkspace[] {
    const stored = this.context.globalState.get<FavoriteWorkspace[]>(FAVORITES_STORAGE_KEY, []);
    if (!Array.isArray(stored)) {
      return [];
    }

    return stored
      .filter((entry) => typeof entry?.path === 'string' && typeof entry?.uri === 'string')
      .map((entry) => ({
        path: normalizeWorkspacePath(entry.path),
        uri: entry.uri,
        label: entry.label || path.basename(entry.path) || entry.path,
        addedAt: typeof entry.addedAt === 'number' ? entry.addedAt : Date.now(),
      }));
  }

  public async addFavorite(workspaceUri: vscode.Uri, customLabel?: string): Promise<{ added: boolean; reason?: string }> {
    const normalized = normalizeWorkspacePath(workspaceUri.fsPath);
    const favorites = this.getFavorites();

    if (favorites.some((favorite) => sameWorkspacePath(favorite.path, normalized))) {
      return { added: false, reason: 'This workspace is already in favorites.' };
    }

    const label = customLabel?.trim() || path.basename(normalized) || normalized;
    const entry: FavoriteWorkspace = {
      path: normalized,
      uri: workspaceUri.toString(),
      label,
      addedAt: Date.now(),
    };

    favorites.push(entry);
    await this.context.globalState.update(FAVORITES_STORAGE_KEY, favorites);
    return { added: true };
  }

  public async removeFavorite(workspacePath: string): Promise<boolean> {
    const normalized = normalizeWorkspacePath(workspacePath);
    const favorites = this.getFavorites();
    const filtered = favorites.filter((favorite) => !sameWorkspacePath(favorite.path, normalized));

    if (filtered.length === favorites.length) {
      return false;
    }

    await this.context.globalState.update(FAVORITES_STORAGE_KEY, filtered);
    return true;
  }

  public async clearMissingFavorites(): Promise<number> {
    const favorites = this.getFavorites();
    const existing = await Promise.all(
      favorites.map(async (favorite) => ({
        favorite,
        exists: await this.workspaceExists(vscode.Uri.file(favorite.path)),
      }))
    );

    const kept = existing.filter((entry) => entry.exists).map((entry) => entry.favorite);
    const removedCount = favorites.length - kept.length;

    if (removedCount > 0) {
      await this.context.globalState.update(FAVORITES_STORAGE_KEY, kept);
    }

    return removedCount;
  }

  public getHidden(): HiddenWorkspace[] {
    const stored = this.context.globalState.get<HiddenWorkspace[]>(HIDDEN_STORAGE_KEY, []);
    if (!Array.isArray(stored)) {
      return [];
    }

    return stored
      .filter((entry) => typeof entry?.path === 'string' && typeof entry?.uri === 'string')
      .map((entry) => ({
        path: normalizeWorkspacePath(entry.path),
        uri: entry.uri,
        label: entry.label || path.basename(entry.path) || entry.path,
      }));
  }

  public async hideWorkspace(item: HiddenWorkspace): Promise<void> {
    const normalized = normalizeWorkspacePath(item.path);
    const hidden = this.getHidden();

    if (hidden.some((h) => sameWorkspacePath(h.path, normalized))) {
      return;
    }

    hidden.push({ ...item, path: normalized });
    await this.context.globalState.update(HIDDEN_STORAGE_KEY, hidden);
  }

  public async restoreWorkspace(workspacePath: string): Promise<boolean> {
    const normalized = normalizeWorkspacePath(workspacePath);
    const hidden = this.getHidden();
    const filtered = hidden.filter((h) => !sameWorkspacePath(h.path, normalized));

    if (filtered.length === hidden.length) {
      return false;
    }

    await this.context.globalState.update(HIDDEN_STORAGE_KEY, filtered);
    return true;
  }

  private async workspaceExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }
}
