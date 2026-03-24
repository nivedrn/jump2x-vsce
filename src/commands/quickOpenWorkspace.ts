import * as vscode from 'vscode';
import { DiscoveryService } from '../services/discoveryService';
import { StorageManager } from '../storage/storageManager';
import { DiscoveredWorkspace, FavoriteWorkspace } from '../types';
import { workspacePathKey } from '../utils/pathUtils';

const REMOVE_FAVORITE_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('trash'),
  tooltip: 'Remove from favorites',
};

const ADD_FAVORITE_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('star-add'),
  tooltip: 'Add to favorites',
};

interface WorkspaceQuickPickItem extends vscode.QuickPickItem {
  path?: string;
  uri?: vscode.Uri;
  isFavorite?: boolean;
  section?: 'favorite' | 'discovered' | 'placeholder';
  buttons?: vscode.QuickInputButton[];
}

function buildQuickPickItems(
  favorites: FavoriteWorkspace[],
  discovered: DiscoveredWorkspace[],
  warning?: string,
  includeDiscoveryPlaceholder = false
): WorkspaceQuickPickItem[] {
  const items: WorkspaceQuickPickItem[] = [];

  items.push({
    kind: vscode.QuickPickItemKind.Separator,
    label: 'Favorited Workspaces',
    section: 'placeholder',
  });

  if (favorites.length === 0) {
    items.push({
      label: 'No favorites yet',
      description: 'Use Add Current Workspace to save one.',
      section: 'placeholder',
    });
  } else {
    for (const favorite of favorites) {
      items.push({
        label: `$(star-full) ${favorite.label}`,
        description: favorite.path,
        path: favorite.path,
        uri: vscode.Uri.parse(favorite.uri),
        isFavorite: true,
        section: 'favorite',
        buttons: [REMOVE_FAVORITE_BUTTON],
      });
    }
  }

  items.push({
    kind: vscode.QuickPickItemKind.Separator,
    label: 'Discovered Workspaces',
    section: 'placeholder',
  });

  const favoriteKeys = new Set(favorites.map((item) => workspacePathKey(item.path)));
  const discoveredOnly = discovered.filter((item) => !favoriteKeys.has(workspacePathKey(item.path)));

  if (discoveredOnly.length === 0) {
    items.push({
      label: includeDiscoveryPlaceholder
        ? 'Discovering workspaces...'
        : warning ?? 'No discovered workspaces. Configure snap2x.workspacesDirectory.',
      section: 'placeholder',
    });
  } else {
    for (const item of discoveredOnly) {
      items.push({
        label: `$(folder-opened) ${item.label}`,
        description: item.path,
        path: item.path,
        uri: vscode.Uri.parse(item.uri),
        isFavorite: false,
        section: 'discovered',
        buttons: [ADD_FAVORITE_BUTTON],
      });
    }
  }

  return items;
}

function isOpenableItem(item: WorkspaceQuickPickItem | undefined): item is WorkspaceQuickPickItem & { path: string; uri: vscode.Uri } {
  return Boolean(item?.path && item.uri);
}

export async function quickOpenWorkspace(
  storageManager: StorageManager,
  discoveryService: DiscoveryService
): Promise<void> {
  let favorites = storageManager.getFavorites();
  let discoveredItems: DiscoveredWorkspace[] = [];
  let discoveryWarning: string | undefined;

  const quickPick = vscode.window.createQuickPick<WorkspaceQuickPickItem>();
  quickPick.items = buildQuickPickItems(favorites, discoveredItems, discoveryWarning, true);
  quickPick.placeholder = 'Select a workspace to open';
  quickPick.matchOnDescription = true;
  quickPick.busy = true;
  quickPick.show();

  // Load discovered workspaces asynchronously
  discoveryService.discoverWorkspaces().then((discovered) => {
    discoveredItems = discovered.items;
    discoveryWarning = discovered.warning;
    quickPick.items = buildQuickPickItems(favorites, discoveredItems, discoveryWarning);
    quickPick.busy = false;
  }).catch((error: unknown) => {
    discoveryWarning = error instanceof Error ? error.message : 'Failed to discover workspaces.';
    quickPick.items = buildQuickPickItems(favorites, discoveredItems, discoveryWarning);
    quickPick.busy = false;
  });

  const handleButtonClick = async (e: vscode.QuickPickItemButtonEvent<WorkspaceQuickPickItem>) => {
    const item = e.item;
    if (!isOpenableItem(item)) {
      return;
    }

    if (item.isFavorite) {
      // Remove from favorites
      await storageManager.removeFavorite(item.path);
    } else {
      // Add to favorites
      await storageManager.addFavorite(item.uri, item.label.replace(/^\$\([^)]+\)\s/, ''));
    }

    favorites = storageManager.getFavorites();
    quickPick.items = buildQuickPickItems(favorites, discoveredItems, discoveryWarning);
  };

  const selected = await new Promise<WorkspaceQuickPickItem | undefined>((resolve) => {
    quickPick.onDidTriggerItemButton((e) => {
      handleButtonClick(e);
    });

    quickPick.onDidAccept(() => {
      const item = quickPick.selectedItems[0];
      if (!isOpenableItem(item)) {
        return;
      }
      quickPick.dispose();
      resolve(item);
    });

    quickPick.onDidHide(() => {
      quickPick.dispose();
      resolve(undefined);
    });
  });

  if (!isOpenableItem(selected)) {
    return;
  }

  // Check if workspace exists
  try {
    await vscode.workspace.fs.stat(selected.uri);
  } catch {
    vscode.window.showWarningMessage(`Workspace path is missing: ${selected.path}`);
    return;
  }

  // Always open in new window
  await vscode.commands.executeCommand('vscode.openFolder', selected.uri, true);
}
