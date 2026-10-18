// Checks run on every push (see workflows/check.yml). GitHub Pages publishes main as it is, with no
// build step, so these catch what would break the live site: a syntax error in a script, a broken JSON
// file, or a path to a file that does not exist. A missing file in ASSETS (sw.js) makes the service
// worker fail to install, and the site silently stops working offline.
// Run it locally from the repository root: node .github/check.mjs
// The same file is in the bingo, generala and truco repositories.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const errors = [];
const fail = (message) => errors.push(message);
const exists = (path) => existsSync(path.replace(/^\.\//, '') || '.');
const isLocal = (url) => !/^(https?:|data:|mailto:|#)/.test(url);
const root = readdirSync('.');

// 1. Every script parses.
for (const file of root.filter((name) => name.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) fail(`${file}: syntax error\n${result.stderr.trim()}`);
}

// 2. Every JSON file and the manifest parse, and the manifest icons exist.
for (const file of root.filter((name) => name.endsWith('.json') || name.endsWith('.webmanifest'))) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (file.endsWith('.webmanifest')) {
      (data.icons ?? []).forEach(({ src }) => {
        if (!exists(src)) fail(`${file}: icon ${src} does not exist`);
      });
    }
  } catch (error) {
    fail(`${file}: invalid JSON (${error.message})`);
  }
}

// 3. Every local file that index.html loads exists, and nothing inline would be blocked by the CSP.
const html = readFileSync('index.html', 'utf8');
for (const [, url] of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
  const path = url.split(/[?#]/)[0];
  if (isLocal(url) && path && !exists(path)) fail(`index.html: ${url} does not exist`);
}
if (/<script(?![^>]*\ssrc=)[^>]*>/.test(html)) fail('index.html: inline <script> (the CSP blocks it)');
if (/\sstyle="/.test(html)) fail('index.html: style attribute (the CSP blocks it)');
if (/\son[a-z]+="/.test(html)) fail('index.html: inline event handler (the CSP blocks it)');

// 4. Every file the service worker caches exists.
const sw = readFileSync('sw.js', 'utf8');
const assets = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
if (!assets) fail('sw.js: ASSETS list not found');
else {
  for (const [, path] of assets[1].matchAll(/'([^']+)'/g)) {
    if (!exists(path)) fail(`sw.js: ASSETS has ${path}, which does not exist`);
  }
}

if (errors.length) {
  console.error(errors.map((message) => `✗ ${message}`).join('\n'));
  process.exit(1);
}
console.log('✓ scripts, JSON, index.html references and service worker assets are fine');
