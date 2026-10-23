'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { build } = require('../src/build');

test('full build produces SEO outputs and no broken links', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pressy-'));
  const r = await build({ root: path.join(__dirname, '..'), outDir: out, quiet: true });
  assert.ok(r.posts.length > 0);
  for (const f of ['sitemap.xml', 'robots.txt', 'feed.xml', 'llms.txt', '_headers', '_redirects', 'api/content.json', 'admin/data.json', '404.html']) {
    assert.ok(fs.existsSync(path.join(out, f)), f);
  }
  const home = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(home, /<link rel="canonical" href="https:\/\/[^"]+\/">/);
  assert.match(home, /application\/ld\+json/);
  assert.match(fs.readFileSync(path.join(out, '_headers'), 'utf8'), /Content-Security-Policy: default-src 'self'/);
  assert.match(fs.readFileSync(path.join(out, 'robots.txt'), 'utf8'), /Sitemap: /);
  fs.rmSync(out, { recursive: true, force: true });
});

test('every theme builds', async () => {
  for (const theme of fs.readdirSync(path.join(__dirname, '..', 'themes'))) {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pressy-'));
    await build({ root: path.join(__dirname, '..'), outDir: out, quiet: true, theme });
    fs.rmSync(out, { recursive: true, force: true });
  }
});
