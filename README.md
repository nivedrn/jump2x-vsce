# Snap2x

Snap2x helps you quickly jump between workspaces.

## Features

- Persisted list of favorited workspaces.
- Add current workspace to favorites.
- Open any favorite or discovered workspace in a new VS Code window.
- Discover workspace folders and `.code-workspace` files from a configured directory.
- Track active Snap2x windows in shared global storage using per-window heartbeats.

## Configure discovery directory

1. Open Settings.
2. Search for `Snap2x`.
3. Set `snap2x.workspacesDirectory` to a folder path.

## Important limitation

VS Code extensions cannot programmatically focus an already-open, specific other window. Snap2x always opens the selected workspace in a new window.

Snap2x uses shared storage metadata to detect likely active windows and warns before opening a duplicate, but it still cannot switch focus to another existing window.

## Development

- Press F5 with the Run Snap2x Extension launch configuration to open an Extension Development Host.
- Run `npm test` to execute the lightweight storage and discovery utility tests.
- Run `npm run package:vsix` to create a local VSIX package.
