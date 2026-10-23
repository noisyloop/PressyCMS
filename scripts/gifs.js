#!/usr/bin/env node
'use strict';
/* Records the animated GIFs in the README.
   Needs Playwright (`npm i -D playwright`) and ffmpeg on PATH. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { build } = require('../src/build');
const { serve } = require('../src/serve');

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch {
  console.error('ffmpeg is required to make GIFs.');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const out = path.join(root, 'docs', 'gifs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pressy-gifs-'));
const PORT = 4798;
const BASE = `http://127.0.0.1:${PORT}`;
const SIZE = { width: 1280, height: 800 };
const DEMO = path.join(root, 'content', 'posts', 'pressycms-live-demo.md');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toGif(video, name, startSec, width = 960, fps = 10) {
  const file = path.join(out, name);
  const filters = `fps=${fps},scale=${width}:-1:flags=lanczos`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', startSec.toFixed(2), '-i', video,
    '-vf', `${filters},split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    '-loop', '0', file]);
  console.log(`  ✓ ${name} (${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB)`);
}

// Runs one scripted scene in its own recorded browser context.
async function record(browser, name, scene, opts = {}) {
  const context = await browser.newContext({ viewport: SIZE, colorScheme: 'light', recordVideo: { dir: tmp, size: SIZE } });
  const page = await context.newPage();
  const t0 = Date.now();
  let start = 0;
  const ready = () => { start = (Date.now() - t0) / 1000; };
  await scene(page, ready);
  await sleep(1200); // hold the last frame
  const video = await page.video().path();
  await context.close();
  toGif(video, name, start, opts.width, opts.fps);
}

async function typeSlowly(locator, text, delay = 45) {
  await locator.click();
  await locator.pressSequentially(text, { delay });
}

const SCENES = {
  // Elementor-style editor: templates, drag and drop, live preview, SEO hints.
  async 'editor.gif'(page, ready) {
    await page.goto(BASE + '/admin/#new', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    ready();
    await sleep(500);
    await typeSlowly(page.getByPlaceholder('Add title'), 'PressyCMS: lorem ipsum');
    await sleep(300);
    const ta = page.locator('.ed-panes textarea');
    await page.getByRole('button', { name: /Hero/ }).dragTo(ta);
    await sleep(900);
    if (!(await ta.inputValue()).includes(':::hero')) await page.getByRole('button', { name: /Hero/ }).click();
    await sleep(700);
    await ta.press('Control+End');
    await ta.pressSequentially('\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n', { delay: 25 });
    await sleep(400);
    await page.getByRole('button', { name: /Callout/ }).click();
    await sleep(900);
    await page.getByRole('button', { name: /Card grid/ }).click();
    await sleep(900);
    await page.locator('.ed-preview').evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
    await sleep(900);
    await typeSlowly(page.locator('.ed-panel.right textarea'), 'Lorem ipsum dolor sit amet, consectetur adipiscing elit — built from PressyCMS blocks.', 18);
    await sleep(600);
    await page.getByRole('button', { name: 'Preview' }).click();
    await sleep(1400);
    await page.getByRole('button', { name: 'Split' }).click();
  },

  // Write a markdown file → the dev server rebuilds → the post is live.
  async 'markdown-to-page.gif'(page, ready) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    ready();
    await sleep(900);
    fs.writeFileSync(DEMO, `---
title: "PressyCMS: live demo"
description: "Lorem ipsum dolor sit amet — this post was created by saving one markdown file. No database, no admin login."
date: ${new Date().toISOString().slice(0, 10)}
category: Lorem Ipsum
tags: [PressyCMS, Markdown]
featured: true
---

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.

:::callout type="success" title="PressyCMS"
This page is one markdown file. Save it and the site updates.
:::

## PressyCMS: dolor sit amet

::::columns
:::col
### Lorem
Ut enim ad minim veniam, quis nostrud exercitation.
:::
:::col
### Ipsum
Duis aute irure dolor in reprehenderit in voluptate.
:::
::::
`);
    await sleep(1500); // watcher debounce + rebuild
    // Show the markdown source as an "editor" view.
    const source = fs.readFileSync(DEMO, 'utf8');
    await page.setContent(`<body style="margin:0;background:#1d2327;color:#f0f0f1;font:17px/1.6 ui-monospace,Menlo,monospace"><div style="padding:10px 24px;background:#2c3338;color:#a7aaad;font-size:14px">content/posts/pressycms-live-demo.md — saved ✓</div><pre id="src" style="margin:0;padding:20px 32px;white-space:pre-wrap"></pre></body>`);
    await page.locator('#src').evaluate((el, text) => { el.textContent = text; }, source);
    await sleep(2600);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await sleep(1400);
    await page.getByRole('link', { name: 'PressyCMS: live demo' }).first().click();
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await page.mouse.wheel(0, 420);
    await sleep(900);
    // Clean up so later scenes don't show the demo post.
    fs.unlinkSync(DEMO);
    await sleep(600);
    await build({ root, quiet: true });
  },

  // Same content, two themes.
  async 'themes.gif'(page, ready) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    ready();
    await sleep(1400);
    await build({ root, theme: 'paper', quiet: true });
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(1600);
    await build({ root, quiet: true });
    await page.goto(BASE + '/lorem-ipsum-dolor-sit-amet/', { waitUntil: 'networkidle' });
    await sleep(1400);
    await build({ root, theme: 'paper', quiet: true });
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(1600);
    await build({ root, quiet: true });
  },

  // WordPress-style dashboard tour.
  async 'admin-tour.gif'(page, ready) {
    await page.goto(BASE + '/admin/', { waitUntil: 'networkidle' });
    ready();
    await sleep(1300);
    for (const item of ['Posts', 'Appearance', 'Plugins', 'Site Health', 'Claude']) {
      await page.locator('.menu a', { hasText: item }).click();
      await sleep(item === 'Posts' ? 600 : 1300);
      if (item === 'Posts') {
        await page.locator('tbody tr').nth(1).hover();
        await sleep(1000);
      }
    }
    await page.locator('.menu a', { hasText: 'Dashboard' }).click();
    await sleep(600);
  },

  // Instant client-side search.
  async 'search.gif'(page, ready) {
    await page.goto(BASE + '/search/', { waitUntil: 'networkidle' });
    ready();
    await sleep(600);
    await typeSlowly(page.locator('#search-q'), 'lorem', 160);
    await sleep(1100);
    await page.locator('#search-q').fill('');
    await typeSlowly(page.locator('#search-q'), 'faq', 160);
    await sleep(900);
  }
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const only = process.argv.slice(2);
  await build({ root, quiet: true });
  const server = await serve({ root, port: PORT, watch: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    for (const [name, scene] of Object.entries(SCENES)) {
      if (only.length && !only.includes(name)) continue;
      await record(browser, name, scene);
    }
  } finally {
    await browser.close();
    if (fs.existsSync(DEMO)) fs.unlinkSync(DEMO);
    await build({ root, quiet: true });
    server.closeAllConnections();
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('GIFs written to docs/gifs/');
  process.exit(0);
})().catch((e) => { console.error(e); if (fs.existsSync(DEMO)) fs.unlinkSync(DEMO); process.exit(1); });
