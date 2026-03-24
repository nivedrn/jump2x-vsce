import * as vscode from 'vscode';

export interface FavoriteWorkspace {
  path: string;
  uri: string;
  label: string;
  addedAt: number;
}

export interface DiscoveredWorkspace {
  path: string;
  uri: string;
  label: string;
  isCodeWorkspaceFile: boolean;
}

export interface Snap2xSettings {
  workspacesDirectory: string;
  recursiveScan: boolean;
  includeCodeWorkspaceFiles: boolean;
}

export const FAVORITES_STORAGE_KEY = 'snap2x.favorites';

export type WorkspaceItemKind =
  | 'favoritesRoot'
  | 'discoveredRoot'
  | 'favoriteWorkspace'
  | 'discoveredWorkspace';

export interface OpenableWorkspace {
  uri: vscode.Uri;
  label: string;
  path: string;
}
