import * as vscode from 'vscode';
import { DiscoveryService } from '../services/discoveryService';
import { StorageManager } from '../storage/storageManager';
import { DiscoveredWorkspace, FavoriteWorkspace, HiddenWorkspace, WorktreeInfo } from '../types';
import { workspacePathKey } from '../utils/pathUtils';

const REMOVE_FAVORITE_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('trash'),
  tooltip: 'Remove from favorites',
};

const ADD_FAVORITE_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('star-add'),
  tooltip: 'Add to favorites',
};

const HIDE_WORKSPACE_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('eye-closed'),
  tooltip: 'Hide workspace',
};

interface WorkspaceQuickPickItem extends vscode.QuickPickItem {
  path?: string;
  uri?: vscode.Uri;
  isFavorite?: boolean;
  section?: 'favorite' | 'discovered' | 'worktree' | 'placeholder';
  buttons?: vscode.QuickInputButton[];
}

function isCodeWorkspacePath(value: string): boolean {
  return value.toLowerCase().endsWith('.code-workspace');
}

// Maps 0,1,2... to a,b,c... so favorite N's worktrees are Na, Nb, Nc.
function worktreeSuffix(index: number): string {
  if (index < 26) {
    return String.fromCharCode(97 + index);
  }
  return `-${index + 1}`;
}

function workspaceLabelIcon(isCodeWorkspaceFile: boolean): string {
  return isCodeWorkspaceFile ? '$(file-code)' : '$(repo)';
}

function buildQuickPickItems(
  favorites: FavoriteWorkspace[],
  discovered: DiscoveredWorkspace[],
  hidden: HiddenWorkspace[],
  worktreesByPath: Map<string, WorktreeInfo[]>,
  warning?: string,
  includeDiscoveryPlaceholder = false,
  itemLimit: number = 20
): WorkspaceQuickPickItem[] {
  const items: WorkspaceQuickPickItem[] = [];
  let favCount = 1;
  let totalCount = 0;

  items.push({
    kind: vscode.QuickPickItemKind.Separator,
    label: 'Favorited Workspaces',
    section: 'placeholder',
  });

  if (favorites.length === 0) {
    items.push({
      label: 'No favorites yet',
      description: 'Use "Add Current Workspace to Favorites" to save one.',
      section: 'placeholder',
    });
  } else {
    for (const favorite of favorites) {
      if (itemLimit !== -1 && totalCount >= itemLimit) break;
      const isCodeWorkspaceFile = isCodeWorkspacePath(favorite.path);
      items.push({
        label: `${favCount} ${workspaceLabelIcon(isCodeWorkspaceFile)} ${favorite.label}`,
        description: favorite.path,
        path: favorite.path,
        uri: vscode.Uri.parse(favorite.uri),
        isFavorite: true,
        section: 'favorite',
        buttons: [REMOVE_FAVORITE_BUTTON],
      });
      totalCount++;

      const worktrees = worktreesByPath.get(workspacePathKey(favorite.path)) ?? [];
      let letter = 0;
      for (const worktree of worktrees) {
        if (itemLimit !== -1 && totalCount >= itemLimit) break;
        items.push({
          label: `${favCount}${worktreeSuffix(letter)} $(git-branch) ${worktree.label}`,
          description: worktree.path,
          path: worktree.path,
          uri: vscode.Uri.parse(worktree.uri),
          isFavorite: false,
          section: 'worktree',
        });
        letter++;
        totalCount++;
      }
      favCount++;
    }
  }

  items.push({
    kind: vscode.QuickPickItemKind.Separator,
    label: 'Discovered Workspaces',
    section: 'placeholder',
  });

  const favoriteKeys = new Set(favorites.map((item) => workspacePathKey(item.path)));
  const hiddenKeys = new Set(hidden.map((item) => workspacePathKey(item.path)));
  const discoveredOnly = discovered.filter(
    (item) => !favoriteKeys.has(workspacePathKey(item.path)) && !hiddenKeys.has(workspacePathKey(item.path))
  );

  if (discoveredOnly.length === 0) {
    items.push({
      label: includeDiscoveryPlaceholder
        ? 'Discovering workspaces...'
        : warning ?? 'No discovered workspaces. Configure jump2x.workspacesDirectories.',
      section: 'placeholder',
    });
  } else {
    for (const item of discoveredOnly) {
      if (itemLimit !== -1 && totalCount >= itemLimit) break;
      items.push({
        label: `${workspaceLabelIcon(item.isCodeWorkspaceFile)} ${item.label}`,
        description: item.path,
        path: item.path,
        uri: vscode.Uri.parse(item.uri),
        isFavorite: false,
        section: 'discovered',
        buttons: [ADD_FAVORITE_BUTTON, HIDE_WORKSPACE_BUTTON],
      });
      totalCount++;

      const worktrees = item.worktrees ?? worktreesByPath.get(workspacePathKey(item.path)) ?? [];
      for (const worktree of worktrees) {
        if (itemLimit !== -1 && totalCount >= itemLimit) break;
        items.push({
          label: `    $(git-branch) ${worktree.label}`,
          description: worktree.path,
          path: worktree.path,
          uri: vscode.Uri.parse(worktree.uri),
          isFavorite: false,
          section: 'worktree',
        });
        totalCount++;
      }
    }
  }

  return items;
}

