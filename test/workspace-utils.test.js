const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeWorkspacePath,
  sameWorkspacePath,
  workspacePathKey,
} = require('../out/utils/pathUtils.js');
const {
  isCodeWorkspaceFile,
  isIgnoredDirectory,
  shouldTraverseDirectory,
} = require('../out/utils/discoveryUtils.js');

test('normalizeWorkspacePath removes trailing separators', () => {
  assert.equal(normalizeWorkspacePath('C:/Work/demo///'), 'C:\\Work\\demo');
});

test('sameWorkspacePath compares case-insensitively on Windows', () => {
  assert.equal(sameWorkspacePath('C:/Work/Demo', 'c:/work/demo/', 'win32'), true);
});

test('workspacePathKey normalizes case for Windows deduplication', () => {
  assert.equal(workspacePathKey('C:/Work/Demo/', 'win32'), 'c:\\work\\demo');
});

test('isCodeWorkspaceFile detects workspace files', () => {
  assert.equal(isCodeWorkspaceFile('team.code-workspace'), true);
  assert.equal(isCodeWorkspaceFile('team.json'), false);
});

test('isIgnoredDirectory matches internal skip list', () => {
  assert.equal(isIgnoredDirectory('node_modules'), true);
  assert.equal(isIgnoredDirectory('apps'), false);
});

test('shouldTraverseDirectory only descends from root when recursive scan is disabled', () => {
  assert.equal(shouldTraverseDirectory(0, false, -1), true);
  assert.equal(shouldTraverseDirectory(1, false, -1), false);
  assert.equal(shouldTraverseDirectory(5, true, -1), true);
  assert.equal(shouldTraverseDirectory(0, true, 0), false);
  assert.equal(shouldTraverseDirectory(0, true, 1), true);
  assert.equal(shouldTraverseDirectory(1, true, 1), false);
  assert.equal(shouldTraverseDirectory(1, true, 2), true);
});
