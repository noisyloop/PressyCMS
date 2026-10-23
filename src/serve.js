'use strict';
/* Local dev server: builds, serves dist/, rebuilds when content, themes,
   plugins, static files or config change. Not meant for production — deploy
   dist/ to any static host instead. */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { build } = require('./build');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.woff2': 'font/woff2'
};

async function serve({ root = process.cwd(), port = 4321, host = '127.0.0.1', watch = true, theme } = {}) {
  const dist = path.join(root, 'dist');
  const safeBuild = async () => {
    try { await build({ root, includeDrafts: true, theme }); } catch (e) { console.error('✖ Build failed:\n' + e.message); }
  };
  await safeBuild();

  const server = http.createServer((req, res) => {
    let urlPath;
    try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
    let file = path.normalize(path.join(dist, urlPath));
    if (file !== dist && !file.startsWith(dist + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      const notFound = path.join(dist, '404.html');
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(port, host, resolve));
  console.log(`\n  PressyCMS dev server → http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/   (dashboard: /admin/)\n`);

  if (watch) {
    let timer = null;
    for (const dir of ['content', 'themes', 'plugins', 'static', 'src']) {
      const full = path.join(root, dir);
      if (!fs.existsSync(full)) continue;
      fs.watch(full, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(safeBuild, 150); });
    }
    for (const f of ['pressy.config.json', 'redirects.json']) {
      if (fs.existsSync(path.join(root, f))) fs.watch(path.join(root, f), () => { clearTimeout(timer); timer = setTimeout(safeBuild, 150); });
    }
  }
  return server;
}

module.exports = { serve };
