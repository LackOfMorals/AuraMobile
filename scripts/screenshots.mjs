#!/usr/bin/env node
// Runs the app in the iOS simulators and saves a screenshot of each screen on each device size, appearance and text size, so
// layout problems on a form factor are found by looking, not by luck. Repeatable: `npm run screenshots`.
//
//   npm run screenshots                          every variant in scripts/screenshots.config.json
//   npm run screenshots -- --variant=standard    one variant (comma-separated for several)
//   npm run screenshots -- --devices=ipad-mini,iphone-17e --screens=Home,Create
//   npm run screenshots -- --no-build            reuse the last Debug build
//   npm run screenshots -- --update-baseline     keep this run as the baseline later runs are compared with
//
// Output: screenshots/runs/<time>/<variant>/<device>/<Screen>.png and an index.html contact sheet per variant (open it in a
// browser). Each screenshot is compared pixel by pixel with screenshots/baseline: same, changed or new. Differences under a
// tenth of a percent of the pixels and three colour levels (the blur behind a Back button, say) count as the same. The status bar is fixed
// (9:41, full battery) so it does not differ between runs. Screens that show a time since the last sync (Account, Operations)
// can show as changed on their own.
//
// Do not edit files in the project while a run is going: the development server refreshes the app and a blue "Refreshing…"
// strip appears in the screenshots.
//
// The app skips Face ID and opens a screen through launch switches that exist only in Debug builds (src/dev/launchArgs.ts).
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { diffPng, isNoise } from './pixeldiff.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'scripts/screenshots.config.json'), 'utf8'));
const args = Object.fromEntries(process.argv.slice(2).map(a => (a.startsWith('--') ? a.slice(2).split('=') : [a, true])).map(([k, v]) => [k, v ?? true]));
const list = v => (typeof v === 'string' ? v.split(',').filter(Boolean) : undefined);

const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const simctl = (...argv) => run('xcrun', ['simctl', ...argv]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');

const variantNames = list(args.variant) ?? Object.keys(config.variants);
for (const v of variantNames) {
  if (!config.variants[v]) throw new Error(`Unknown variant "${v}". Known: ${Object.keys(config.variants).join(', ')}`);
}
const screens = list(args.screens) ?? config.screens;
const wantedDevices = list(args.devices);
for (const d of wantedDevices ?? []) {
  if (!config.devices[d]) throw new Error(`Unknown device "${d}". Known: ${Object.keys(config.devices).join(', ')}`);
}

/** The simulator UDID for a device name, from the newest iOS runtime that has it. */
function udidFor(name) {
  const all = JSON.parse(simctl('list', 'devices', 'available', '--json')).devices;
  const runtimes = Object.keys(all).filter(r => r.includes('iOS')).sort().reverse();
  for (const r of runtimes) {
    const found = all[r].find(d => d.name === name);
    if (found) return found.udid;
  }
  throw new Error(`No available simulator named "${name}". Install it in Xcode, or change scripts/screenshots.config.json.`);
}

const metroUp = () =>
  new Promise(resolve => {
    const req = http.get('http://localhost:8081/status', res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => resolve(body.includes('packager-status:running')));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => (req.destroy(), resolve(false)));
  });

let metro;
async function ensureMetro() {
  if (await metroUp()) return;
  console.log('Starting Metro…');
  metro = spawn('npx', ['react-native', 'start'], { cwd: root, stdio: 'ignore', detached: true });
  for (let i = 0; i < 60; i++) {
    if (await metroUp()) return;
    await sleep(1000);
  }
  throw new Error('Metro did not start.');
}

