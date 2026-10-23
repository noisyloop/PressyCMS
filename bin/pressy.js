#!/usr/bin/env node
'use strict';
/* pressy — the PressyCMS command line. */

const path = require('path');
const root = process.cwd();
const [cmd = 'help', ...rest] = process.argv.slice(2);

const flag = (name) => rest.includes(`--${name}`);
const option = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i !== -1 && rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : fallback;
};
const positional = () => {
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) { if (rest[i + 1] && !rest[i + 1].startsWith('--') && !['drafts', 'json', 'page', 'draft', 'no-watch'].includes(rest[i].slice(2))) i++; continue; }
    out.push(rest[i]);
  }
  return out;
};

const HELP = `PressyCMS — write markdown, push, done.

Usage: pressy <command> [options]

  build [--drafts] [--theme name] Build the site into dist/ (--theme previews another theme)
  serve [--port 4321] [--theme x] Dev server with rebuild on save (includes drafts)
  new "<title>" [--page] [--template landing] [--category X] [--draft]
                                  Create a post (or page) from a title
  lint [--json]                   SEO, accessibility and block checks
  themes                          List installed themes
  plugins                         List installed plugins and their permissions
  blocks                          List available blocks
  mcp                             Start the MCP server for Claude (stdio)
`;

async function main() {
  switch (cmd) {
    case 'build': {
      const { build } = require('../src/build');
      await build({ root, includeDrafts: flag('drafts'), theme: option('theme') });
      break;
    }
    case 'serve': case 'dev': {
      const { serve } = require('../src/serve');
      await serve({ root, port: Number(option('port', process.env.PORT || 4321)), host: option('host', '127.0.0.1'), watch: !flag('no-watch'), theme: option('theme') });
      break;
    }
    case 'new': {
      const { createDoc } = require('../src/scaffold');
      const title = positional().join(' ');
      if (!title) throw new Error('Usage: pressy new "My post title"');
      const res = createDoc(root, {
        title,
        type: flag('page') ? 'page' : 'post',
        template: option('template'),
        category: option('category'),
        draft: flag('draft')
      });
      console.log(`✓ Created ${path.relative(root, res.file)} → ${res.path}`);
      break;
    }
    case 'lint': {
      const { loadConfig } = require('../src/config');
      const { loadContent } = require('../src/content');
      const { lintAll, formatReport } = require('../src/lint');
      const { loadTheme } = require('../src/build');
      const { createHost } = require('../src/plugins');
      const core = require('../src/shared/pressy-core');
      const config = loadConfig(root);
      const blocks = { ...core.BLOCKS };
      createHost({ root, config, blocks }); // plugins may register blocks
      const theme = loadTheme(root, config.theme);
      const { all, errors } = loadContent(root, { includeDrafts: true });
      const results = lintAll(all, { blocks, allowRawHtml: config.markdown.allowRawHtml, templates: Object.keys(theme.templates) });
      const report = formatReport(results, errors);
      if (flag('json')) console.log(JSON.stringify({ errors, results: results.filter((r) => r.issues.length), counts: report.counts }, null, 2));
      else console.log(report.text);
      if (report.counts.error) process.exitCode = 1;
      break;
    }
    case 'themes': {
      const { listThemes } = require('../src/build');
      const { loadConfig } = require('../src/config');
      const active = loadConfig(root).theme;
      for (const t of listThemes(root)) console.log(`${t.name === active ? '●' : '○'} ${t.name.padEnd(12)} v${t.version}  ${t.description}\n    templates: ${t.templates.join(', ')}`);
      break;
    }
    case 'plugins': {
      const { listPlugins } = require('../src/plugins');
      const { loadConfig } = require('../src/config');
      const enabled = new Set(loadConfig(root).plugins);
      for (const p of listPlugins(root)) console.log(`${enabled.has(p.name) ? '●' : '○'} ${p.name.padEnd(14)} ${p.error || p.description}\n    permissions: ${(p.permissions || []).join(', ') || 'none'}`);
      break;
    }
    case 'blocks': {
      const core = require('../src/shared/pressy-core');
      for (const [name, b] of Object.entries(core.BLOCKS)) console.log(`${b.icon} :::${name.padEnd(12)} ${b.description}`);
      break;
    }
    case 'mcp': {
      const { startMcpServer } = require('../src/mcp');
      startMcpServer({ root });
      break;
    }
    case 'help': case '--help': case '-h':
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command "${cmd}".\n\n${HELP}`);
      process.exitCode = 1;
  }
}

main().catch((e) => { console.error('✖ ' + e.message); process.exit(1); });
