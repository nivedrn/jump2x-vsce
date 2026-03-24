# Leap

Leap helps you quickly jump between workspaces with favorites, discovery, and hide controls.

## Features

- Favorited workspaces persisted in extension storage.
- Add current workspace to favorites from the Leap view title action.
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

Configure these settings from VS Code Settings by searching for `Leap`:

- `leap.workspacesDirectories` (array of strings)
	- Root directories to scan for Git repos and `.code-workspace` files.
- `leap.excludedDirectories` (array of strings)
	- Full directory paths to skip while scanning.
- `leap.recursiveScan` (boolean)
	- If true, scan nested directories recursively.
- `leap.includeCodeWorkspaceFiles` (boolean)
	- If true, include discovered `.code-workspace` files.

## Commands and interactions

- `Leap: Quick Open Workspace`
	- Default keybinding: `Ctrl+Shift+K` (`Cmd+Shift+K` on macOS).
- `Leap: Add Current Workspace to Favorites`
- `Leap: Refresh Workspaces`
- `Leap: Open Settings`

Notes:

- Some commands are internal and intentionally hidden from the Command Palette (for example, open selected workspace, remove favorite, hide, and restore). These are triggered through tree item interactions and quick open buttons.

## Important limitation

VS Code extensions cannot programmatically focus a specific already-open window. Leap always opens the selected workspace in a new window.

## Usage flow

1. Add one or more `workspacesDirectories`.
2. Optionally add `excludedDirectories`.
3. Open the Leap view and refresh discovery.
4. Add frequently used entries to favorites.
5. Hide noisy discovered entries; restore later from Hidden Workspaces.

## Development

- Press F5 with the Run Leap Extension launch configuration to open an Extension Development Host.
- Run `npm test` to execute the lightweight storage and discovery utility tests.
- Run `npm run package:vsix` to create a local VSIX package.
