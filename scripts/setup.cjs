#!/usr/bin/env node
/**
 * One-step setup for a new machine.
 *
 * Usage:  node scripts/setup.cjs
 *
 * What it does:
 *   1. Sets ELECTRON_MIRROR to npmmirror.com if not already set
 *   2. Pre-downloads Electron binary from the mirror
 *   3. Runs `npm install` (triggers postinstall → extracts Electron + builds kun)
 *   4. Verifies Electron binary is in place
 */

const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
}

// ---- Guard: only run when executed directly (not on require) ------------
if (require.main !== module) {
  console.warn('[setup] This script is designed to be run directly, not required.');
  module.exports = { run };
  return;
}

// ---- 1. Ensure Chinese mirror for Electron downloads --------------------
if (!process.env.ELECTRON_MIRROR && !process.env.npm_config_electron_mirror) {
  process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
  console.log('[setup] Set ELECTRON_MIRROR to https://npmmirror.com/mirrors/electron/');
}

// ---- 2. Pre-download Electron zip to cache ------------------------------
console.log('\n[setup] Step 1/3: Pre-downloading Electron binary...');
const fetchResult = run('node', [join(__dirname, 'fetch-electron.cjs')], {
  env: { ...process.env },
});
if (fetchResult.status !== 0) {
  console.warn('[setup] ⚠ Electron pre-download had issues; continuing anyway...');
}

// ---- 3. npm install (triggers postinstall → extract + build kun) --------
console.log('\n[setup] Step 2/3: Installing dependencies...');
const installResult = run('npm', ['install'], {
  env: { ...process.env },
});
if (installResult.status !== 0) {
  console.error('[setup] ✗ npm install failed');
  process.exit(installResult.status || 1);
}

// ---- 4. Verify Electron binary ------------------------------------------
console.log('\n[setup] Step 3/3: Verifying Electron binary...');
const electronDist = join(ROOT, 'node_modules', 'electron', 'dist');
const electronExe = join(electronDist, process.platform === 'win32' ? 'electron.exe' : 'electron');
const hasElectron = existsSync(electronExe);

if (!hasElectron) {
  console.log('[setup] Electron binary still missing — re-running postinstall...');
  const postResult = run('node', [join(__dirname, 'postinstall.cjs')], {
    env: { ...process.env },
  });
  if (postResult.status !== 0) {
    console.error('[setup] ✗ Postinstall failed. Try manually:');
    console.error('   node scripts/fetch-electron.cjs');
    console.error('   node scripts/postinstall.cjs');
    process.exit(1);
  }
}

// ---- Done ---------------------------------------------------------------
const verResult = spawnSync('node', [
  '-e', 'console.log(require("electron/package.json").version)',
], { cwd: ROOT, stdio: 'pipe', shell: true });
const electronVer = (verResult.stdout || '').toString().trim() || 'unknown';

console.log('');
console.log('[setup] ──────────────────────────────────────────');
console.log('[setup]   ✅ Setup complete!');
console.log(`[setup]   Electron v${electronVer} ready`);
console.log('[setup]   Run:  npm run dev');
console.log('[setup]   Or:   npm run build');
console.log('[setup] ──────────────────────────────────────────');
