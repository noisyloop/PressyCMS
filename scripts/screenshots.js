#!/usr/bin/env node
'use strict';
/* Regenerates README screenshots and theme thumbnails.
   Needs Playwright: `npm i -D playwright` (or a global install). */

const fs = require('fs');
const path = require('path');
const { build } = require('../src/build');

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const out = path.join(root, 'docs', 'screenshots');
const PORT = 4799;

async function withServer(theme, fn) {
  await build({ root, theme, quiet: true });
  const { serve } = require('../src/serve');
  const server = await serve({ root, port: PORT, watch: false, theme });
  try { await fn(`http://127.0.0.1:${PORT}`); } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); }
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, colorScheme: 'light', deviceScaleFactor: 1 });
  const shot = async (url, file, opts = {}) => {
    await page.goto(url, { waitUntil: 'networkidle' });
    if (opts.before) await opts.before(page);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, file), fullPage: !!opts.full });
    console.log('  ✓', file);
  };

  await withServer('pressy', async (base) => {
    await shot(base + '/', 'home.png');
    await shot(base + '/lorem-ipsum-dolor-sit-amet/', 'post.png');
    await shot(base + '/about/', 'landing.png', { full: true });
    await shot(base + '/blocks/', 'blocks.png', { full: true });
    await shot(base + '/search/?q=lorem', 'search.png');
    await shot(base + '/admin/', 'admin-dashboard.png');
    await shot(base + '/admin/#posts', 'admin-posts.png');
    await shot(base + '/admin/#new', 'admin-editor.png', {
      before: async (p) => {
        await p.evaluate(() => localStorage.clear());
        await p.reload({ waitUntil: 'networkidle' });
        p.once('dialog', (d) => d.accept());
        await p.getByRole('button', { name: '🚀 Landing page' }).click();
        await p.getByPlaceholder('Add title').fill('PressyCMS landing page');
        await p.locator('.ed-panel.right textarea').fill('Lorem ipsum dolor sit amet, consectetur adipiscing elit — a PressyCMS landing page built from blocks.');
      }
    });
    await shot(base + '/admin/#appearance', 'admin-themes.png');
    await shot(base + '/admin/#plugins', 'admin-plugins.png');
    await shot(base + '/admin/#agents', 'admin-claude.png');
    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(base + '/lorem-ipsum-dolor-sit-amet/', 'mobile.png');
    await page.setViewportSize({ width: 1360, height: 900 });
    // Theme thumbnail
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(root, 'themes', 'pressy', 'screenshot.png') });
  });

  await withServer('paper', async (base) => {
    await shot(base + '/', 'theme-paper-home.png');
    await shot(base + '/lorem-ipsum-dolor-sit-amet/', 'theme-paper-post.png');
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(root, 'themes', 'paper', 'screenshot.png') });
  });

  await browser.close();
  await build({ root, quiet: true }); // leave dist/ on the configured theme
  console.log('Screenshots written to docs/screenshots/');
})().catch((e) => { console.error(e); process.exit(1); });
