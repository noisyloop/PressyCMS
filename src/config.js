'use strict';
/* Loads and validates pressy.config.json. Bad config fails the build loudly
   instead of producing a half-broken site. */

const fs = require('fs');
const path = require('path');
const { safeUrl } = require('./shared/pressy-core');

const DEFAULTS = {
  site: {
    title: 'PressyCMS',
    tagline: '',
    description: '',
    url: 'http://localhost:4321',
    language: 'en',
    author: 'PressyCMS',
    logo: ''
  },
  theme: 'pressy',
  plugins: [],
  pluginOptions: {},
  nav: [],
  postsPerPage: 6,
  markdown: { allowRawHtml: false },
  admin: { enabled: true },
  github: { repo: '', branch: 'main', contentDir: 'content' },
  agents: { allowed: ['claude'], allowWrite: true },
  security: { contentSecurityPolicy: '' }
};

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

function merge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over || {})) out[k] = merge(base[k], over[k]);
  return out;
}

function loadConfig(root) {
  const file = path.join(root, 'pressy.config.json');
  if (!fs.existsSync(file)) throw new Error(`No pressy.config.json found in ${root}`);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`pressy.config.json: ${e.message}`); }
  const config = merge(DEFAULTS, raw);

  const errors = [];
  if (!/^https?:\/\/[^\s/]+[^\s]*$/.test(config.site.url)) errors.push('site.url must be an absolute http(s) URL');
  config.site.url = config.site.url.replace(/\/+$/, '');
  if (!NAME_RE.test(config.theme)) errors.push(`theme "${config.theme}" is not a valid name`);
  if (!Array.isArray(config.plugins)) errors.push('plugins must be an array');
  for (const p of config.plugins || []) if (!NAME_RE.test(p)) errors.push(`plugin "${p}" is not a valid name`);
  if (!Number.isInteger(config.postsPerPage) || config.postsPerPage < 1) errors.push('postsPerPage must be a positive integer');
  if (config.github.repo && !/^[\w.-]+\/[\w.-]+$/.test(config.github.repo)) errors.push('github.repo must look like "owner/name"');
  if (!/^[\w./-]+$/.test(config.github.branch)) errors.push('github.branch is not a valid branch name');
  for (const item of config.nav) {
    if (!item || !item.label || !item.href) { errors.push('every nav item needs a label and href'); continue; }
    if (safeUrl(item.href) !== item.href) errors.push(`nav href "${item.href}" uses a disallowed scheme`);
  }
  if (errors.length) throw new Error('pressy.config.json:\n  ' + errors.join('\n  '));
  return config;
}

module.exports = { loadConfig, DEFAULTS };
