import * as vscode from 'vscode';
import { WorkspaceTreeProvider } from '../providers/workspaceTreeProvider';
import { DiscoveryService } from '../services/discoveryService';
import { StorageManager } from '../storage/storageManager';
import { DiscoveredWorkspace, FavoriteWorkspace, HiddenWorkspace, WorktreeInfo } from '../types';
import { workspacePathKey } from '../utils/pathUtils';
import { confirmAndDeleteWorktree } from './deleteWorktree';

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

const DELETE_WORKTREE_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('trash'),
  tooltip: 'Delete worktree',
};

interface WorkspaceQuickPickItem extends vscode.QuickPickItem {
  path?: string;
  uri?: vscode.Uri;
  repoPath?: string;
  isFavorite?: boolean;
  section?: 'favorite' | 'discovered' | 'worktree' | 'placeholder';
  shortcut?: string;
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
        shortcut: `${favCount}`,
        buttons: [REMOVE_FAVORITE_BUTTON],
      });
      totalCount++;

      const worktrees = worktreesByPath.get(workspacePathKey(favorite.path)) ?? [];
      let letter = 0;
      for (const worktree of worktrees) {
        if (itemLimit !== -1 && totalCount >= itemLimit) break;
        const shortcut = `${favCount}${worktreeSuffix(letter)}`;
        items.push({
          label: `${shortcut} $(git-branch) ${worktree.label}`,
          description: worktree.path,
          path: worktree.path,
          uri: vscode.Uri.parse(worktree.uri),
          repoPath: favorite.path,
          isFavorite: false,
          section: 'worktree',
          shortcut,
          buttons: [DELETE_WORKTREE_BUTTON],
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

      const worktrees = worktreesByPath.get(workspacePathKey(item.path)) ?? [];
      for (const worktree of worktrees) {
        if (itemLimit !== -1 && totalCount >= itemLimit) break;
        items.push({
          label: `    $(git-branch) ${worktree.label}`,
          description: worktree.path,
          path: worktree.path,
          uri: vscode.Uri.parse(worktree.uri),
          repoPath: item.path,
          isFavorite: false,
          section: 'worktree',
          buttons: [DELETE_WORKTREE_BUTTON],
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
  return label.trim().replace(/^\d+[a-z]?(?:-\d+)?\s+/, '').replace(/^\$\([^)]+\)\s/, '').trim();
}

// While filtering, VS Code re-sorts matches with shorter labels first, so typing
// "1" can rank "1b fix" or "10 api" above "1 my-project". Activate the entry whose
// shortcut exactly matches the typed value so Enter always opens that entry.
function activateShortcutItem(quickPick: vscode.QuickPick<WorkspaceQuickPickItem>): void {
  const value = quickPick.value.trim().toLowerCase();
  if (!value) {
    return;
  }
  const match = quickPick.items.find((item) => item.shortcut === value);
  if (match) {
    quickPick.activeItems = [match];
  }
}

export async function quickOpenWorkspace(
  storageManager: StorageManager,
  discoveryService: DiscoveryService,
  provider: WorkspaceTreeProvider
): Promise<void> {
  let favorites = storageManager.getFavorites();
  let hidden = storageManager.getHidden();
  let discoveredItems: DiscoveredWorkspace[] = [];
  let discoveryWarning: string | undefined;
  // Worktrees for both favorites and discovered repos, keyed by repo path, so a
  // repo keeps its worktrees when it is starred or unstarred in the picker.
  const worktreesByPath = new Map<string, WorktreeInfo[]>();

  const quickPick = vscode.window.createQuickPick<WorkspaceQuickPickItem>();
  const itemLimit = vscode.workspace.getConfiguration('jump2x').get<number>('quickPickItemLimit', 20);
  const setItems = (items: WorkspaceQuickPickItem[]) => {
    quickPick.items = items;
    activateShortcutItem(quickPick);
  };
  setItems(buildQuickPickItems(favorites, discoveredItems, hidden, worktreesByPath, discoveryWarning, true, itemLimit));
  quickPick.placeholder = 'Select a workspace to open (type 1 for a favorite, 1a/1b for its worktrees)';
  quickPick.matchOnDescription = true;
  quickPick.busy = true;
  quickPick.show();

  // Compute favorite worktrees in the background so 1a/1b entries appear.
  if (discoveryService.getSettings().includeWorktrees) {
    Promise.all(
      favorites.map(async (favorite) => {
        const worktrees = await discoveryService.getWorktrees(favorite.path);
        const key = workspacePathKey(favorite.path);
        if (worktrees.length > 0 && !worktreesByPath.has(key)) {
          worktreesByPath.set(key, worktrees);
        }
      })
    ).then(() => {
      setItems(buildQuickPickItems(favorites, discoveredItems, hidden, worktreesByPath, discoveryWarning, quickPick.busy, itemLimit));
    }).catch(() => {
      /* worktree lookup is best-effort */
    });
  }

  // Load discovered workspaces asynchronously
  discoveryService.discoverWorkspaces().then((discovered) => {
    discoveredItems = discovered.items;
    discoveryWarning = discovered.warning;
    for (const item of discoveredItems) {
      const key = workspacePathKey(item.path);
      if (item.worktrees?.length && !worktreesByPath.has(key)) {
        worktreesByPath.set(key, item.worktrees);
      }
    }
    hidden = storageManager.getHidden();
    setItems(buildQuickPickItems(favorites, discoveredItems, hidden, worktreesByPath, discoveryWarning, false, itemLimit));
    quickPick.busy = false;
  }).catch((error: unknown) => {
    discoveryWarning = error instanceof Error ? error.message : 'Failed to discover workspaces.';
    setItems(buildQuickPickItems(favorites, discoveredItems, hidden, worktreesByPath, discoveryWarning, false, itemLimit));
    quickPick.busy = false;
  });

  const handleButtonClick = async (e: vscode.QuickPickItemButtonEvent<WorkspaceQuickPickItem>) => {
    const item = e.item;
    if (!isOpenableItem(item)) {
      return;
    }

    if (e.button === DELETE_WORKTREE_BUTTON) {
      if (!item.repoPath) {
        return;
      }
      // Keep the picker open while the confirmation dialog has focus.
      quickPick.ignoreFocusOut = true;
      let deleted: boolean;
      try {
        deleted = await confirmAndDeleteWorktree(item.repoPath, item.path, cleanWorkspaceLabel(item.label));
      } finally {
        quickPick.ignoreFocusOut = false;
      }
      if (!deleted) {
        return;
      }
      const repoKey = workspacePathKey(item.repoPath);
      const deletedKey = workspacePathKey(item.path);
      worktreesByPath.set(
        repoKey,
        (worktreesByPath.get(repoKey) ?? []).filter((worktree) => workspacePathKey(worktree.path) !== deletedKey)
      );
    } else if (e.button === HIDE_WORKSPACE_BUTTON) {
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
      const result = await storageManager.addFavorite(item.uri, cleanWorkspaceLabel(item.label));
      if (!result.added) {
        vscode.window.showInformationMessage(result.reason ?? 'Workspace is already in favorites.');
        return;
      }
    }

    favorites = storageManager.getFavorites();
    hidden = storageManager.getHidden();
    setItems(buildQuickPickItems(favorites, discoveredItems, hidden, worktreesByPath, discoveryWarning, false, itemLimit));
    // Keep the Jump2x sidebar in sync with changes made from the picker.
    void provider.refresh();
  };

  let lastInteractiveItem: WorkspaceQuickPickItem | undefined;

  const selected = await new Promise<WorkspaceQuickPickItem | undefined>((resolve) => {
    let accepted = false;

    quickPick.onDidTriggerItemButton((e) => {
      handleButtonClick(e);
    });

    quickPick.onDidChangeValue(() => {
      activateShortcutItem(quickPick);
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
