// Quick open shortcuts: favorite N is "N", its worktrees are "Na", "Nb", ...
// Kept free of the vscode module so it can be unit tested.

export interface ShortcutEntry {
  label: string;
  shortcut?: string;
}

// Zero-width space: invisible, and not removed by String.prototype.trim().
export const SORT_PAD = '​';

// Maps 0,1,2... to a,b,c... so favorite N's worktrees are Na, Nb, Nc.
export function worktreeSuffix(index: number): string {
  if (index < 26) {
    return String.fromCharCode(97 + index);
  }
  return `-${index + 1}`;
}

// Returns the entries whose shortcut starts with the typed value (e.g. "1" -> 1, 1a,
// 1b, 10, 10a, 11, ...), in their original order, or undefined when the value is
// not a shortcut.
export function shortcutMatches<T extends ShortcutEntry>(items: T[], rawValue: string): T[] | undefined {
  const value = rawValue.trim().toLowerCase();
  if (!/^\d+[a-z]?(?:-\d*)?$/.test(value)) {
    return undefined;
  }
  const matches = items.filter((item) => item.shortcut?.startsWith(value));
  return matches.length > 0 ? matches : undefined;
}

// Label text as VS Code sorts it: $(icon) markers removed, then trimmed.
export function sortLabelLength(label: string): number {
  return label.replace(/\$\([a-z0-9-]+(?:~[a-z0-9-]+)?\)/gi, '').trim().length;
}

// While filtering, VS Code ranks labels that start with the typed value first and,
// among those, shorter labels first, so "1b fix" would rank above "1 my-project".
// The stable API cannot turn that sorting off, so pad each label with invisible
// characters until the lengths increase in list order. Every shortcut match starts
// with the typed value, so VS Code's sort then keeps the given order.
export function padLabelsToKeepOrder<T extends ShortcutEntry>(items: T[]): T[] {
  let previousLength = -1;
  return items.map((item) => {
    const ownLength = sortLabelLength(item.label);
    const length = Math.max(ownLength, previousLength + 1);
    previousLength = length;
    return { ...item, label: item.label + SORT_PAD.repeat(length - ownLength) };
  });
}

export function stripSortPadding(label: string): string {
  return label.split(SORT_PAD).join('');
}
