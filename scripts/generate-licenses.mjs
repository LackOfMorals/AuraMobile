// Builds src/legal/licenses.json: the open-source licences for what ships in the app.
//
// JavaScript: the packages that are really in a production bundle, read from its source map, not every installed package.
// Native: the CocoaPods acknowledgements that `pod install` writes.
// Run it after adding or upgrading a dependency:  node scripts/generate-licenses.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), 'licenses-'));

execFileSync('npx', ['react-native', 'bundle', '--platform', 'ios', '--dev', 'false', '--entry-file', 'index.js', '--bundle-output', join(work, 'main.jsbundle'), '--sourcemap-output', join(work, 'main.map')], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });

const map = JSON.parse(readFileSync(join(work, 'main.map'), 'utf8'));
const sources = map.sources ?? map.sections.flatMap((s) => s.map.sources);
const names = [...new Set(sources.map((s) => /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(s)?.[1]).filter(Boolean))].sort();

const texts = new Map(); // hash -> text, so a licence used by many packages is stored once
const textId = (text) => {
  const id = createHash('sha256').update(text).digest('hex').slice(0, 10);
  texts.set(id, text);
  return id;
};

const licenceFile = (dir) => {
  const file = readdirSync(dir).find((f) => /^(licen[sc]e|copying)(\..*)?$/i.test(f));
  return file ? readFileSync(join(dir, file), 'utf8').trim() : undefined;
};

// A few packages declare a licence but ship no licence file. Both MIT and Apache-2.0 need the notice to travel with the code,
// so supply the standard text, say that we did, and use the holder the package declares.
const STANDARD_APACHE = () => readFileSync(join(root, 'LICENSE'), 'utf8').trim();
const holderOf = (pkg) => (typeof pkg.author === 'string' ? pkg.author : pkg.author?.name)?.replace(/\s*[<(].*$/, '');
function fallbackText(name, license, pkg) {
  const note = (holder) => `This package ships no licence file. The standard ${license} text is given here, with the copyright holder the package declares: ${holder}.\n\n`;
  // Meta's own packages: the same monorepo and licence as react-native
  if (license === 'MIT' && (name.startsWith('@react-native/') || name === 'metro-runtime')) {
    return note('Meta Platforms, Inc. and affiliates') + readFileSync(join(root, 'node_modules/react-native/LICENSE'), 'utf8').trim();
  }
  const holder = holderOf(pkg);
  if (!holder) return undefined;
  if (license === 'Apache-2.0') return note(holder) + STANDARD_APACHE();
  if (license === 'MIT') {
    return `${note(holder)}MIT License\n\nCopyright (c) ${holder}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
  }
  return undefined;
}

const packages = names.map((name) => {
  const dir = join(root, 'node_modules', name);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'See package');
  const text = licenceFile(dir) ?? fallbackText(name, license, pkg);
  return { name, version: pkg.version, license, ...(text ? { text: textId(text) } : {}) };
});

// Native pods
const ack = join(root, 'ios/Pods/Target Support Files/Pods-AuraMobile/Pods-AuraMobile-acknowledgements.plist');
const pods = existsSync(ack)
  ? JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', ack])).PreferenceSpecifiers.filter((p) => p.Title && p.FooterText && p.Title !== 'Acknowledgements').map((p) => ({
      name: p.Title,
      license: p.License ?? 'See text',
      text: textId(p.FooterText.trim()),
    }))
  : [];

// The sync and operations logic is derived from grandstack-web-aura, which is Apache-2.0
const derived = {
  name: 'grandstack-web-aura (derived code)',
  version: '',
  license: 'Apache-2.0',
  text: textId(readFileSync(join(root, 'LICENSE'), 'utf8').trim()),
};

const out = { packages: [derived, ...packages], pods, texts: Object.fromEntries(texts) };
writeFileSync(join(root, 'src/legal/licenses.json'), JSON.stringify(out));
const missing = packages.filter((p) => !p.text).map((p) => `${p.name} (${p.license})`);
console.log(`${packages.length} packages, ${pods.length} pods, ${texts.size} distinct licence texts`);
if (missing.length) console.log(`No licence file found for: ${missing.join(', ')}`);
