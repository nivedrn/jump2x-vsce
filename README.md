# Jump2X

Jump2X helps you quickly jump between workspaces with favorites, discovery, and hide controls.

## Features

- Favorited workspaces persisted in extension storage.
- Add current workspace to favorites from the Jump2X view title action.
- Discover Git repositories and `.code-workspace` files from one or more configured root folders.
- Exclude specific directories from discovery traversal.
- Hide discovered workspaces you do not want to see in quick open or discovered list.
- Restore hidden workspaces from a dedicated Hidden Workspaces section.
- Quick Open picker with section separators:
	- Favorited Workspaces
	- Discovered Workspaces
- Inline quick actions in quick open for discovered items:
	- Add to favorites
	- Hide workspace
- Open selected workspace in a new VS Code window.

## Settings

Configure these settings from VS Code Settings by searching for `Jump2X`:

- `jump2x.workspacesDirectories` (array of strings)
	- Root directories to scan for Git repos and `.code-workspace` files.
- `jump2x.excludedDirectories` (array of strings)
	- Full directory paths to skip while scanning.
- `jump2x.recursiveScan` (boolean)
	- If true, scan nested directories recursively.
- `jump2x.maxScanDepth` (number)
	- Maximum folder depth from each configured root.
	- `0` scans only the root folder.
	- `1` includes direct child folders.
	- `-1` means unlimited depth.
- `jump2x.includeCodeWorkspaceFiles` (boolean)
	- If true, include discovered `.code-workspace` files.

## Commands and interactions

- `Jump2X: Quick Open Workspace`
	- Default keybinding: `Ctrl+Shift+K` (`Cmd+Shift+K` on macOS).
- `Jump2X: Add Current Workspace to Favorites`
- `Jump2X: Refresh Workspaces`
- `Jump2X: Open Settings`

Notes:

- Some commands are internal and intentionally hidden from the Command Palette (for example, open selected workspace, remove favorite, hide, and restore). These are triggered through tree item interactions and quick open buttons.

## Important limitation

VS Code extensions cannot programmatically focus a specific already-open window. Jump2X always opens the selected workspace in a new window.

## Usage flow

1. Add one or more `workspacesDirectories`.
2. Optionally add `excludedDirectories`.
3. Open the Jump2X view and refresh discovery.
4. Add frequently used entries to favorites.
5. Hide noisy discovered entries; restore later from Hidden Workspaces.

## Development

- Press F5 with the Run Jump2X Extension launch configuration to open an Extension Development Host.
- Run `npm test` to execute the lightweight storage and discovery utility tests.
- Run `npm run package:vsix` to create a local VSIX package.
