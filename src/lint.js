'use strict';
/* Content audit: SEO, accessibility and block checks for every markdown file.
   Human-readable by default, JSON with --json so agents can act on it. */

const { walkBlocks, BLOCKS, safeUrl } = require('./shared/pressy-core');

function lintDoc(doc, { blocks = BLOCKS, allowRawHtml = false, templates = null } = {}) {
  const issues = [];
  const add = (level, rule, message, fix) => issues.push({ level, rule, message, ...(fix ? { fix } : {}) });

  // SEO
  if (!doc.title) add('error', 'title-missing', 'Missing title.');
  else if (doc.title.length > 65) add('warn', 'title-length', `Title is ${doc.title.length} characters; search engines truncate around 60.`, 'Shorten the title or set a shorter `title` and keep the long one in the body.');
  if (!doc.description) add('warn', 'description-missing', 'Missing description — search engines will guess one.', 'Add a `description:` of 70–160 characters.');
  else if (doc.description.length < 50) add('warn', 'description-short', `Description is only ${doc.description.length} characters.`, 'Aim for 70–160 characters.');
  else if (doc.description.length > 160) add('warn', 'description-long', `Description is ${doc.description.length} characters; it will be cut off after ~160.`);
  if (doc.type === 'post' && doc.wordCount < 150) add('info', 'thin-content', `Only ${doc.wordCount} words. Thin pages rank poorly.`);
  if (doc.image && !doc.imageAlt) add('warn', 'image-alt', 'Front-matter `image` has no `imageAlt`.');
  if (doc.image && doc.image === '#') add('error', 'image-url', 'Front-matter `image` uses a disallowed URL scheme.');

  // Body structure (ignore fenced code)
  const body = doc.body.replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
  if (/^#\s/m.test(body)) add('warn', 'h1-in-body', 'The body contains an H1 (`# `). The theme already renders the title as H1 — use `##` for sections.');
  let last = 1;
  for (const [, hashes] of body.matchAll(/^(#{2,6})\s/gm)) {
    const level = hashes.length;
    if (level > last + 1) { add('warn', 'heading-skip', `Heading jumps from H${last} to H${level}. Screen readers and crawlers prefer a tidy outline.`); break; }
    last = level;
  }
  for (const [, alt, url] of body.matchAll(/!\[([^\]]*)\]\(([^)\s]*)/g)) {
    if (!alt.trim()) add('error', 'img-alt', `Image ${url} has no alt text.`, 'Describe the image inside the square brackets: ![a red bicycle](…)');
  }
  for (const [, url] of body.matchAll(/\]\(([^)\s]+)/g)) {
    if (safeUrl(url) === '#' && url !== '#') add('error', 'unsafe-link', `Link "${url}" uses a disallowed URL scheme and will be removed.`);
    else if (/^http:\/\//.test(url)) add('info', 'insecure-link', `Link ${url} is not HTTPS.`);
  }
  if (!allowRawHtml && /<\/?[a-zA-Z][^>]*>/.test(body.replace(/`[^`]*`/g, ''))) {
    add('warn', 'raw-html', 'Raw HTML is escaped (shown as text) for security. Use a block instead, e.g. `:::callout`.');
  }

  // Blocks
  walkBlocks(doc.body, (b) => {
    const def = blocks[b.name];
    if (!def) { add('error', 'unknown-block', `Unknown block ":::${b.name}" (line ${b.line}).`, `Available blocks: ${Object.keys(blocks).join(', ')}`); return; }
    for (const [attr, spec] of Object.entries(def.attrs || {})) {
      const v = b.attrs[attr];
      if (spec.required && (v === undefined || v === '')) add('error', 'block-attr', `Block ":::${b.name}" (line ${b.line}) needs ${attr}="…".`);
      if (v !== undefined && spec.values && !spec.values.includes(String(v))) add('warn', 'block-attr', `Block ":::${b.name}" ${attr}="${v}" — expected one of ${spec.values.join(', ')}.`);
    }
  });
  if (/^:{3,}[ \t]*[a-zA-Z]/m.test(body)) {
    // walkBlocks leaves unclosed openers as text; catch them here.
    const opens = (body.match(/^:{3,}[ \t]*[a-zA-Z].*$/gm) || []).length;
    let found = 0;
    walkBlocks(doc.body, () => { found++; });
    if (opens > found) add('error', 'unclosed-block', `${opens - found} block(s) are never closed. Close each block with a line of the same number of colons.`);
  }

  if (templates && !templates.includes(doc.template)) add('error', 'template-missing', `Template "${doc.template}" does not exist in the active theme (have: ${templates.join(', ')}).`);
  return issues;
}

function lintAll(docs, opts) {
  return docs.map((doc) => ({ file: doc.file ? doc.file.replace(/^.*?(content\/)/, '$1') : doc.slug, slug: doc.slug, title: doc.title, issues: lintDoc(doc, opts) }));
}

function formatReport(results, errors = []) {
  const lines = [];
  for (const e of errors) lines.push(`✖ ${e}`);
  let counts = { error: errors.length, warn: 0, info: 0 };
  for (const r of results) {
    if (!r.issues.length) continue;
    lines.push(`\n${r.file}`);
    for (const i of r.issues) {
      counts[i.level]++;
      lines.push(`  ${i.level === 'error' ? '✖' : i.level === 'warn' ? '⚠' : 'ℹ'} ${i.message}${i.fix ? `\n      → ${i.fix}` : ''}`);
    }
  }
  lines.push(`\n${counts.error} error(s), ${counts.warn} warning(s), ${counts.info} note(s) across ${results.length} file(s).`);
  return { text: lines.join('\n'), counts };
}

module.exports = { lintDoc, lintAll, formatReport };
