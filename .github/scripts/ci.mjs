import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { log } from 'node:console';

export const jobs = ['format', 'quality', 'unit', 'database', 'web', 'mobile'];

export function selectJobs(files) {
  const selected = Object.fromEntries(jobs.map((job) => [job, false]));
  const enable = (...names) => names.forEach((name) => (selected[name] = true));
  for (const file of files) {
    if (/\.(?:[cm]?[jt]sx?|json|ya?ml|css|mdx?|html|svg)$/i.test(file))
      enable('format');
    // Documentation and screenshots do not affect the runtime applications.
    if (
      /\.md$/i.test(file) ||
      (/\.(?:mdx|png|jpe?g|gif|webp|ico|svg)$/i.test(file) &&
        !file.startsWith('apps/'))
    )
      continue;
    if (file === '.gitignore') continue;
    if (file === '.prettierignore') {
      enable('format');
      continue;
    }
    if (file.startsWith('apps/mobile/')) {
      enable('quality', 'mobile');
    } else if (file.startsWith('apps/web/')) {
      enable('quality', 'web');
      if (
        /^apps\/web\/(src\/(server|app\/api)\/|drizzle\/|drizzle\.config\.|tools\/)/.test(
          file,
        )
      )
        enable('unit', 'database');
    } else if (
      file.startsWith('tests/e2e/') ||
      file === 'playwright.config.ts'
    ) {
      enable('quality', 'web');
    } else if (file.startsWith('tests/unit/') || file === 'vitest.config.ts') {
      enable('quality', 'unit', 'database');
    } else if (file.startsWith('tools/')) {
      enable('quality', 'web', 'mobile');
    } else if (file === 'compose.yaml') {
      enable('quality', 'unit', 'database');
    } else if (file === '.prettierrc.json') {
      enable('format');
    } else {
      // Shared packages, lockfiles, CI/config changes, and unknown paths run all.
      // New code must not silently fall outside the checked dependency graph.
      enable(...jobs);
    }
  }
  return selected;
}

export function changedFiles({ base, head, pullRequest = false, cwd }) {
  if (
    !/^[a-f0-9]{40}$/i.test(head ?? '') ||
    !/^[a-f0-9]{40}$/i.test(base ?? '')
  )
    throw new Error('Expected full base and head commit SHAs');
  const args = /^0+$/.test(base)
    ? ['ls-files', '-z']
    : [
        'diff',
        '--name-only',
        '--no-renames',
        '-z',
        ...(pullRequest ? [`${base}...${head}`] : [base, head]),
        '--',
      ];
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

export function failedJobs(needs) {
  if (needs.changes?.result !== 'success') return ['changes'];
  return jobs.filter((job) => {
    const enabled = needs.changes.outputs[job];
    if (enabled !== 'true' && enabled !== 'false') return true;
    return enabled === 'true'
      ? needs[job]?.result !== 'success'
      : needs[job]?.result !== 'skipped';
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv[2] === 'changes') {
    const files = changedFiles({
      base: process.env.BASE_SHA,
      head: process.env.HEAD_SHA,
      pullRequest: process.env.EVENT_NAME === 'pull_request',
    });
    const selected = selectJobs(files);
    const output = Object.entries(selected)
      .map(([job, enabled]) => `${job}=${enabled}`)
      .join('\n');
    appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
    log(output);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### CI selection\n\n${files.length} changed files.\n\n| Job | Run |\n| --- | --- |\n${Object.entries(
          selected,
        )
          .map(([job, enabled]) => `| ${job} | ${enabled ? 'yes' : 'skip'} |`)
          .join('\n')}\n`,
      );
  } else if (process.argv[2] === 'verify') {
    const failures = failedJobs(JSON.parse(process.env.NEEDS_JSON));
    if (failures.length)
      throw new Error(
        `Required CI jobs did not succeed: ${failures.join(', ')}`,
      );
    log('All applicable checks passed; unrelated jobs were skipped.');
  } else {
    throw new Error('Usage: ci.mjs changes|verify');
  }
}
