import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The artifact a developer actually puts in their Claude Code settings: `npm run build:guard` output, copied on its own
 * into a directory with no node_modules and run with plain node. guard.e2e.test.ts covers the logic through tsx; this
 * covers the packaging, which is where a "works in the repo, breaks in your project" bug would live.
 */

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

let built = ''; // where the build wrote its output
let bare = ''; // an unrelated directory the one file is copied into
let hook = '';

beforeAll(() => {
  built = mkdtempSync(path.join(tmpdir(), 'guard-build-'));
  bare = mkdtempSync(path.join(tmpdir(), 'guard-bare-'));
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '-c', 'vite.guard.config.ts', '--outDir', built, '--logLevel', 'warn'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  hook = path.join(bare, 'claude-hook.js');
  copyFileSync(path.join(built, 'claude-hook.js'), hook);
});

afterAll(() => {
  rmSync(built, { recursive: true, force: true });
  rmSync(bare, { recursive: true, force: true });
});

const envelope = { session_id: 's1', cwd: '/work/app', hook_event_name: 'PreToolUse', tool_use_id: 'toolu_1' };
const bash = (command: string) => ({ ...envelope, tool_name: 'Bash', tool_input: { command } });

function run(input: unknown, env: Record<string, string> = {}, args: string[] = []) {
  const r = spawnSync(process.execPath, [hook, ...args], {
    cwd: bare,
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const local = { COMMANDER_GUARD_LOCAL: '1' };

describe('the bundled guard', () => {
  it('is exactly one file', () => {
    expect(readdirSync(built)).toEqual(['claude-hook.js']);
  });

  it('imports nothing but node built-ins, so it needs no node_modules', () => {
    const source = readFileSync(hook, 'utf8');
    // Real module statements only: a line that starts with import/export, a bare `import 'x'`, or a dynamic import().
    const specifiers = [...source.matchAll(/^\s*(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gm)].map(
      (m) => m[1] ?? m[2] ?? m[3]!,
    );
    expect(specifiers.length).toBeGreaterThan(0);
    for (const s of specifiers) expect(s, s).toMatch(/^node:/);
    expect(source).not.toMatch(/\brequire\(/);
  });

  it('clears ordinary work, from a directory that has nothing installed', () => {
    expect(run(bash('ls'), local)).toMatchObject({ code: 0, stdout: '' });
  });

  it('denies a destructive command with the reason on stderr', () => {
    const r = run(bash('rm -rf /'), local);
    expect(r).toMatchObject({ code: 2, stdout: '' });
    expect(r.stderr).toContain('COMMANDER GUARD // DENIED');
    expect(r.stderr).toContain('[shell.rm-destructive]');
  });

  it('refuses to stage when there is no server to ask', () => {
    const r = run(bash('kubectl apply -f prod.yaml'), local);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('STAGED (local rules)');
  });

  it('fails closed when it is not configured, and on garbage input', () => {
    expect(run(bash('ls'))).toMatchObject({ code: 2 });
    expect(run(bash('ls')).stderr).toContain('Guard not configured');
    expect(run('this is not json', local).code).toBe(2);
    expect(run('', local).code).toBe(2);
  });

  it('prints settings that point at the file it is running from', () => {
    const r = run(undefined, {}, ['--print-settings', '--url', 'https://commander.example', '--mission', 'msn_1']);
    expect(r.code).toBe(0);
    const s = JSON.parse(r.stdout) as { env: Record<string, string>; hooks: { PreToolUse: { hooks: { command: string }[] }[] } };
    expect(s.env).toMatchObject({ COMMANDER_URL: 'https://commander.example', COMMANDER_MISSION: 'msn_1' });
    expect(s.hooks.PreToolUse[0]!.hooks[0]!.command).toBe(`node "${hook}"`);
  });
});
