import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { settingsSnippet } from './guard/hook.js';

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
    expect(s.hooks.PreToolUse[0]!.hooks[0]!.command).toBe(`node "${hook}" || exit 2`);
  });
});

// Claude Code blocks a tool call only on exit code 2; any other non-zero exit is a non-blocking error and the call proceeds.
// So the command it runs is what has to fail closed, including when the hook cannot start at all.
describe('the installed command', () => {
  const commandFor = (hookPath: string) => settingsSnippet(hookPath).hooks.PreToolUse[0]!.hooks[0]!.command;

  function viaShell(hookPath: string, input: unknown = bash('ls'), env: Record<string, string> = local) {
    const r = spawnSync('sh', ['-c', commandFor(hookPath)], {
      cwd: bare,
      input: JSON.stringify(input),
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
      encoding: 'utf8',
      timeout: 30_000,
    });
    return { code: r.status, stdout: r.stdout, stderr: r.stderr };
  }

  const script = (name: string, body: string) => {
    const p = path.join(bare, name);
    writeFileSync(p, body);
    return p;
  };

  it("leaves the hook's own verdicts alone: allow stays 0, a block stays 2 and keeps its reason", () => {
    expect(viaShell(hook).code).toBe(0);
    const denied = viaShell(hook, bash('rm -rf /'));
    expect(denied.code).toBe(2);
    expect(denied.stderr).toContain('COMMANDER GUARD // DENIED');
  });

  it.each([
    ['exits with code 1', 'process.exit(1);'],
    ['has a syntax error', 'this is not javascript ('],
    ['throws', 'throw new Error("boom");'],
    ['is killed by a signal', 'process.kill(process.pid, "SIGKILL");'],
  ])('blocks when the hook %s, where a bare node run would have let the call through', (_why, body) => {
    const crashing = script(`crash-${Math.random().toString(36).slice(2)}.js`, body);
    const bare_ = spawnSync(process.execPath, [crashing], { cwd: bare, encoding: 'utf8', input: '{}' });
    expect(bare_.status, 'the unprotected exit code').not.toBe(2);
    expect(bare_.status, 'the unprotected exit code').not.toBe(0);
    expect(viaShell(crashing).code).toBe(2);
  });

  it('blocks when the hook file is missing', () => {
    expect(viaShell(path.join(bare, 'does-not-exist.js')).code).toBe(2);
  });

  it('blocks when node itself cannot be found', () => {
    const r = spawnSync('/bin/sh', ['-c', commandFor(hook)], { cwd: bare, input: JSON.stringify(bash('ls')), env: { PATH: '/nonexistent', ...local }, encoding: 'utf8', timeout: 30_000 });
    expect(r.status).toBe(2);
  });

  it('does not turn a hook that exits 0 into a block', () => {
    expect(viaShell(script('allow.js', 'process.exit(0);')).code).toBe(0);
  });
});
