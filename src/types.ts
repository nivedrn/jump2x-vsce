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

export interface HiddenWorkspace {
  path: string;
  uri: string;
  label: string;
}

export interface LeapSettings {
  workspacesDirectories: string[];
  excludedDirectories: string[];
  recursiveScan: boolean;
  includeCodeWorkspaceFiles: boolean;
}

export const FAVORITES_STORAGE_KEY = 'leap.favorites';
export const HIDDEN_STORAGE_KEY = 'leap.hidden';

export type WorkspaceItemKind =
  | 'favoritesRoot'
  | 'discoveredRoot'
  | 'hiddenRoot'
  | 'favoriteWorkspace'
  | 'discoveredWorkspace'
  | 'hiddenWorkspace';