const derived = join(root, 'ios/build/screenshots');
const appPath = join(derived, 'Build/Products/Debug-iphonesimulator/AuraMobile.app');
function build() {
  console.log('Building the Debug app for the simulator…');
  run('xcodebuild', ['-workspace', 'ios/AuraMobile.xcworkspace', '-scheme', 'AuraMobile', '-configuration', 'Debug', '-sdk', 'iphonesimulator', '-derivedDataPath', derived, 'build', '-quiet'], { cwd: root, maxBuffer: 1 << 28 });
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const runDir = join(root, 'screenshots/runs', stamp);
const baselineDir = join(root, 'screenshots/baseline');
const results = [];

async function main() {
  if (!args['no-build']) build();
  if (!existsSync(appPath)) throw new Error(`No built app at ${appPath}. Run without --no-build.`);
  await ensureMetro();

  for (const variantName of variantNames) {
    const v = config.variants[variantName];
    const devices = (wantedDevices ?? v.devices).filter(d => v.devices.includes(d) || wantedDevices);
    for (const key of devices) {
      const udid = udidFor(config.devices[key]);
      console.log(`\n${variantName} / ${key} (${config.devices[key]})`);
      try { simctl('boot', udid); } catch { /* already booted */ }
      simctl('bootstatus', udid, '-b');
      simctl('ui', udid, 'appearance', v.appearance);
      simctl('ui', udid, 'content_size', v.textSize);
      simctl('status_bar', udid, 'override', '--time', '9:41', '--batteryState', 'charged', '--batteryLevel', '100', '--wifiBars', '3', '--cellularMode', 'active', '--cellularBars', '4', '--operatorName', '');
      // A clean install each time: no leftover data, and no remembered window size from an earlier run
      try { simctl('uninstall', udid, config.bundleId); } catch { /* not installed */ }
      simctl('install', udid, appPath);
      const dir = join(runDir, variantName, key);
      mkdirSync(dir, { recursive: true });
      for (const screen of screens) {
        simctl('launch', '--terminate-running-process', udid, config.bundleId, '-JaxSkipLock', '1', '-JaxDemo', '1', '-JaxScreen', screen);
        await sleep((args.delay ? Number(args.delay) : config.settleSeconds) * 1000);
        const file = join(dir, `${screen}.png`);
        simctl('io', udid, 'screenshot', file);
        const base = join(baselineDir, variantName, key, `${screen}.png`);
        const status = !existsSync(base) ? 'new' : sha(base) === sha(file) || isNoise(diffPng(base, file)) ? 'same' : 'changed';
        results.push({ variant: variantName, device: key, screen, file, status });
        console.log(`  ${screen.padEnd(11)} ${status}`);
      }
      simctl('status_bar', udid, 'clear');
    }
  }
  simctl('ui', 'booted', 'content_size', 'large');
  simctl('ui', 'booted', 'appearance', 'light');
}

function contactSheet(variantName) {
  const rows = results.filter(r => r.variant === variantName);
  const devices = [...new Set(rows.map(r => r.device))];
  const scr = [...new Set(rows.map(r => r.screen))];
  const cell = (d, s) => {
    const r = rows.find(x => x.device === d && x.screen === s);
    return r ? `<td class="${r.status}"><img src="${relative(join(runDir, variantName), r.file)}" loading="lazy"><div>${r.status}</div></td>` : '<td></td>';
  };
  const html = `<!doctype html><meta charset="utf-8"><title>Jax screenshots: ${variantName}</title>
<style>body{font:14px system-ui;margin:16px}table{border-collapse:collapse}td,th{padding:6px;vertical-align:top;text-align:center}img{height:520px;border:1px solid #888}
.changed div{color:#b00;font-weight:700}.new div{color:#06c}.same div{color:#080}</style>
<h1>${variantName}</h1><table><tr><th></th>${devices.map(d => `<th>${d}</th>`).join('')}</tr>
${scr.map(s => `<tr><th>${s}</th>${devices.map(d => cell(d, s)).join('')}</tr>`).join('\n')}</table>`;
  writeFileSync(join(runDir, variantName, 'index.html'), html);
}

try {
  await main();
} finally {
  if (metro) process.kill(-metro.pid);
}
for (const v of variantNames) contactSheet(v);

if (args['update-baseline']) {
  for (const r of results) {
    const dest = join(baselineDir, r.variant, r.device, `${r.screen}.png`);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(r.file, dest);
  }
  console.log(`\nBaseline updated with ${results.length} screenshots.`);
}
const count = s => results.filter(r => r.status === s).length;
console.log(`\n${results.length} screenshots: ${count('same')} same, ${count('changed')} changed, ${count('new')} new.`);
console.log(`Contact sheets: ${variantNames.map(v => join(runDir, v, 'index.html')).join('\n                ')}`);
process.exitCode = 0;
