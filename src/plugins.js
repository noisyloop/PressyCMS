'use strict';
/* Plugin host. WordPress-style actions and filters, but every plugin declares
   what it needs in plugin.json and the API refuses anything it didn't ask for.

   Plugins run only at build time (in CI or on your machine) — never on the
   live site — so a plugin bug can't open a hole in production. */

const fs = require('fs');
const path = require('path');

const PERMISSIONS = {
  filters: 'Modify posts, template data and rendered HTML',
  blocks: 'Register new content blocks',
  files: 'Write extra files into the build output',
  pages: 'Add new HTML pages rendered with the active theme',
  assets: 'Load its own CSS/JS on every page',
  redirects: 'Add redirects',
  headers: 'Change HTTP response headers'
};

function safeOutPath(rel) {
  const norm = path.posix.normalize(String(rel).replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!norm || norm.startsWith('..') || norm.includes('/../') || norm.includes('\0')) throw new Error(`refusing to write outside the build directory: ${rel}`);
  return norm;
}

function readManifest(dir, name) {
  const file = path.join(dir, 'plugin.json');
  if (!fs.existsSync(file)) throw new Error(`plugin "${name}" has no plugin.json`);
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (m.name !== name) throw new Error(`plugin.json name "${m.name}" does not match folder "${name}"`);
  for (const p of m.permissions || []) if (!PERMISSIONS[p]) throw new Error(`plugin "${name}" requests unknown permission "${p}"`);
  return { version: '0.0.0', description: '', permissions: [], ...m };
}

function listPlugins(root) {
  const dir = path.join(root, 'plugins');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    try { return { ...readManifest(path.join(dir, d.name), d.name), dir: path.join(dir, d.name) }; } catch (e) { return { name: d.name, error: e.message }; }
  });
}

function createHost({ root, config, blocks }) {
  const filters = {};
  const actions = {};
  const state = { files: [], pages: [], scripts: [], styles: [], redirects: [], assetDirs: [], headers: [], loaded: [] };

  const add = (table, hook, fn, priority, owner) => {
    (table[hook] = table[hook] || []).push({ fn, priority, owner });
    table[hook].sort((a, b) => a.priority - b.priority);
  };

  function load(name) {
    const dir = path.join(root, 'plugins', name);
    if (!fs.existsSync(dir)) throw new Error(`plugin "${name}" is enabled in pressy.config.json but plugins/${name}/ does not exist`);
    const manifest = readManifest(dir, name);
    const perms = new Set(manifest.permissions);
    const need = (perm, what) => { if (!perms.has(perm)) throw new Error(`plugin "${name}" tried to ${what} without the "${perm}" permission in plugin.json`); };
    const prefix = `/plugins/${name}/`;
    const api = Object.freeze({
      name,
      root,
      site: Object.freeze({ ...config.site }),
      options: Object.freeze({ ...(config.pluginOptions[name] || {}) }),
      addFilter(hook, fn, priority = 10) { need('filters', `add filter "${hook}"`); add(filters, hook, fn, priority, name); },
      addAction(hook, fn, priority = 10) { add(actions, hook, fn, priority, name); },
      registerBlock(blockName, def) {
        need('blocks', `register block "${blockName}"`);
        if (!/^[a-z][a-z0-9-]*$/.test(blockName)) throw new Error(`plugin "${name}": invalid block name "${blockName}"`);
        if (blocks[blockName]) throw new Error(`plugin "${name}": block "${blockName}" already exists`);
        if (typeof def.render !== 'function') throw new Error(`plugin "${name}": block "${blockName}" needs a render()`);
        blocks[blockName] = { attrs: {}, category: 'plugin', icon: '🧩', description: '', example: `:::${blockName}\n:::`, ...def, plugin: name };
      },
      emitFile(rel, contents) { need('files', `write ${rel}`); state.files.push({ path: safeOutPath(rel), contents, owner: name }); },
      addPage(page) { need('pages', `add page ${page.path}`); state.pages.push({ ...page, path: '/' + safeOutPath(page.path).replace(/\/?$/, '/'), owner: name }); },
      addScript(file) { need('assets', `load script ${file}`); state.scripts.push(prefix + safeOutPath(file)); },
      addStyle(file) { need('assets', `load stylesheet ${file}`); state.styles.push(prefix + safeOutPath(file)); },
      addRedirect(from, to, status = 301) {
        need('redirects', `add redirect ${from}`);
        if (!/^\/[\w\-./*:]*$/.test(from) || /\s/.test(to) || ![301, 302, 307, 308].includes(status)) throw new Error(`plugin "${name}": invalid redirect ${from} → ${to}`);
        state.redirects.push({ from, to, status });
      },
      addHeader(header, value) {
        need('headers', `set header ${header}`);
        if (!/^[A-Za-z][\w-]*$/.test(header) || /[\r\n]/.test(String(value))) throw new Error(`plugin "${name}": invalid header ${header}`);
        state.headers.push({ header, value: String(value) });
      }
    });
    const entry = path.join(dir, 'index.js');
    const register = require(entry);
    if (typeof register !== 'function') throw new Error(`plugin "${name}": index.js must export a function`);
    register(api);
    if (perms.has('assets') && fs.existsSync(path.join(dir, 'assets'))) state.assetDirs.push({ from: path.join(dir, 'assets'), to: `plugins/${name}` });
    state.loaded.push({ ...manifest, enabled: true });
  }

  for (const name of config.plugins) load(name);

  return {
    state,
    async applyFilters(hook, value, ...args) {
      for (const { fn, owner } of filters[hook] || []) {
        try { const r = await fn(value, ...args); if (r !== undefined) value = r; } catch (e) { throw new Error(`plugin "${owner}" failed in filter "${hook}": ${e.message}`); }
      }
      return value;
    },
    async doAction(hook, ...args) {
      for (const { fn, owner } of actions[hook] || []) {
        try { await fn(...args); } catch (e) { throw new Error(`plugin "${owner}" failed in action "${hook}": ${e.message}`); }
      }
    }
  };
}

module.exports = { createHost, listPlugins, PERMISSIONS, safeOutPath };
