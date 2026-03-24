import * as vscode from 'vscode';
import { DiscoveryService } from '../services/discoveryService';
import { StorageManager } from '../storage/storageManager';
import { DiscoveredWorkspace, FavoriteWorkspace, WorkspaceItemKind } from '../types';
import { workspacePathKey } from '../utils/pathUtils';

const FAVORITES_SECTION_ID = 'snap2x:favorites';
const DISCOVERED_SECTION_ID = 'snap2x:discovered';

export interface WorkspaceNodeData {
  kind: WorkspaceItemKind;
  id: string;
  label: string;
  uri?: vscode.Uri;
  path?: string;
}

export class WorkspaceTreeItem extends vscode.TreeItem {
  public readonly node: WorkspaceNodeData;

  constructor(node: WorkspaceNodeData, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(node.label, collapsibleState);
    this.node = node;
    this.id = node.id;
    this.contextValue = node.kind;

    if (node.kind === 'favoriteWorkspace' || node.kind === 'discoveredWorkspace') {
      this.tooltip = node.path;
      this.description = node.path;
      this.command = {
        command: 'snap2x.openWorkspace',
        title: 'Open Workspace',
        arguments: [this],
      };
      this.iconPath =
        node.kind === 'favoriteWorkspace'
          ? new vscode.ThemeIcon('star-full')
          : new vscode.ThemeIcon('folder-opened');
    } else if (node.kind === 'favoritesRoot') {
      this.iconPath = new vscode.ThemeIcon('star-empty');
    } else if (node.kind === 'discoveredRoot') {
      this.iconPath = new vscode.ThemeIcon('folder-library');
    }
  }
}

export class WorkspaceTreeProvider implements vscode.TreeDataProvider<WorkspaceTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<WorkspaceTreeItem | undefined>();
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private discoveredCache: DiscoveredWorkspace[] = [];
  private warningMessage: string | undefined;

  constructor(
    private readonly storageManager: StorageManager,
    private readonly discoveryService: DiscoveryService
  ) {}

  public async refresh(): Promise<void> {
    const discovered = await this.discoveryService.discoverWorkspaces();
    this.discoveredCache = discovered.items;
    this.warningMessage = discovered.warning;
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  public getWarningMessage(): string | undefined {
    return this.warningMessage;
  }

  public getTreeItem(element: WorkspaceTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: WorkspaceTreeItem): Promise<WorkspaceTreeItem[]> {
    if (!element) {
      return [
        new WorkspaceTreeItem(
          {
            id: FAVORITES_SECTION_ID,
            kind: 'favoritesRoot',
            label: 'Favorited Workspaces',
          },
          vscode.TreeItemCollapsibleState.Expanded
        ),
        new WorkspaceTreeItem(
          {
            id: DISCOVERED_SECTION_ID,
            kind: 'discoveredRoot',
            label: 'Discovered Workspaces',
          },
          vscode.TreeItemCollapsibleState.Expanded
        ),
      ];
    }

    if (element.node.id === FAVORITES_SECTION_ID) {
      return this.buildFavoriteItems();
    }

    if (element.node.id === DISCOVERED_SECTION_ID) {
      return this.buildDiscoveredItems();
    }

    return [];
  }

  private buildFavoriteItems(): WorkspaceTreeItem[] {
    const favorites = this.storageManager
      .getFavorites()
      .sort((a, b) => a.label.localeCompare(b.label));

    if (favorites.length === 0) {
      return [
        this.makePlaceholder('No favorites yet. Use "Add Current Workspace".', 'snap2x:favorites:empty'),
      ];
    }

    return favorites.map((favorite) => this.favoriteToTreeItem(favorite));
  }

  private buildDiscoveredItems(): WorkspaceTreeItem[] {
    const favoriteKeys = new Set(this.storageManager.getFavorites().map((item) => workspacePathKey(item.path)));
    const discoveredOnly = this.discoveredCache.filter((item) => !favoriteKeys.has(workspacePathKey(item.path)));

    if (discoveredOnly.length === 0) {
      const label = this.warningMessage ?? 'No discovered workspaces. Configure snap2x.workspacesDirectory.';
      return [this.makePlaceholder(label, 'snap2x:discovered:empty')];
    }

    return discoveredOnly.map((item) => this.discoveredToTreeItem(item));
  }

  private favoriteToTreeItem(favorite: FavoriteWorkspace): WorkspaceTreeItem {
    return new WorkspaceTreeItem(
      {
        id: `snap2x:favorite:${favorite.path}`,
        kind: 'favoriteWorkspace',
        label: favorite.label,
        uri: vscode.Uri.parse(favorite.uri),
        path: favorite.path,
      },
      vscode.TreeItemCollapsibleState.None
    );
  }

  private discoveredToTreeItem(item: DiscoveredWorkspace): WorkspaceTreeItem {
    return new WorkspaceTreeItem(
      {
        id: `snap2x:discovered:${item.path}`,
        kind: 'discoveredWorkspace',
        label: item.label,
        uri: vscode.Uri.parse(item.uri),
        path: item.path,
      },
      vscode.TreeItemCollapsibleState.None
    );
  }

  private makePlaceholder(label: string, id: string): WorkspaceTreeItem {
    const item = new WorkspaceTreeItem(
      {
        id,
        kind: 'discoveredRoot',
        label,
      },
      vscode.TreeItemCollapsibleState.None
    );

    item.contextValue = 'placeholder';
    item.command = undefined;
    item.iconPath = new vscode.ThemeIcon('info');
    item.tooltip = label;
    item.description = undefined;

    return item;
  }
}
