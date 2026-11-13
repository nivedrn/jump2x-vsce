const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SORT_PAD,
  padLabelsToKeepOrder,
  shortcutMatches,
  stripSortPadding,
  worktreeSuffix,
} = require('../out/utils/shortcutUtils.js');

// Mirrors how VS Code's quick pick ranks label matches while filtering
// (compareEntries / compareByPrefix in microsoft/vscode): labels that start with
// the typed value first, then shorter labels first, then alphabetical.
function vscodeSort(items, value) {
  const sortLabel = (item) => item.label.replace(/\$\([a-z0-9-]+(?:~[a-z0-9-]+)?\)/gi, '').trim().toLowerCase();
  return [...items].sort((a, b) => {
    const la = sortLabel(a);
    const lb = sortLabel(b);
    const pa = la.startsWith(value);
    const pb = lb.startsWith(value);
    if (pa !== pb) return pa ? -1 : 1;
    if (pa && la.length !== lb.length) return la.length - lb.length;
    return la.localeCompare(lb);
  });
}

function entry(shortcut, name, icon = shortcut.match(/[a-z]/) ? 'git-branch' : 'repo') {
  return { shortcut, label: `${shortcut} $(${icon}) ${name}` };
}

// Favorites 1, 10 and 11 with worktrees, plus a discovered entry without a shortcut.
const items = [
  entry('1', 'a-very-long-repository-name'),
  entry('1a', 'fix'),
  entry('1b', 'feature-login-page'),
  entry('2', 'two'),
  entry('10', 'ten'),
  entry('10a', 'x'),
  entry('11', 'eleven-with-a-long-name'),
  entry('11a', 'wt'),
  { label: '$(repo) discovered-1' },
];

test('worktreeSuffix maps indexes to letters, then numbers', () => {
  assert.equal(worktreeSuffix(0), 'a');
  assert.equal(worktreeSuffix(25), 'z');
  assert.equal(worktreeSuffix(26), '-27');
});

test('shortcutMatches keeps a favorite with its worktrees, then 10+, 11+', () => {
  assert.deepEqual(
    shortcutMatches(items, '1').map((item) => item.shortcut),
    ['1', '1a', '1b', '10', '10a', '11', '11a']
  );
  assert.deepEqual(shortcutMatches(items, ' 10 ').map((item) => item.shortcut), ['10', '10a']);
  assert.deepEqual(shortcutMatches(items, '1B').map((item) => item.shortcut), ['1b']);
});

test('shortcutMatches ignores values that are not shortcuts', () => {
  assert.equal(shortcutMatches(items, ''), undefined);
  assert.equal(shortcutMatches(items, 'repo'), undefined);
  assert.equal(shortcutMatches(items, '2048'), undefined);
  assert.equal(shortcutMatches(items, '3'), undefined);
});

test('padded labels survive VS Code sorting in list order', () => {
  for (const value of ['1', '1a', '10', '11']) {
    const matches = shortcutMatches(items, value);
    // Without padding VS Code would reorder them (shorter labels first).
    if (value === '1') {
      assert.notDeepEqual(vscodeSort(matches, value), matches);
    }
    const padded = padLabelsToKeepOrder(matches);
    assert.deepEqual(
      vscodeSort(padded, value).map((item) => item.shortcut),
      matches.map((item) => item.shortcut),
      `order for "${value}"`
    );
  }
});

test('padding is invisible and removable', () => {
  const padded = padLabelsToKeepOrder(shortcutMatches(items, '1'));
  assert.ok(padded.some((item) => item.label.includes(SORT_PAD)));
  assert.deepEqual(
    padded.map((item) => stripSortPadding(item.label)),
    shortcutMatches(items, '1').map((item) => item.label)
  );
  assert.equal(SORT_PAD.trim(), SORT_PAD);
});
