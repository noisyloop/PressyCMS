'use strict';
/* The build: content/ + theme + plugins → dist/. No database, no server. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const core = require('./shared/pressy-core');
const { loadConfig } = require('./config');
const { loadContent } = require('./content');
const { createMarkdown } = require('./markdown');
const { createEngine } = require('./template');
const { createHost, listPlugins, PERMISSIONS } = require('./plugins');
const { lintAll } = require('./lint');
const seo = require('./seo');
const pkg = require('../package.json');

const { escapeHtml } = core;

// ---------- fs helpers ----------
const mkdirp = (p) => fs.mkdirSync(p, { recursive: true });
function writeFile(p, contents) { mkdirp(path.dirname(p)); fs.writeFileSync(p, contents); }
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  mkdirp(dest);
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
const hashFile = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 10);

// ---------- themes ----------
function readDirFiles(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.html')) out[f.replace(/\.html$/, '')] = fs.readFileSync(path.join(dir, f), 'utf8');
  return out;
}

function listThemes(root) {
  const dir = path.join(root, 'themes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    const file = path.join(dir, d.name, 'theme.json');
    const meta = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    return { name: d.name, title: meta.title || d.name, version: meta.version || '0.0.0', description: meta.description || '', screenshot: meta.screenshot || '', templates: Object.keys(readDirFiles(path.join(dir, d.name, 'templates'))) };
  });
}

function loadTheme(root, name) {
  const dir = path.join(root, 'themes', name);
  if (!fs.existsSync(dir)) throw new Error(`theme "${name}" not found in themes/`);
  const layoutFile = path.join(dir, 'layout.html');
  if (!fs.existsSync(layoutFile)) throw new Error(`theme "${name}" is missing layout.html`);
  const templates = readDirFiles(path.join(dir, 'templates'));
  for (const required of ['home', 'post', 'page', 'archive']) {
    if (!templates[required]) throw new Error(`theme "${name}" is missing templates/${required}.html`);
  }
  const meta = fs.existsSync(path.join(dir, 'theme.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8')) : {};
  return { name, dir, meta, layout: fs.readFileSync(layoutFile, 'utf8'), templates, partials: readDirFiles(path.join(dir, 'partials')) };
}

// ---------- formatting ----------
const fmtDate = (iso, lang) => (iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString(lang || 'en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '');

function excerpt(doc, len = 180) {
  if (doc.description) return doc.description;
  const text = doc.body.replace(/^:{3,}.*$/gm, '').replace(/```[\s\S]*?```/g, '').replace(/[#>*_`[\]()!-]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > len ? text.slice(0, len).replace(/\s+\S*$/, '') + '…' : text;
}

// ---------- build ----------
async function build({ root = process.cwd(), outDir, includeDrafts = false, quiet = false, theme: themeOverride } = {}) {
  const t0 = Date.now();
  const log = quiet ? () => {} : (...a) => console.log(...a);
  const DIST = outDir || path.join(root, 'dist');
  const config = loadConfig(root);
  if (themeOverride) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(themeOverride)) throw new Error(`invalid theme name "${themeOverride}"`);
    config.theme = themeOverride; // preview another theme without editing config
  }
  const site = { ...config.site, generator: `PressyCMS ${pkg.version}` };

  // Blocks: start from the core library; plugins may add more.
  const blocks = { ...core.BLOCKS };
  const host = createHost({ root, config, blocks });
  const theme = loadTheme(root, config.theme);
  const engine = createEngine({ partials: theme.partials, onMissingPartial: (n) => { throw new Error(`theme "${theme.name}": missing partial "${n}"`); } });
  const renderMd = createMarkdown({ allowRawHtml: config.markdown.allowRawHtml, blocks });

  // Content
  const { docs, errors } = loadContent(root, { includeDrafts });
  if (errors.length) throw new Error('Content errors:\n  ' + errors.join('\n  '));
  const templateNames = Object.keys(theme.templates);
  for (const d of docs) {
    if (!theme.templates[d.template]) throw new Error(`${d.sourceName}: template "${d.template}" not found in theme "${theme.name}" (available: ${templateNames.join(', ')})`);
  }

  log(`→ ${docs.length} documents · theme "${theme.name}" · plugins: ${config.plugins.join(', ') || 'none'}`);
  fs.rmSync(DIST, { recursive: true, force: true });
  mkdirp(DIST);

  const github = config.github.repo ? {
    repo: config.github.repo,
    branch: config.github.branch,
    editBase: `https://github.com/${config.github.repo}/edit/${config.github.branch}/`,
    newBase: `https://github.com/${config.github.repo}/new/${config.github.branch}/`
  } : null;

  // Enrich docs
  let items = [];
  for (const d of docs) {
    const p = `/${d.slug}/`;
    const rel = path.relative(root, d.file).split(path.sep).join('/');
    let doc = {
      ...d,
      path: p,
      url: site.url + p,
      excerpt: excerpt(d),
      dateDisplay: fmtDate(d.date, site.language),
      updatedDisplay: d.updated !== d.date ? fmtDate(d.updated, site.language) : '',
      author: d.author || site.author,
      categoryUrl: d.categorySlug ? `/category/${d.categorySlug}/` : '',
      tags: d.tags.map((t) => ({ ...t, url: `/tag/${t.slug}/` })),
      sourcePath: rel,
      editUrl: github ? github.editBase + rel : '',
      markdownUrl: p + 'index.md'
    };
    doc = await host.applyFilters('post', doc);
    items.push(doc);
  }
  items = await host.applyFilters('docs', items);

  const posts = items.filter((d) => d.type === 'post').sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  const pages = items.filter((d) => d.type === 'page').sort((a, b) => a.menuOrder - b.menuOrder || a.title.localeCompare(b.title));
  posts.forEach((p, i) => { p.newer = posts[i - 1] ? { title: posts[i - 1].title, path: posts[i - 1].path } : null; p.older = posts[i + 1] ? { title: posts[i + 1].title, path: posts[i + 1].path } : null; });

  // Taxonomies
  const taxonomy = (getter) => {
    const map = new Map();
    for (const p of posts) for (const t of getter(p)) {
      if (!map.has(t.slug)) map.set(t.slug, { ...t, posts: [] });
      map.get(t.slug).posts.push(p);
    }
    return [...map.values()].map((t) => ({ ...t, count: t.posts.length })).sort((a, b) => a.name.localeCompare(b.name));
  };
  const categories = taxonomy((p) => (p.categorySlug ? [{ name: p.category, slug: p.categorySlug, url: `/category/${p.categorySlug}/` }] : []));
  const tags = taxonomy((p) => p.tags);

  const ctx = { root, config, site, posts, pages, docs: items, categories, tags, dist: DIST, blocks };
  await host.doAction('build:start', ctx);

  // Render markdown → HTML
  for (const d of items) {
    const rctx = {};
    d.html = renderMd(d.body, rctx);
    d.faq = rctx.collected.faq || [];
  }

  // Assets
  copyDir(path.join(root, 'static'), DIST);
  copyDir(path.join(theme.dir, 'assets'), path.join(DIST, 'theme'));
  for (const a of host.state.assetDirs) copyDir(a.from, path.join(DIST, a.to));
  const fingerprint = (urlPath) => {
    const file = path.join(DIST, urlPath.split('?')[0]);
    return fs.existsSync(file) ? `${urlPath}?v=${hashFile(file)}` : urlPath;
  };
  const styles = ['/assets/css/blocks.css', '/theme/theme.css', ...host.state.styles].map(fingerprint);
  const scripts = host.state.scripts.map(fingerprint);

  const searchEnabled = config.plugins.includes('search');
  const nav = config.nav;
  const recent = posts.slice(0, 5).map((p) => ({ title: p.title, path: p.path, dateDisplay: p.dateDisplay }));
  const year = new Date().getUTCFullYear();

  const pagesOut = []; // for sitemap + link check

  async function renderPage({ template, doc = null, pagePath, title, description, ogType = 'website', image = '', noindex = false, jsonld = [], extra = {} }) {
    const canonical = site.url + pagePath;
    const navItems = nav.map((n) => ({ ...n, active: n.href === pagePath || (n.href !== '/' && pagePath.startsWith(n.href)) }));
    let data = {
      site, nav: navItems, year, searchEnabled,
      assets: { styles, scripts },
      sidebar: { recent, categories: categories.map(({ posts: _, ...c }) => c), tags: tags.map(({ posts: _, ...t }) => t) },
      pages: pages.map((p) => ({ title: p.title, path: p.path })),
      meta: {
        title: title === site.title ? site.title : `${title} — ${site.title}`,
        description: description || site.description,
        canonical, ogType, noindex,
        image: image ? seo.absolute(site, image) : '',
        jsonld: jsonld.filter(Boolean).map(seo.ldScript).join('\n  '),
        path: pagePath,
        feed: '/feed.xml'
      },
      doc,
      ...extra
    };
    data = await host.applyFilters('templateData', data, { template, path: pagePath });
    const body = engine.render(theme.templates[template], data, `templates/${template}.html`);
    let html = engine.render(theme.layout, { ...data, body }, 'layout.html');
    html = await host.applyFilters('html', html, { template, path: pagePath, doc });
    html = seo.injectMetaCsp(html, config);
    const file = pagePath.endsWith('.html') ? path.join(DIST, pagePath) : path.join(DIST, pagePath, 'index.html');
    writeFile(file, html);
    if (!noindex && !pagePath.endsWith('.html')) pagesOut.push({ loc: canonical, lastmod: doc && doc.updated ? doc.updated : '' });
  }

  // Posts and pages
  for (const d of items) {
    const crumbs = [{ name: 'Home', url: site.url + '/' }];
    if (d.type === 'post' && d.categorySlug) crumbs.push({ name: d.category, url: site.url + d.categoryUrl });
    crumbs.push({ name: d.title, url: d.url });
    await renderPage({
      template: d.template,
      doc: d,
      pagePath: d.path,
      title: d.title,
      description: d.description || d.excerpt,
      ogType: d.type === 'post' ? 'article' : 'website',
      image: d.image,
      noindex: d.noindex,
      jsonld: [d.type === 'post' ? seo.articleLd(site, d) : null, seo.breadcrumbLd(crumbs), d.faq.length ? seo.faqLd(d.faq) : null]
    });
    // Raw markdown alongside every page — easy for agents and readers to reuse.
    writeFile(path.join(DIST, d.slug, 'index.md'), `# ${d.title}\n\n${d.body.trim()}\n`);
  }

  // Home + pagination
  const per = config.postsPerPage;
  const totalPages = Math.max(1, Math.ceil(posts.length / per));
  const featured = posts.filter((p) => p.featured).slice(0, 3);
  for (let n = 1; n <= totalPages; n++) {
    const pagePath = n === 1 ? '/' : `/page/${n}/`;
    await renderPage({
      template: 'home',
      pagePath,
      title: n === 1 ? site.title : `Page ${n}`,
      description: site.description,
      jsonld: n === 1 ? [seo.websiteLd(site, { search: searchEnabled })] : [],
      extra: {
        isFirstPage: n === 1,
        featured: n === 1 ? featured : [],
        posts: posts.slice((n - 1) * per, n * per),
        pagination: totalPages > 1 ? {
          current: n, total: totalPages,
          prev: n > 1 ? (n === 2 ? '/' : `/page/${n - 1}/`) : '',
          next: n < totalPages ? `/page/${n + 1}/` : ''
        } : null
      }
    });
  }

  // Archives
  for (const [kind, list, base] of [['Category', categories, 'category'], ['Tag', tags, 'tag']]) {
    for (const t of list) {
      await renderPage({
        template: 'archive',
        pagePath: `/${base}/${t.slug}/`,
        title: `${kind}: ${t.name}`,
        description: `${t.count} post${t.count === 1 ? '' : 's'} filed under ${t.name} on ${site.title}.`,
        jsonld: [seo.breadcrumbLd([{ name: 'Home', url: site.url + '/' }, { name: t.name, url: `${site.url}/${base}/${t.slug}/` }])],
        extra: { archive: { kind, name: t.name, count: t.count }, posts: t.posts }
      });
    }
  }

  // 404
  if (theme.templates['404']) await renderPage({ template: '404', pagePath: '/404.html', title: 'Page not found', noindex: true, extra: { posts: posts.slice(0, 3) } });

  // Plugin pages
  for (const pg of host.state.pages) {
    await renderPage({
      template: pg.template && theme.templates[pg.template] ? pg.template : 'page',
      pagePath: pg.path,
      title: pg.title,
      description: pg.description || '',
      noindex: !!pg.noindex,
      doc: { title: pg.title, html: pg.html, description: pg.description || '', type: 'page', tags: [], plugin: pg.owner }
    });
  }

  // Lint results feed the admin dashboard and the agent tools.
  const lint = lintAll(items, { blocks, allowRawHtml: config.markdown.allowRawHtml, templates: templateNames });

  // Machine-readable outputs
  const publicDoc = (d) => ({
    type: d.type, slug: d.slug, title: d.title, description: d.description, url: d.url, path: d.path,
    markdown: d.markdownUrl, date: d.date, updated: d.updated, author: d.author, category: d.category,
    tags: d.tags.map((t) => t.name), template: d.template, words: d.wordCount, readingTime: d.readingTime || null,
    source: d.sourcePath, editUrl: d.editUrl
  });
  writeFile(path.join(DIST, 'api', 'content.json'), JSON.stringify({ site: { title: site.title, url: site.url, description: site.description }, generated: new Date().toISOString(), posts: posts.map(publicDoc), pages: pages.map(publicDoc) }, null, 2));
  writeFile(path.join(DIST, 'feed.xml'), seo.rss(site, posts));
  writeFile(path.join(DIST, 'llms.txt'), seo.llmsTxt(site, posts, pages));
  writeFile(path.join(DIST, 'llms-full.txt'), seo.llmsFull(site, [...pages, ...posts]));

  // Admin dashboard (static, read-only — publishing happens through GitHub).
  if (config.admin.enabled) {
    copyDir(path.join(__dirname, 'admin'), path.join(DIST, 'admin'));
    const adminIndex = path.join(DIST, 'admin', 'index.html');
    writeFile(adminIndex, seo.injectMetaCsp(fs.readFileSync(adminIndex, 'utf8'), config));
    fs.copyFileSync(path.join(__dirname, 'shared', 'pressy-core.js'), path.join(DIST, 'admin', 'pressy-core.js'));
    fs.copyFileSync(path.join(path.dirname(require.resolve('marked')), 'marked.umd.js'), path.join(DIST, 'admin', 'marked.umd.js'));
    for (const t of listThemes(root)) {
      const shot = path.join(root, 'themes', t.name, 'screenshot.png');
      if (fs.existsSync(shot)) writeFile(path.join(DIST, 'admin', 'screenshots', `theme-${t.name}.png`), fs.readFileSync(shot));
    }
    const allPlugins = listPlugins(root).map((p) => ({ name: p.name, title: p.title || p.name, version: p.version, description: p.description, permissions: (p.permissions || []).map((x) => ({ name: x, description: PERMISSIONS[x] })), enabled: config.plugins.includes(p.name), error: p.error }));
    const blockList = Object.entries(blocks).map(([name, b]) => ({ name, label: b.label || name, icon: b.icon || '🧩', category: b.category || 'content', description: b.description || '', child: !!b.child, plugin: b.plugin || null, attrs: b.attrs || {}, example: b.example || '' }));
    writeFile(path.join(DIST, 'admin', 'data.json'), JSON.stringify({
      version: pkg.version,
      site: { title: site.title, url: site.url, description: site.description, tagline: site.tagline },
      github,
      theme: { active: theme.name, templates: templateNames, available: listThemes(root) },
      plugins: allPlugins,
      blocks: blockList,
      agents: config.agents,
      content: [...posts, ...pages].map(publicDoc),
      categories: categories.map((c) => c.name),
      lint
    }, null, 2));
  }

  // Plugin-emitted files
  await host.doAction('build:end', ctx);
  for (const f of host.state.files) writeFile(path.join(DIST, f.path), f.contents);

  // Sitemap, robots, headers, redirects
  const sitemapUrls = pagesOut.sort((a, b) => a.loc.localeCompare(b.loc));
  writeFile(path.join(DIST, 'sitemap.xml'), seo.sitemap(sitemapUrls));
  writeFile(path.join(DIST, 'robots.txt'), seo.robots(site, { disallow: ['/admin/', ...(config.robots && config.robots.disallow ? config.robots.disallow : [])] }));
  writeFile(path.join(DIST, '_headers'), seo.headersFile(config, host.state.headers));
  const redirects = ['# Generated by PressyCMS — Cloudflare Pages / Netlify _redirects format'];
  for (const d of items) for (const from of d.redirectFrom) redirects.push(`${from}  ${d.path}  301`);
  for (const r of host.state.redirects) redirects.push(`${r.from}  ${r.to}  ${r.status}`);
  writeFile(path.join(DIST, '_redirects'), redirects.join('\n') + '\n');

  // Fail on broken internal links
  const broken = checkInternalLinks(DIST);
  if (broken.length) throw new Error('Broken internal links:\n  ' + broken.join('\n  '));

  const ms = Date.now() - t0;
  log(`✓ Built ${posts.length} posts, ${pages.length} pages, ${categories.length} categories, ${tags.length} tags → ${path.relative(root, DIST) || DIST} in ${ms}ms`);
  return { config, posts, pages, categories, tags, lint, dist: DIST, ms, redirects: host.state.redirects };
}

function checkInternalLinks(dist) {
  const broken = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.html')) continue;
      const html = fs.readFileSync(p, 'utf8');
      for (const [, href] of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
        if (href.startsWith('//')) continue;
        const target = path.join(dist, decodeURIComponent(href));
        const ok = href.endsWith('/') ? fs.existsSync(path.join(target, 'index.html')) : fs.existsSync(target) || fs.existsSync(path.join(target, 'index.html'));
        if (!ok) broken.add(`${path.relative(dist, p)} → ${href}`);
      }
    }
  };
  walk(dist);
  return [...broken];
}

module.exports = { build, listThemes, loadTheme, checkInternalLinks, escapeHtml };
