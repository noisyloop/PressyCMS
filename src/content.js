'use strict';
/* Loads markdown documents from content/posts and content/pages.
   One file = one URL. Front matter is YAML; JavaScript front matter is refused. */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { slugify, safeUrl } = require('./shared/pressy-core');

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const TYPES = { post: 'posts', page: 'pages' };
const RESERVED = new Set(['admin', 'api', 'category', 'tag', 'page', 'search', 'theme', 'assets', 'media', 'feed.xml', 'sitemap.xml']);

const noCode = (f) => () => { throw new Error(`${f}: executable front matter is not allowed`); };

function parseFile(file, type) {
  const raw = fs.readFileSync(file, 'utf8');
  const name = path.basename(file);
  const { data, content } = matter(raw, {
    engines: { js: noCode(name), javascript: noCode(name), coffee: noCode(name) }
  });
  return toDoc(data, content, { name, type, file });
}

function isoDate(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

const asList = (v) => (Array.isArray(v) ? v : v ? String(v).split(',') : []).map((s) => String(s).trim()).filter(Boolean);

function toDoc(data, body, { name, type, file }) {
  const slug = String(data.slug || name.replace(/\.md$/, '')).toLowerCase();
  const category = data.category ? String(data.category) : (type === 'post' ? 'Uncategorized' : '');
  const words = body.replace(/```[\s\S]*?```/g, '').replace(/^:{3,}.*$/gm, '').split(/\s+/).filter(Boolean).length;
  return {
    type,
    file,
    sourceName: name,
    slug,
    title: data.title ? String(data.title) : '',
    description: data.description ? String(data.description) : '',
    date: isoDate(data.date),
    updated: isoDate(data.updated) || isoDate(data.date),
    author: data.author ? String(data.author) : '',
    category,
    categorySlug: category ? slugify(category) : '',
    tags: asList(data.tags).map((t) => ({ name: t, slug: slugify(t) })),
    template: data.template ? String(data.template) : (type === 'post' ? 'post' : 'page'),
    image: data.image ? safeUrl(String(data.image)) : '',
    imageAlt: data.imageAlt ? String(data.imageAlt) : '',
    featured: !!data.featured,
    draft: !!data.draft,
    noindex: !!data.noindex,
    toc: !!data.toc,
    menuOrder: Number.isFinite(data.menuOrder) ? data.menuOrder : 99,
    redirectFrom: asList(data.redirect_from || data.redirectFrom),
    wordCount: words,
    data,
    body
  };
}

function validate(doc) {
  const errors = [];
  if (!SLUG_RE.test(doc.slug)) errors.push(`slug "${doc.slug}" must be lowercase letters, numbers and dashes`);
  if (RESERVED.has(doc.slug)) errors.push(`slug "${doc.slug}" is reserved`);
  if (!doc.title) errors.push('missing title');
  if (doc.type === 'post' && !doc.date) errors.push('missing or invalid date');
  if (!/^[a-z0-9-]+$/.test(doc.template)) errors.push(`template "${doc.template}" is not a valid name`);
  for (const r of doc.redirectFrom) if (!/^\/[\w\-./]*$/.test(r)) errors.push(`redirect_from "${r}" must be a site path`);
  return errors;
}

function loadContent(root, { includeDrafts = false, now = new Date() } = {}) {
  const docs = [];
  const errors = [];
  for (const [type, dir] of Object.entries(TYPES)) {
    const full = path.join(root, 'content', dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full).filter((x) => x.endsWith('.md')).sort()) {
      let doc;
      try { doc = parseFile(path.join(full, f), type); } catch (e) { errors.push(`content/${dir}/${f}: ${e.message}`); continue; }
      for (const err of validate(doc)) errors.push(`content/${dir}/${f}: ${err}`);
      docs.push(doc);
    }
  }
  const seen = new Map();
  for (const d of docs) {
    if (seen.has(d.slug)) errors.push(`duplicate slug "${d.slug}" (${seen.get(d.slug)} and ${d.sourceName})`);
    seen.set(d.slug, d.sourceName);
  }
  const today = now.toISOString().slice(0, 10);
  const published = docs.filter((d) => includeDrafts || (!d.draft && !(d.date && d.date > today)));
  return { docs: published, all: docs, errors };
}

module.exports = { loadContent, parseFile, toDoc, validate, SLUG_RE, RESERVED };