function isOpenableItem(item: WorkspaceQuickPickItem | undefined): item is WorkspaceQuickPickItem & { path: string; uri: vscode.Uri } {
  return Boolean(item?.path && item.uri);
}

function cleanWorkspaceLabel(label: string): string {
  return label.replace(/^\d+[a-z]?(?:-\d+)?\s+/, '').replace(/^\$\([^)]+\)\s/, '').trim();
}

export async function quickOpenWorkspace(
  storageManager: StorageManager,
  discoveryService: DiscoveryService
): Promise<void> {
  let favorites = storageManager.getFavorites();
  let hidden = storageManager.getHidden();
  let discoveredItems: DiscoveredWorkspace[] = [];
  let discoveryWarning: string | undefined;
  const worktreesByPath = new Map<string, WorktreeInfo[]>();

  const quickPick = vscode.window.createQuickPick<WorkspaceQuickPickItem>();
  const itemLimit = vscode.workspace.getConfiguration('jump2x').get<number>('quickPickItemLimit', 20);
  quickPick.items = buildQuickPickItems(favorites, discoveredItems, hidden, worktreesByPath, discoveryWarning, true, itemLimit);
  quickPick.placeholder = 'Select a workspace to open (type 1 for a favorite, 1a/1b for its worktrees)';
  quickPick.matchOnDescription = true;
  quickPick.busy = true;
  quickPick.show();

  // Compute favorite worktrees in the background so 1a/1b entries appear.
  if (discoveryService.getSettings().includeWorktrees) {
    Promise.all(
      favorites.map(async (favorite) => {
        const worktrees = await discoveryService.getWorktrees(favorite.path);
        if (worktrees.length > 0) {
          worktreesByPath.set(workspacePathKey(favorite.path), worktrees);
        }
      })
    ).then(() => {
      quickPick.items = buildQuickPickItems(favorites, discoveredItems, hidden, worktreesByPath, discoveryWarning, quickPick.busy, itemLimit);
    }).catch(() => {
      /* worktree lookup is best-effort */
    });
  }

  // Load discovered workspaces asynchronously
  discoveryService.discoverWorkspaces().then((discovered) => {
    discoveredItems = discovered.items;
    discoveryWarning = discovered.warning;
    hidden = storageManager.getHidden();
    quickPick.items = buildQuickPickItems(favorites, discoveredItems, hidden, worktreesByPath, discoveryWarning, false, itemLimit);
    quickPick.busy = false;
  }).catch((error: unknown) => {
    discoveryWarning = error instanceof Error ? error.message : 'Failed to discover workspaces.';
    quickPick.items = buildQuickPickItems(favorites, discoveredItems, hidden, worktreesByPath, discoveryWarning, false, itemLimit);
    quickPick.busy = false;
  });

  const handleButtonClick = async (e: vscode.QuickPickItemButtonEvent<WorkspaceQuickPickItem>) => {
    const item = e.item;
    if (!isOpenableItem(item)) {
      return;
    }

    if (e.button === HIDE_WORKSPACE_BUTTON) {
      await storageManager.hideWorkspace({
        path: item.path,
        uri: item.uri.toString(),
        label: cleanWorkspaceLabel(item.label),
      });
    } else if (item.isFavorite) {
      // Remove from favorites
      await storageManager.removeFavorite(item.path);
    } else {
      // Add to favorites
      await storageManager.addFavorite(item.uri, cleanWorkspaceLabel(item.label));
    }

    favorites = storageManager.getFavorites();
    hidden = storageManager.getHidden();
    quickPick.items = buildQuickPickItems(favorites, discoveredItems, hidden, worktreesByPath, discoveryWarning, false, itemLimit);
  };

  let lastInteractiveItem: WorkspaceQuickPickItem | undefined;

  const selected = await new Promise<WorkspaceQuickPickItem | undefined>((resolve) => {
    let accepted = false;

    quickPick.onDidTriggerItemButton((e) => {
      handleButtonClick(e);
    });

    quickPick.onDidChangeSelection((items) => {
      const selectedItem = items[0];
      if (isOpenableItem(selectedItem)) {
        lastInteractiveItem = selectedItem;
      }
    });

    quickPick.onDidChangeActive((items) => {
      const activeItem = items[0];
      if (isOpenableItem(activeItem)) {
        lastInteractiveItem = activeItem;
      }
    });

    quickPick.onDidAccept(() => {
      const item = quickPick.selectedItems[0] ?? quickPick.activeItems[0] ?? lastInteractiveItem;
      if (!isOpenableItem(item)) {
        return;
      }
      accepted = true;
      resolve(item);
      quickPick.dispose();
    });

    quickPick.onDidHide(() => {
      if (accepted) {
        return;
      }
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
  await vscode.commands.executeCommand('vscode.openFolder', selected.uri, { forceNewWindow: true });
}
