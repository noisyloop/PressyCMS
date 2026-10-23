'use strict';
const fs = require('fs');
const path = require('path');

module.exports = (pressy) => {
  const file = path.resolve(pressy.root, pressy.options.file || 'redirects.json');
  if (!file.startsWith(pressy.root + path.sep)) throw new Error('redirects: options.file must be inside the project');
  if (!fs.existsSync(file)) return;
  const rules = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [from, rule] of Object.entries(rules)) {
    const { to, status = 301 } = typeof rule === 'string' ? { to: rule } : rule;
    if (!/^(\/|https:\/\/)/.test(to)) throw new Error(`redirects.json: "${from}" must point to a site path or an https URL`);
    pressy.addRedirect(from, to, status);
    // Hosts without _redirects support still get a noindex meta-refresh fallback.
    if (!from.includes('*') && !from.includes(':')) {
      const safe = to.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      pressy.emitFile(path.posix.join(from, 'index.html'),
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${safe}"><link rel="canonical" href="${safe}"><title>Redirecting…</title></head><body><p>Moved to <a href="${safe}">${safe}</a>.</p></body></html>\n`);
    }
  }
};
