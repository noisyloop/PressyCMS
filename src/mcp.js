'use strict';
/* PressyCMS MCP server (Model Context Protocol, stdio transport).

   Lets an agent such as Claude Code manage the site through typed tools
   instead of guessing at files. It only ever touches content/*.md, never
   deletes anything (use git for that), and every write is linted so the
   agent sees SEO/accessibility problems immediately.

   Which agents may connect is set in pressy.config.json → agents.allowed.
   That is a policy switch, not authentication: the real gate is who can
   push to your GitHub repository. */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { loadConfig } = require('./config');
const { loadContent, parseFile, validate, SLUG_RE } = require('./content');
const { createDoc } = require('./scaffold');
const { lintDoc, lintAll } = require('./lint');
const { build, listThemes } = require('./build');
const { listPlugins, createHost } = require('./plugins');
const core = require('./shared/pressy-core');
const pkg = require('../package.json');

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

function tools(config) {
  const read = [
    { name: 'site_info', description: 'Site settings, active theme, enabled plugins, available templates and blocks. Call this first.', inputSchema: { type: 'object', properties: {} } },
    { name: 'list_content', description: 'List posts and/or pages with slug, title, date, category, tags and draft status.', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['post', 'page', 'all'], default: 'all' } } } },
    { name: 'read_content', description: 'Read the raw markdown (with front matter) of one post or page.', inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] } },
    { name: 'list_blocks', description: 'The block library: names, attributes and a markdown example for each block.', inputSchema: { type: 'object', properties: {} } },
    { name: 'lint_content', description: 'Run SEO, accessibility and block checks. Omit slug to lint everything.', inputSchema: { type: 'object', properties: { slug: { type: 'string' } } } },
    { name: 'build_site', description: 'Build the site into dist/ and report errors such as broken internal links.', inputSchema: { type: 'object', properties: { drafts: { type: 'boolean', default: false } } } }
  ];
  const write = [
    {
      name: 'create_content',
      description: 'Create a new post or page. Body is markdown and may use :::blocks. Returns the file path and lint results.',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['post', 'page'], default: 'post' },
          title: { type: 'string' },
          description: { type: 'string', description: '70–160 character meta description' },
          category: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          template: { type: 'string', description: 'Theme template, e.g. post, page, landing' },
          slug: { type: 'string' },
          draft: { type: 'boolean', default: false },
          body: { type: 'string' }
        },
        required: ['title', 'body']
      }
    },
    {
      name: 'update_content',
      description: 'Replace an existing post or page with new raw markdown (front matter included). The slug cannot change here.',
      inputSchema: { type: 'object', properties: { slug: { type: 'string' }, markdown: { type: 'string' } }, required: ['slug', 'markdown'] }
    }
  ];
  return config.agents.allowWrite ? [...read, ...write] : read;
}

function findFile(root, slug) {
  if (!SLUG_RE.test(String(slug || ''))) throw new Error('Invalid slug');
  for (const dir of ['posts', 'pages']) {
    const f = path.join(root, 'content', dir, `${slug}.md`);
    if (fs.existsSync(f)) return { file: f, type: dir === 'posts' ? 'post' : 'page' };
  }
  // Front matter may override the slug; fall back to a scan.
  const { all } = loadContent(root, { includeDrafts: true });
  const hit = all.find((d) => d.slug === slug);
  if (!hit) throw new Error(`No post or page with slug "${slug}"`);
  return { file: hit.file, type: hit.type };
}

