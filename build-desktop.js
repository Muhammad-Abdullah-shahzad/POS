/**
 * build-desktop.js
 *
 * One-command build: compiles the React client, compiles the Electron TypeScript,
 * then runs electron-builder to produce a platform installer.
 *
 * Usage (from /POS root):
 *
 *   node build-desktop.js            → builds for the current OS
 *   node build-desktop.js --win      → Windows NSIS installer (.exe)
 *   node build-desktop.js --mac      → macOS DMG (.dmg)
 *   node build-desktop.js --linux    → Linux AppImage + .deb
 *
 * Output: electron/release/
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root     = __dirname;
const client   = path.join(root, 'client');
const electron = path.join(root, 'electron');

function run(label, cmd, cwd) {
  console.log(`\n\x1b[36m▶ ${label}\x1b[0m`);
  console.log(`  ${cmd}\n`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// ── Determine platform flag ───────────────────────────────────────────────────
const arg = process.argv[2] || '';
const platformFlag =
  arg === '--win'   ? '--win'   :
  arg === '--mac'   ? '--mac'   :
  arg === '--linux' ? '--linux' :
  '';                             // no flag = current OS

// ── 1. Build React client ─────────────────────────────────────────────────────
run('Installing client dependencies (if needed)', 'npm install --prefer-offline', client);
run('Building React client (Vite)', 'npm run build', client);

// Sanity-check the client build
const indexHtml = path.join(client, 'dist', 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('\x1b[31m✖ Client build failed — dist/index.html not found\x1b[0m');
  process.exit(1);
}
console.log('\x1b[32m✔ Client built →', path.relative(root, indexHtml), '\x1b[0m');

// ── 2. Compile Electron TypeScript ────────────────────────────────────────────
run('Installing electron dependencies (if needed)', 'npm install --prefer-offline', electron);
run('Compiling Electron TypeScript', 'npm run build', electron);

// ── 3. Run electron-builder ───────────────────────────────────────────────────
const builderCmd = `npx electron-builder ${platformFlag}`.trim();
run(`Packaging installer (${platformFlag || 'current OS'})`, builderCmd, electron);

// ── Done ──────────────────────────────────────────────────────────────────────
const releaseDir = path.join(electron, 'release');
console.log('\n\x1b[32m✔ Done! Installer is in:\x1b[0m', releaseDir);
console.log('');
