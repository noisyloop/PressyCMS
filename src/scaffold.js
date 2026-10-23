'use strict';
/* `pressy new` — create a post or page from a title. */

const fs = require('fs');
const path = require('path');
const { slugify } = require('./shared/pressy-core');
const { SLUG_RE, RESERVED } = require('./content');

const yamlString = (s) => JSON.stringify(String(s));

function frontMatter({ title, description = '', date, category, tags = [], template, draft }) {
  const lines = ['---', `title: ${yamlString(title)}`, `description: ${yamlString(description)}`];
  if (date) lines.push(`date: ${date}`);
  if (category) lines.push(`category: ${yamlString(category)}`);
  if (tags.length) lines.push(`tags: [${tags.map(yamlString).join(', ')}]`);
  if (template) lines.push(`template: ${template}`);
  if (draft) lines.push('draft: true');
  lines.push('---', '');
  return lines.join('\n');
}

function createDoc(root, { title, type = 'post', slug, description, category, tags = [], template, draft = false, body, overwrite = false }) {
  if (!title || !String(title).trim()) throw new Error('A title is required');
  slug = (slug || slugify(title)).slice(0, 80).replace(/-+$/, '');
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) throw new Error(`Invalid or reserved slug "${slug}"`);
  if (!['post', 'page'].includes(type)) throw new Error('type must be "post" or "page"');
  const file = path.join(root, 'content', type === 'post' ? 'posts' : 'pages', `${slug}.md`);
  if (fs.existsSync(file) && !overwrite) throw new Error(`${path.relative(root, file)} already exists`);
  const date = type === 'post' ? new Date().toISOString().slice(0, 10) : '';
  const content = frontMatter({ title, description: description || '', date, category: type === 'post' ? (category || 'Uncategorized') : '', tags, template, draft }) +
    (body != null ? String(body).replace(/^\n+/, '') : 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n## PressyCMS: first section\n\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith('\n') ? content : content + '\n');
  return { file, slug, path: `/${slug}/` };
}

module.exports = { createDoc, frontMatter };