async function callTool(root, name, args) {
  const config = loadConfig(root);
  const allowed = new Set(tools(config).map((t) => t.name));
  if (!allowed.has(name)) throw new Error(`Tool "${name}" is not available${config.agents.allowWrite ? '' : ' (agents.allowWrite is false)'}`);
  const blocks = { ...core.BLOCKS };
  createHost({ root, config, blocks }); // plugin blocks (e.g. :::toc) are valid too

  switch (name) {
    case 'site_info': {
      const themes = listThemes(root);
      return {
        site: config.site, theme: config.theme,
        templates: (themes.find((t) => t.name === config.theme) || {}).templates || [],
        themes: themes.map((t) => t.name),
        plugins: { enabled: config.plugins, available: listPlugins(root).map((p) => p.name) },
        blocks: Object.keys(blocks),
        conventions: 'One markdown file per URL in content/posts or content/pages. Use ## for sections (the title is the H1). Raw HTML is escaped — use blocks. Descriptions 70–160 chars. Every image needs alt text.'
      };
    }
    case 'list_content': {
      const { all } = loadContent(root, { includeDrafts: true });
      return all.filter((d) => !args.type || args.type === 'all' || d.type === args.type)
        .map((d) => ({ type: d.type, slug: d.slug, title: d.title, date: d.date, category: d.category, tags: d.tags.map((t) => t.name), template: d.template, draft: d.draft, file: path.relative(root, d.file) }));
    }
    case 'read_content': {
      const { file } = findFile(root, args.slug);
      return { file: path.relative(root, file), markdown: fs.readFileSync(file, 'utf8') };
    }
    case 'list_blocks':
      return Object.entries(blocks).map(([n, b]) => ({ name: n, label: b.label, description: b.description, attrs: b.attrs, example: b.example }));
    case 'lint_content': {
      const { all, errors } = loadContent(root, { includeDrafts: true });
      const docs = args.slug ? all.filter((d) => d.slug === args.slug) : all;
      if (args.slug && !docs.length) throw new Error(`No post or page with slug "${args.slug}"`);
      return { errors, results: lintAll(docs, { blocks, allowRawHtml: config.markdown.allowRawHtml }).filter((r) => r.issues.length) };
    }
    case 'build_site': {
      try {
        const r = await build({ root, includeDrafts: !!args.drafts, quiet: true });
        return { ok: true, posts: r.posts.length, pages: r.pages.length, ms: r.ms };
      } catch (e) { return { ok: false, error: e.message }; }
    }
    case 'create_content': {
      const { type, title, description, category, template, slug, draft, body } = args;
      const res = createDoc(root, { type, title, description, category, template, slug, draft, body, tags: Array.isArray(args.tags) ? args.tags.map(String) : [] });
      const doc = parseFile(res.file, args.type || 'post');
      return { created: path.relative(root, res.file), url: config.site.url + res.path, problems: validate(doc), lint: lintDoc(doc, { blocks, allowRawHtml: config.markdown.allowRawHtml }) };
    }
    case 'update_content': {
      const { file, type } = findFile(root, args.slug);
      const tmp = file + '.pressy-tmp';
      fs.writeFileSync(tmp, String(args.markdown));
      let doc;
      try {
        doc = parseFile(tmp, type);
        doc.slug = doc.data.slug ? String(doc.data.slug) : args.slug;
        if (doc.slug !== args.slug) throw new Error('Changing the slug is not allowed here — create a new document and add a redirect instead.');
        const problems = validate(doc);
        if (problems.length) throw new Error(problems.join('; '));
      } catch (e) { fs.unlinkSync(tmp); throw e; }
      fs.renameSync(tmp, file);
      return { updated: path.relative(root, file), lint: lintDoc(doc, { blocks, allowRawHtml: config.markdown.allowRawHtml }) };
    }
  }
  throw new Error(`Unknown tool ${name}`);
}

function clientAllowed(config, clientInfo) {
  const allowed = (config.agents.allowed || []).map((s) => String(s).toLowerCase());
  if (allowed.includes('*')) return true;
  const name = String((clientInfo && clientInfo.name) || '').toLowerCase();
  return allowed.some((a) => name.includes(a));
}

function startMcpServer({ root = process.cwd(), input = process.stdin, output = process.stdout } = {}) {
  const send = (msg) => output.write(JSON.stringify(msg) + '\n');
  const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
  const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });
  let ready = false;

  const rl = readline.createInterface({ input });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return fail(null, -32700, 'Parse error'); }
    const { id, method, params = {} } = msg;
    const isRequest = id !== undefined && id !== null;
    try {
      if (method === 'initialize') {
        const config = loadConfig(root);
        if (!clientAllowed(config, params.clientInfo)) {
          return fail(id, -32001, `Agent "${(params.clientInfo || {}).name || 'unknown'}" is not in agents.allowed (${config.agents.allowed.join(', ')}) in pressy.config.json`);
        }
        ready = true;
        const version = PROTOCOL_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0];
        return reply(id, {
          protocolVersion: version,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'pressycms', version: pkg.version },
          instructions: 'PressyCMS site tools. Call site_info first. Never invent block names — use list_blocks. After writing, run lint_content and build_site and fix any problems before finishing.'
        });
      }
      if (!isRequest) return; // notifications (initialized, cancelled, …)
      if (method === 'ping') return reply(id, {});
      if (!ready) return fail(id, -32002, 'Server not initialized');
      if (method === 'tools/list') return reply(id, { tools: tools(loadConfig(root)) });
      if (method === 'tools/call') {
        try {
          const result = await callTool(root, params.name, params.arguments || {});
          return reply(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false });
        } catch (e) {
          return reply(id, { content: [{ type: 'text', text: e.message }], isError: true });
        }
      }
      if (method === 'resources/list') return reply(id, { resources: [] });
      if (method === 'prompts/list') return reply(id, { prompts: [] });
      return fail(id, -32601, `Method not found: ${method}`);
    } catch (e) {
      if (isRequest) fail(id, -32603, e.message);
    }
  });
  return rl;
}

module.exports = { startMcpServer, callTool, tools, clientAllowed };
