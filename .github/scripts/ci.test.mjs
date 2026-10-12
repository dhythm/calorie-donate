import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { changedFiles, failedJobs, jobs, selectJobs } from './ci.mjs';

const enabled = (files) =>
  Object.entries(selectJobs(files))
    .filter(([, value]) => value)
    .map(([job]) => job);

test('documentation runs formatting only, screenshots and gitignore skip heavy work', () => {
  assert.deepEqual(enabled(['README.md']), ['format']);
  assert.deepEqual(enabled(['apps/mobile/README.md']), ['format']);
  assert.deepEqual(enabled(['.prettierignore']), ['format']);
  assert.deepEqual(enabled(['assets/demo/screen.jpg', '.gitignore']), []);
  assert.deepEqual(enabled([]), []);
});

test('mobile-only changes do not run web, unit tests or a database', () => {
  assert.deepEqual(enabled(['apps/mobile/src/MainApp.tsx']), [
    'format',
    'quality',
    'mobile',
  ]);
  assert.deepEqual(enabled(['apps/mobile/assets/brand/icon.png']), [
    'quality',
    'mobile',
  ]);
});

test('web UI and E2E changes run web without native exports or database checks', () => {
  for (const file of [
    'apps/web/src/app/globals.css',
    'tests/e2e/app-flow.spec.ts',
    'playwright.config.ts',
  ]) {
    assert.deepEqual(enabled([file]), ['format', 'quality', 'web']);
  }
});

test('server, API routes, migrations and seeds include DB and unit coverage', () => {
  for (const file of [
    'apps/web/src/server/service.ts',
    'apps/web/src/app/api/overview/route.ts',
    'apps/web/drizzle/0001.sql',
    'apps/web/drizzle.config.ts',
    'apps/web/tools/seed-demo.mjs',
  ]) {
    const selection = selectJobs([file]);
    for (const job of ['quality', 'unit', 'database', 'web'])
      assert.equal(selection[job], true, `${file}: ${job}`);
    assert.equal(selection.mobile, false);
  }
});

test('shared code, dependencies, workflow changes and unknown paths run everything', () => {
  for (const file of [
    'packages/api/src/client.ts',
    'package.json',
    'pnpm-lock.yaml',
    '.node-version',
    'tsconfig.base.json',
    '.github/workflows/ci.yml',
    '.github/actions/setup/action.yml',
    '.github/scripts/ci.mjs',
    'new-package/source.ts',
  ]) {
    assert.deepEqual(enabled([file]), jobs, file);
  }
});

test('multiple changed areas are combined', () => {
  assert.deepEqual(
    enabled(['apps/mobile/App.tsx', 'apps/web/src/app/page.tsx']),
    ['format', 'quality', 'web', 'mobile'],
  );
  assert.deepEqual(enabled(['tests/unit/api-client.test.ts']), [
    'format',
    'quality',
    'unit',
    'database',
  ]);
});

test('the required gate permits intentional skips but rejects missing, failed or cancelled jobs', () => {
  const outputs = Object.fromEntries(
    jobs.map((job) => [job, job === 'mobile' ? 'true' : 'false']),
  );
  const needs = {
    changes: { result: 'success', outputs },
    ...Object.fromEntries(
      jobs.map((job) => [
        job,
        { result: job === 'mobile' ? 'success' : 'skipped' },
      ]),
    ),
  };
  assert.deepEqual(failedJobs(needs), []);
  for (const result of ['failure', 'cancelled', 'skipped']) {
    assert.deepEqual(failedJobs({ ...needs, mobile: { result } }), ['mobile']);
  }
  assert.deepEqual(failedJobs({ ...needs, changes: { result: 'failure' } }), [
    'changes',
  ]);
  assert.deepEqual(
    failedJobs({ ...needs, changes: { result: 'success', outputs: {} } }),
    jobs,
  );
  assert.deepEqual(failedJobs({ ...needs, mobile: undefined }), ['mobile']);
});

test('Git diff includes the entire PR and both sides of renames and deletions', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'calorie-ci-'));
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const put = (name) => {
    mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
    writeFileSync(path.join(cwd, name), name);
  };
  const commit = (message) => {
    git('add', '.');
    git(
      '-c',
      'user.name=CI test',
      '-c',
      'user.email=ci@example.invalid',
      'commit',
      '-m',
      message,
    );
    return git('rev-parse', 'HEAD');
  };
  try {
    git('init', '--initial-branch=main');
    put('README.md');
    put('apps/web/src/old.ts');
    put('apps/mobile/src/deleted.ts');
    const base = commit('base');
    git('switch', '-c', 'feature');
    git('mv', 'apps/web/src/old.ts', 'apps/web/src/new.ts');
    git('rm', 'apps/mobile/src/deleted.ts');
    commit('rename and delete');
    put('apps/mobile/src/second.ts');
    const head = commit('second commit');
    git('switch', 'main');
    put('main-only.txt');
    const advancedBase = commit('advance main');
    const files = changedFiles({
      base: advancedBase,
      head,
      pullRequest: true,
      cwd,
    });
    assert.deepEqual(files.sort(), [
      'apps/mobile/src/deleted.ts',
      'apps/mobile/src/second.ts',
      'apps/web/src/new.ts',
      'apps/web/src/old.ts',
    ]);
    assert.deepEqual(changedFiles({ base, head, cwd }).sort(), files);
    assert.ok(
      changedFiles({ base: '0'.repeat(40), head, cwd }).includes('README.md'),
    );
    assert.throws(
      () => changedFiles({ base: '--help', head, cwd }),
      /full base and head/,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
