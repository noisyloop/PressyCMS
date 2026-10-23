/* PressyCMS admin. A static, read-only dashboard: it reads /admin/data.json
   (written by the build) and hands every change to GitHub or Claude, so
   there is no login form, session or write API on the live site to attack. */
(function () {
  'use strict';

  const view = document.getElementById('view');
  let DATA = null;
  let renderMarkdown = null;

  // ---------- tiny DOM helper (text is always set with textContent) ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const box = (title, ...kids) => h('section', { class: 'box' }, h('h2', { text: title }), h('div', { class: 'box-body' }, ...kids));

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || 'Copied to clipboard'); } catch { toast('Copy failed — select the text and copy it manually'); }
  }
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('pressy:' + k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem('pressy:' + k, JSON.stringify(v)); } catch { /* private mode */ } }
  };

  // ---------- data ----------
  const issuesFor = (slug) => (DATA.lint.find((l) => l.slug === slug) || { issues: [] }).issues;
  function worst(issues) {
    if (issues.some((i) => i.level === 'error')) return 'error';
    if (issues.some((i) => i.level === 'warn')) return 'warn';
    return 'ok';
  }
  const ghIssueUrl = (title, body) => DATA.github ? `https://github.com/${DATA.github.repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}` : null;

  // ---------- routes ----------
  const routes = {
    dashboard() {
      const posts = DATA.content.filter((c) => c.type === 'post');
      const pages = DATA.content.filter((c) => c.type === 'page');
      const all = DATA.lint.flatMap((l) => l.issues);
      const errors = all.filter((i) => i.level === 'error').length;
      const warns = all.filter((i) => i.level === 'warn').length;
      const score = Math.max(0, 100 - errors * 15 - warns * 3);
      const activePlugins = DATA.plugins.filter((p) => p.enabled);

      const quickTitle = h('input', { type: 'text', placeholder: 'Title', 'aria-label': 'Title' });
      const quickBody = h('textarea', { placeholder: "What's on your mind? (markdown)", 'aria-label': 'Content' });

      return [
        h('h1', { text: 'Dashboard' }),
        h('div', { class: 'welcome' },
          h('h2', { text: 'Welcome to PressyCMS!' }),
          h('p', { text: 'Every post is a markdown file in GitHub. Edit here, in GitHub, in your code editor or by asking Claude — the site rebuilds itself on every push.' }),
          h('div', { class: 'welcome-cols' },
            h('div', {}, h('h3', { text: 'Get started' }), h('a', { class: 'btn btn-primary', href: '#new', text: 'Write your first post' })),
            h('div', {}, h('h3', { text: 'Next steps' }), h('ul', {},
              h('li', {}, h('a', { href: '#blocks', text: 'Browse the block library' })),
              h('li', {}, h('a', { href: '#appearance', text: 'Change your theme' })),
              h('li', {}, h('a', { href: '/', text: 'View your site' })))),
            h('div', {}, h('h3', { text: 'Let Claude help' }), h('ul', {},
              h('li', {}, h('a', { href: '#agents', text: 'Connect Claude (MCP)' })),
              h('li', {}, h('a', { href: '#health', text: 'Fix SEO issues' })))))),
        h('div', { class: 'grid' },
          box('At a Glance',
            h('ul', { class: 'glance' },
              h('li', {}, '📌 ', h('strong', { text: posts.length }), ' Posts'),
              h('li', {}, '📄 ', h('strong', { text: pages.length }), ' Pages'),
              h('li', {}, '🗂️ ', h('strong', { text: DATA.categories.length }), ' Categories'),
              h('li', {}, '🔌 ', h('strong', { text: activePlugins.length }), ' Plugins')),
            h('p', {}, 'PressyCMS ', DATA.version, ' running the ', h('a', { href: '#appearance', text: DATA.theme.active }), ' theme. Database: ', h('strong', { text: 'none' }), ' 🎉')),
          box('Site Health',
            h('div', { class: 'health' },
              h('div', { class: 'health-ring' + (errors ? ' bad' : warns ? ' warn' : '') }, String(score)),
              h('div', {},
                h('p', { text: errors ? `${errors} error(s) need attention.` : warns ? 'Good — a few improvements are possible.' : 'Excellent. No issues found.' }),
                h('a', { href: '#health', text: `View ${errors + warns} item(s)` })))),
          box('Quick Draft',
            h('div', { class: 'field' }, quickTitle),
            h('div', { class: 'field' }, quickBody),
            h('button', { class: 'btn btn-primary', text: 'Continue in editor', onclick: () => {
              store.set('draft', { ...blankDraft(), title: quickTitle.value, body: quickBody.value });
              location.hash = '#new';
            } })),
          box('Activity',
            h('p', { class: 'subsubsub', text: 'Recently published' }),
            h('ul', {}, posts.slice(0, 6).map((p) => h('li', {}, h('span', { class: 'subsubsub', text: p.date + ' ' }), h('a', { href: p.path, text: p.title }))))))
      ];
    },

    posts() { return listView('post'); },
    pages() { return listView('page'); },

    new() { return editorView(); },

    blocks() {
      const blocks = DATA.blocks;
      return [
        h('h1', { text: 'Blocks' }),
        h('p', { class: 'notice', text: 'Blocks are Elementor-style widgets you write in markdown. Open with three or more colons and the block name, close with the same number of colons. Outer blocks use more colons than the blocks inside them.' }),
        h('div', { class: 'block-ref' }, blocks.map((b) => box(`${b.icon} ${b.label}  (:::${b.name})`,
          h('p', { text: b.description }),
          Object.keys(b.attrs).length ? h('p', {}, Object.entries(b.attrs).map(([k, v]) => h('span', { class: 'badge', text: `${k}${v.required ? '*' : ''}${v.values ? ': ' + v.values.join('|') : ''}` }))) : null,
          b.plugin ? h('p', {}, h('span', { class: 'badge perm', text: 'from plugin: ' + b.plugin })) : null,
          h('pre', { text: b.example }),
          h('button', { class: 'btn btn-sm', text: 'Copy', onclick: () => copy(b.example) }))))
      ];
    },

    appearance() {
      const t = DATA.theme;
      return [
        h('h1', {}, 'Themes ', h('span', { class: 'badge', text: String(t.available.length) })),
        h('p', { class: 'notice' }, 'Themes live in ', h('code', { text: 'themes/<name>/' }), '. To switch, change ', h('code', { text: '"theme"' }), ' in ', h('code', { text: 'pressy.config.json' }), ' and push. Every theme renders the same markdown and blocks, so switching never breaks content.'),
        h('div', { class: 'themes' }, [...t.available].sort((a, b) => (b.name === t.active) - (a.name === t.active)).map((th) => {
          const active = th.name === t.active;
          const shot = `screenshots/theme-${th.name}.png`;
          const img = h('img', { src: shot, alt: `${th.title} theme preview`, loading: 'lazy' });
          img.addEventListener('error', () => img.replaceWith(h('span', { text: th.title })));
          return h('div', { class: 'theme-card' + (active ? ' active' : '') },
            h('div', { class: 'theme-shot' }, img),
            active ? h('p', { text: th.description }) : null,
            h('div', { class: 'theme-meta' },
              h('strong', {}, active ? 'Active: ' : '', th.title, ' ', h('span', { class: 'subsubsub', text: 'v' + th.version })),
              active ? null : h('button', { class: 'btn btn-sm', text: 'Activate', onclick: () => copy(`"theme": "${th.name}"`, 'Copied — paste into pressy.config.json and push') })),
            active ? null : h('p', { text: th.description }),
            h('p', {}, th.templates.map((x) => h('span', { class: 'badge', text: x }))));
        }))
      ];
    },

    plugins() {
      return [
        h('h1', { text: 'Plugins' }),
        h('p', { class: 'notice' }, 'Plugins run at build time only — never on the live site. Each one declares the permissions it needs in ', h('code', { text: 'plugin.json' }), ' and is blocked from anything else. Enable or disable them in ', h('code', { text: 'pressy.config.json → plugins' }), '.'),
        h('table', { class: 'list' },
          h('thead', {}, h('tr', {}, h('th', { text: 'Plugin' }), h('th', { text: 'Description' }), h('th', { text: 'Permissions' }))),
          h('tbody', {}, DATA.plugins.map((p) => h('tr', { class: 'plugin-row' + (p.enabled ? ' active' : '') },
            h('td', {}, h('div', { class: 'row-title', text: p.title }), h('span', { class: 'badge' + (p.enabled ? ' on' : ''), text: p.enabled ? 'Active' : 'Inactive' })),
            h('td', {}, h('div', { text: p.error || p.description }), h('div', { class: 'subsubsub', text: `Version ${p.version} · ${p.name}` })),
            h('td', {}, (p.permissions || []).map((x) => h('span', { class: 'badge perm', title: x.description, text: x.name }))))))),
        h('p', {}, 'Write your own: see ', h('code', { text: 'docs/PLUGINS.md' }), ', or ask Claude to scaffold one.')
      ];
    },

    health() {
      const rows = DATA.lint.filter((l) => l.issues.length);
      const all = rows.flatMap((r) => r.issues);
      const fixPrompt = 'Run `npx pressy lint --json` in the PressyCMS repo and fix every error and warning in content/. Keep the lorem ipsum tone, do not change slugs, then open a pull request.';
      return [
        h('h1', { text: 'Site Health' }),
        h('p', { class: 'notice' + (all.length ? ' warn' : ' ok'), text: all.length ? `${all.length} item(s) across ${rows.length} file(s). The same checks run in CI on every pull request.` : 'All content passes the SEO, accessibility and block checks.' }),
        all.length ? h('p', {},
          h('button', { class: 'btn btn-primary', text: '🤖 Copy “fix it” prompt for Claude', onclick: () => copy(fixPrompt) }), ' ',
          DATA.github ? h('a', { class: 'btn', href: ghIssueUrl('Fix Site Health issues', '@claude ' + fixPrompt), target: '_blank', rel: 'noopener', text: 'Ask @claude on GitHub' }) : null) : null,
        h('div', { class: 'grid' }, rows.map((r) => box(r.title || r.file,
          h('p', { class: 'subsubsub', text: r.file }),
          h('ul', { class: 'issues' }, r.issues.map((i) => h('li', { class: i.level }, h('strong', { text: i.rule + ': ' }), i.message, i.fix ? h('div', { class: 'subsubsub', text: '→ ' + i.fix }) : null))))))
      ];
    },

    agents() {
      const repo = DATA.github ? DATA.github.repo : 'owner/repo';
      const allowed = (DATA.agents.allowed || []).join(', ') || 'none';
      const prompts = [
        ['Write a post', `Write a new PressyCMS post about <topic>. Use lorem ipsum body text, "PressyCMS …" section headings, a callout and an FAQ block. Run \`npx pressy lint\` and fix any issues.`],
        ['Turn notes into a landing page', 'Turn these notes into a PressyCMS page with template: landing. Use hero, stats, cards and a dark section block. Notes: <paste>'],
        ['SEO pass', 'Audit every post with `npx pressy lint --json`, improve titles and descriptions that are too long or short, add alt text, and open a PR.'],
        ['New plugin', 'Scaffold a PressyCMS plugin called <name> that <does something>. Request only the permissions it needs in plugin.json and add a test.'],
        ['New theme', 'Create a new PressyCMS theme called <name> by copying themes/paper and changing the colours and typography to <style>. Keep every required template.']
      ];
      return [
        h('h1', { text: 'Claude' }),
        h('p', { class: 'notice' }, 'Agents allowed by this site: ', h('strong', { text: allowed }), '. Write access: ', h('strong', { text: DATA.agents.allowWrite ? 'yes (via pull requests)' : 'no' }), '. Change this under ', h('code', { text: 'agents' }), ' in pressy.config.json.'),
        h('div', { class: 'grid' },
          box('1 · Claude Code (local, MCP)',
            h('p', { text: 'Clone the repo and run Claude Code inside it. The bundled .mcp.json registers the PressyCMS MCP server automatically, giving Claude tools to list, read, write, lint and build content.' }),
            h('div', { class: 'prompt', text: `git clone https://github.com/${repo}\ncd ${repo.split('/')[1]}\nnpm install\nclaude` }),
            h('p', {}, 'Or add it by hand: ', h('code', { text: 'claude mcp add pressy -- node bin/pressy.js mcp' }))),
          box('2 · @claude on GitHub',
            h('p', { text: 'With the Claude GitHub App and the bundled workflow, mention @claude in any issue or PR. Claude writes the markdown, runs the linter and opens a pull request for you to review.' }),
            DATA.github ? h('a', { class: 'btn btn-primary', target: '_blank', rel: 'noopener', href: ghIssueUrl('Article request: <topic>', '@claude please write a PressyCMS post about <topic>. Follow CLAUDE.md, run the linter, and open a PR.'), text: 'Request an article from Claude' }) : h('p', { text: 'Set github.repo in pressy.config.json to enable.' })),
          box('3 · Claude.ai / any chat',
            h('p', { text: 'Every page has a raw markdown twin and the whole site is indexed for agents:' }),
            h('ul', {},
              h('li', {}, h('a', { href: '/llms.txt', text: '/llms.txt' }), ' — site map for LLMs'),
              h('li', {}, h('a', { href: '/llms-full.txt', text: '/llms-full.txt' }), ' — all content in one file'),
              h('li', {}, h('a', { href: '/api/content.json', text: '/api/content.json' }), ' — structured index')))),
        h('h2', { text: 'Prompt library' }),
        h('div', { class: 'grid' }, prompts.map(([title, p]) => box(title, h('div', { class: 'prompt', text: p }), h('button', { class: 'btn btn-sm', text: 'Copy', onclick: () => copy(p) }))))
      ];
    }
  };

  // ---------- list tables ----------
  function listView(type) {
    const items = DATA.content.filter((c) => c.type === type);
    const label = type === 'post' ? 'Posts' : 'Pages';
    const search = h('input', { type: 'search', placeholder: `Search ${label.toLowerCase()}…`, 'aria-label': 'Search' });
    const cat = type === 'post' ? h('select', { 'aria-label': 'Category' }, h('option', { value: '', text: 'All categories' }), DATA.categories.map((c) => h('option', { value: c, text: c }))) : null;
    const tbody = h('tbody');
    function fill() {
      const q = search.value.toLowerCase();
      tbody.replaceChildren(...items
        .filter((p) => (!q || p.title.toLowerCase().includes(q)) && (!cat || !cat.value || p.category === cat.value))
        .map((p) => {
          const issues = issuesFor(p.slug);
          const w = worst(issues);
          return h('tr', {},
            h('td', {},
              h('a', { class: 'row-title', href: p.path, text: p.title }),
              h('div', { class: 'row-actions' },
                h('a', { href: p.path, text: 'View' }), ' | ',
                h('button', { text: 'Open in editor', onclick: () => openInEditor(p) }), ' | ',
                p.editUrl ? h('a', { href: p.editUrl, target: '_blank', rel: 'noopener', text: 'Edit on GitHub' }) : null, p.editUrl ? ' | ' : null,
                h('a', { href: p.markdown, text: 'Markdown' }))),
            h('td', { text: p.author }),
            type === 'post' ? h('td', { text: p.category }) : h('td', { text: p.template }),
            type === 'post' ? h('td', { text: p.tags.join(', ') || '—' }) : null,
            h('td', { title: issues.map((i) => i.message).join('\n') || 'No issues' }, h('span', { class: 'dot ' + w }), w === 'ok' ? 'Good' : `${issues.length} issue(s)`),
            h('td', {}, type === 'post' ? h('span', {}, 'Published', h('br'), p.date) : h('span', { text: p.readingTime || '' })));
        }));
    }
    search.addEventListener('input', fill);
    if (cat) cat.addEventListener('change', fill);
    fill();
    return [
      h('h1', {}, label, ' ', h('a', { class: 'btn btn-sm', href: '#new', text: 'Add New' })),
      h('p', { class: 'subsubsub', text: `All (${items.length}) · Published (${items.length})` }),
      h('div', { class: 'filters' }, search, cat),
      h('table', { class: 'list' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Title' }), h('th', { text: 'Author' }), h('th', { text: type === 'post' ? 'Category' : 'Template' }), type === 'post' ? h('th', { text: 'Tags' }) : null, h('th', { text: 'SEO' }), h('th', { text: type === 'post' ? 'Date' : '' }))),
        tbody)
    ];
  }

  // ---------- editor ----------
  const today = () => new Date().toISOString().slice(0, 10);
  const blankDraft = () => ({ type: 'post', title: '', slug: '', description: '', category: '', tags: '', date: today(), template: 'post', featured: false, toc: false, body: '', existing: false });

  const KITS = [
    ['🚀 Landing page', { type: 'page', template: 'landing', body: ':::hero title="PressyCMS" subtitle="Lorem ipsum dolor sit amet, consectetur adipiscing elit." cta="Get started" href="/about/"\n:::\n\n::::stats\n:::stat value="0" label="Lorem"\n:::\n:::stat value="1" label="Ipsum"\n:::\n:::stat value="100" label="Dolor"\n:::\n::::\n\n## PressyCMS features\n\n::::cards columns="3"\n:::card title="Lorem" icon="⚡"\nIpsum dolor sit amet.\n:::\n:::card title="Ipsum" icon="🔒"\nConsectetur adipiscing elit.\n:::\n:::card title="Dolor" icon="🎨"\nSed do eiusmod tempor.\n:::\n::::\n\n::::section bg="accent" width="narrow"\n## PressyCMS: ready?\n\nLorem ipsum dolor sit amet.\n\n:::button href="/" style="secondary" label="Lorem ipsum"\n:::\n::::\n' }],
    ['📰 Article with FAQ', { type: 'post', template: 'post', toc: true, body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n## PressyCMS: lorem ipsum\n\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n:::callout type="tip" title="Lorem ipsum"\nUt enim ad minim veniam.\n:::\n\n## PressyCMS: dolor sit amet\n\nDuis aute irure dolor in reprehenderit.\n\n## PressyCMS FAQ\n\n::::faq\n:::q question="Lorem ipsum?"\nDolor sit amet.\n:::\n:::q question="Consectetur adipiscing?"\nSed do eiusmod tempor.\n:::\n::::\n' }],
    ['⭐ Review', { type: 'post', template: 'post', body: 'Lorem ipsum dolor sit amet.\n\n::::stats\n:::stat value="4.5/5" label="Overall"\n:::\n:::stat value="12h" label="Lorem"\n:::\n::::\n\n## PressyCMS verdict\n\n::::columns\n:::col\n### 👍 Lorem\n- Ipsum dolor\n- Sit amet\n:::\n:::col\n### 👎 Ipsum\n- Consectetur\n- Adipiscing\n:::\n::::\n\n:::testimonial author="Lorem Ipsum" role="Dolor"\nSed do eiusmod tempor.\n:::\n' }],
    ['📣 Announcement', { type: 'post', template: 'post', body: ':::callout type="success" title="Lorem ipsum"\nDolor sit amet, consectetur adipiscing elit.\n:::\n\n## PressyCMS: what\'s new\n\nSed do eiusmod tempor incididunt.\n\n:::button href="/" label="Lorem ipsum →"\n:::\n' }]
  ];

  function frontMatter(d) {
    const q = (s) => JSON.stringify(String(s));
    const lines = ['---', `title: ${q(d.title || 'Untitled')}`, `description: ${q(d.description)}`];
    if (d.type === 'post') {
      lines.push(`date: ${d.date || today()}`);
      if (d.category) lines.push(`category: ${q(d.category)}`);
      const tags = d.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tags.length) lines.push(`tags: [${tags.map(q).join(', ')}]`);
    }
    if (d.template && d.template !== (d.type === 'post' ? 'post' : 'page')) lines.push(`template: ${d.template}`);
    if (d.featured) lines.push('featured: true');
    if (d.toc) lines.push('toc: true');
    lines.push('---', '');
    return lines.join('\n') + d.body.replace(/^\n+/, '') + (d.body.endsWith('\n') ? '' : '\n');
  }

  function liveLint(d) {
    const out = [];
    if (!d.title) out.push(['error', 'Add a title.']);
    else if (d.title.length > 65) out.push(['warn', `Title is ${d.title.length} chars — aim for under 60.`]);
    if (!d.description) out.push(['warn', 'Add a meta description (70–160 chars).']);
    else if (d.description.length < 50 || d.description.length > 160) out.push(['warn', `Description is ${d.description.length} chars — aim for 70–160.`]);
    if (/^#\s/m.test(d.body)) out.push(['warn', 'Use ## for sections — the title is already the H1.']);
    if (/!\[\s*\]\(/.test(d.body)) out.push(['error', 'An image is missing alt text.']);
    if (/<\/?[a-zA-Z][^>]*>/.test(d.body.replace(/`[^`]*`/g, ''))) out.push(['warn', 'Raw HTML will be escaped. Use a block instead.']);
    const known = new Set(DATA.blocks.map((b) => b.name));
    for (const [, name] of d.body.matchAll(/^:{3,}[ \t]*([a-zA-Z][\w-]*)/gm)) if (!known.has(name.toLowerCase())) out.push(['error', `Unknown block :::${name}`]);
    const words = d.body.split(/\s+/).filter(Boolean).length;
    if (d.type === 'post' && words < 150) out.push(['info', `${words} words — longer posts tend to rank better.`]);
    return out;
  }

  function editorView() {
    const d = Object.assign(blankDraft(), store.get('draft') || {});
    const save = () => store.set('draft', d);

    const title = h('input', { class: 'ed-title', placeholder: 'Add title', value: d.title, 'aria-label': 'Title' });
    const ta = h('textarea', { spellcheck: 'true', 'aria-label': 'Content (markdown)', placeholder: 'Write markdown here, or drag a block in from the left…' });
    ta.value = d.body;
    const preview = h('div', { class: 'ed-preview', 'aria-live': 'off' });
    const panes = h('div', { class: 'ed-panes' }, ta, preview);
    const issues = h('ul', { class: 'issues' });
    const descHint = h('div', { class: 'hint' });
    const slugHint = h('div', { class: 'hint' });

    function insert(snippet) {
      const s = ta.selectionStart ?? ta.value.length;
      const before = ta.value.slice(0, s);
      const pad = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
      ta.setRangeText(pad + snippet + '\n', s, ta.selectionEnd ?? s, 'end');
      ta.focus();
      sync();
    }

    let timer = null;
    function sync() {
      d.title = title.value;
      d.body = ta.value;
      if (!d.existing) d.slug = (window.PressyCore.slugify(d.title) || '').slice(0, 80);
      slugHint.textContent = d.slug ? `URL: /${d.slug}/` : 'URL is generated from the title.';
      const len = d.description.length;
      descHint.textContent = `${len} characters (aim for 70–160)`;
      descHint.className = 'hint ' + (len >= 70 && len <= 160 ? 'good' : len ? 'bad' : '');
      save();
      clearTimeout(timer);
      timer = setTimeout(() => {
        preview.replaceChildren();
        if (d.title) preview.append(h('h1', { class: 'preview-title', text: d.title }));
        const holder = document.createElement('div');
        // Safe: the renderer escapes raw HTML and strips unsafe URLs (same code as the build).
        holder.innerHTML = renderMarkdown(d.body);
        preview.append(holder);
        const found = liveLint(d);
        issues.replaceChildren(...(found.length ? found.map(([lvl, msg]) => h('li', { class: lvl, text: msg })) : [h('li', { class: 'ok', text: 'Looks good — ready to publish.' })]));
      }, 120);
    }

    // Elementor-style drag & drop: dropping a tile on the textarea inserts its markdown at the drop point.
    ta.addEventListener('dragover', () => ta.classList.add('drop-target'));
    ta.addEventListener('dragleave', () => ta.classList.remove('drop-target'));
    ta.addEventListener('drop', () => { ta.classList.remove('drop-target'); setTimeout(sync, 0); });
    ta.addEventListener('input', sync);
    title.addEventListener('input', sync);
    ta.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); download(); }
    });

    const categories = {};
    for (const b of DATA.blocks) if (!b.child || ['col', 'card', 'stat', 'q'].includes(b.name)) (categories[b.category] = categories[b.category] || []).push(b);
    const palette = Object.entries(categories).map(([cat, list]) => [
      h('h3', { text: cat }),
      h('div', { class: 'palette' }, list.map((b) => h('button', {
        class: 'widget-tile', draggable: 'true', title: b.description, type: 'button',
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', '\n' + b.example + '\n'); e.dataTransfer.effectAllowed = 'copy'; },
        onclick: () => insert(b.example)
      }, h('span', { class: 'ic', text: b.icon }), b.label)))
    ]);
    const kits = h('div', { class: 'kit' }, KITS.map(([name, kit]) => h('button', { type: 'button', text: name, onclick: () => {
      if (ta.value.trim() && !confirm('Replace the current content with this template?')) return;
      Object.assign(d, kit);
      ta.value = kit.body;
      typeSel.value = d.type; tplSel.value = d.template; toc.checked = !!d.toc;
      sync();
    } })));

    const field = (label, input, hint) => h('div', { class: 'field' }, h('label', {}, label, input), hint || null);
    const bind = (el, key, prop = 'value') => { el[prop] = d[key]; el.addEventListener(prop === 'checked' ? 'change' : 'input', () => { d[key] = el[prop]; sync(); }); return el; };
    const typeSel = bind(h('select', {}, h('option', { value: 'post', text: 'Post' }), h('option', { value: 'page', text: 'Page' })), 'type');
    const tplSel = bind(h('select', {}, DATA.theme.templates.filter((t) => !['home', 'archive', '404'].includes(t)).map((t) => h('option', { value: t, text: t }))), 'template');
    const toc = bind(h('input', { type: 'checkbox' }), 'toc', 'checked');
    const catList = h('datalist', { id: 'cats' }, DATA.categories.map((c) => h('option', { value: c })));

    function download() {
      const blob = new Blob([frontMatter(d)], { type: 'text/markdown' });
      const a = h('a', { href: URL.createObjectURL(blob), download: (d.slug || 'untitled') + '.md' });
      document.body.append(a); a.click(); a.remove();
      toast('Downloaded ' + (d.slug || 'untitled') + '.md');
    }
    function publish() {
      if (!DATA.github) return toast('Set github.repo in pressy.config.json first');
      if (!d.slug) return toast('Add a title first');
      const md = frontMatter(d);
      const dir = `${DATA.github.contentDir || 'content'}/${d.type === 'post' ? 'posts' : 'pages'}`;
      if (d.existing && d.editUrl) {
        copy(md, 'Markdown copied — paste it into the GitHub editor');
        window.open(d.editUrl, '_blank', 'noopener');
        return;
      }
      const url = `https://github.com/${DATA.github.repo}/new/${DATA.github.branch}/${dir}?filename=${encodeURIComponent(d.slug + '.md')}&value=${encodeURIComponent(md)}`;
      if (url.length > 7000) {
        copy(md, 'Long post: markdown copied — paste it into GitHub');
        window.open(`https://github.com/${DATA.github.repo}/new/${DATA.github.branch}/${dir}?filename=${encodeURIComponent(d.slug + '.md')}`, '_blank', 'noopener');
      } else window.open(url, '_blank', 'noopener');
    }
    function askClaude() {
      const md = frontMatter(d);
      copy(`In the PressyCMS repo${DATA.github ? ' ' + DATA.github.repo : ''}, ${d.existing ? 'update' : 'create'} content/${d.type === 'post' ? 'posts' : 'pages'}/${d.slug || 'untitled'}.md with the markdown below. Polish the writing, fix anything \`npx pressy lint\` reports, and open a pull request.\n\n${md}`, 'Prompt copied — paste it into Claude');
    }

    const viewSeg = h('span', { class: 'seg', role: 'group', 'aria-label': 'View' },
      ['Split', 'Write', 'Preview'].map((label, i) => h('button', { type: 'button', 'aria-pressed': i === 0 ? 'true' : 'false', text: label, onclick: (e) => {
        viewSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        panes.className = 'ed-panes' + (i === 1 ? ' only-write' : i === 2 ? ' only-preview' : '');
      } })));

    setTimeout(sync, 0);
    return [
      h('h1', {}, d.existing ? 'Edit ' + (d.type === 'post' ? 'Post' : 'Page') : 'Add New', ' ', h('span', { class: 'subsubsub', text: 'Drafts autosave in this browser' })),
      h('div', { class: 'editor' },
        h('aside', { class: 'ed-panel' }, h('h3', { text: 'Templates' }), kits, ...palette.flat()),
        h('div', { class: 'ed-main' },
          h('div', { class: 'ed-toolbar' },
            viewSeg,
            h('button', { class: 'btn btn-sm', type: 'button', text: 'New', onclick: () => { if (confirm('Start a new blank draft?')) { store.set('draft', blankDraft()); render(); } } }),
            h('span', { class: 'spacer' }),
            h('button', { class: 'btn', type: 'button', text: '🤖 Ask Claude', onclick: askClaude }),
            h('button', { class: 'btn', type: 'button', text: '⬇ .md', title: 'Download (Ctrl/Cmd+S)', onclick: download }),
            h('button', { class: 'btn btn-primary', type: 'button', text: d.existing ? 'Update on GitHub' : 'Publish via GitHub', onclick: publish })),
          title, panes),
        h('aside', { class: 'ed-panel right' },
          h('h3', { text: 'Document' }),
          field('Type', typeSel),
          field('Template', tplSel),
          h('div', { class: 'field' }, slugHint),
          field('Meta description', bind(h('textarea', { maxlength: '300' }), 'description'), descHint),
          field('Category', bind(h('input', { list: 'cats' }), 'category')), catList,
          field('Tags (comma separated)', bind(h('input', {}), 'tags')),
          field('Date', bind(h('input', { type: 'date' }), 'date')),
          h('div', { class: 'field' }, h('label', { class: 'check' }, bind(h('input', { type: 'checkbox' }), 'featured', 'checked'), 'Featured on homepage')),
          h('div', { class: 'field' }, h('label', { class: 'check' }, toc, 'Table of contents')),
          h('h3', { text: 'SEO & accessibility' }),
          issues))
    ];
  }

  async function openInEditor(p) {
    let body = '';
    try {
      const res = await fetch(p.markdown);
      body = (await res.text()).replace(/^# .*\n\n?/, '');
    } catch { toast('Could not load markdown'); return; }
    store.set('draft', { ...blankDraft(), type: p.type, title: p.title, slug: p.slug, description: p.description, category: p.category || '', tags: (p.tags || []).join(', '), date: p.date || today(), template: p.template, body, existing: true, editUrl: p.editUrl });
    location.hash = '#new';
  }

  // ---------- router ----------
  function render() {
    const route = (location.hash.slice(1) || 'dashboard').split('?')[0];
    const fn = routes[route] || routes.dashboard;
    document.querySelectorAll('.menu a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.route === route));
    view.replaceChildren(...fn().flat().filter((n) => n != null && n !== false));
    document.title = `${(document.querySelector('.menu a[aria-current]') || {}).textContent || 'Dashboard'} ‹ ${DATA.site.title}`.replace(/^\W+\s*/, '');
    view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  async function init() {
    try {
      DATA = await (await fetch('data.json', { cache: 'no-store' })).json();
    } catch {
      view.replaceChildren(h('p', { class: 'notice warn', text: 'Could not load data.json — run `npm run build` first.' }));
      return;
    }
    const md = new window.marked.Marked({ gfm: true });
    md.use({ renderer: window.PressyCore.safeRenderer({ allowRawHtml: false }) });
    const blocks = { ...window.PressyCore.BLOCKS };
    for (const b of DATA.blocks) if (!blocks[b.name]) blocks[b.name] = { render: () => `<div class="pb-callout pb-callout-info"><div>🧩 ${window.PressyCore.escapeHtml(b.label)} — rendered at build time by the ${window.PressyCore.escapeHtml(b.plugin || '')} plugin.</div></div>` };
    renderMarkdown = window.PressyCore.createRenderer({ md, blocks });
    document.getElementById('ab-site').textContent = DATA.site.title;
    window.addEventListener('hashchange', render);
    render();
  }
  init();
})();
