/* PressyCMS core — shared by the Node build and the in-browser editor preview.
   Holds the block library (Elementor-style widgets written in markdown),
   URL/HTML escaping, and the safe marked renderer. No dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PressyCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const slugify = (s) => String(s).toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

  // Only relative URLs, fragments and a short list of schemes survive.
  // Everything else (javascript:, data:, vbscript:, …) collapses to '#'.
  // Browsers drop tabs/newlines anywhere in a URL and control characters at
  // either end, so normalise the same way first — otherwise "java\tscript:"
  // passes the scheme check and still runs as javascript:.
  function safeUrl(url) {
    const u = String(url == null ? '' : url).replace(/[\t\n\r]/g, '').replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '');
    if (!u) return '#';
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '#';
    if (/^[\/\\]{2}/.test(u)) return '#'; // protocol-relative; browsers read "\" as "/"
    return u;
  }

  const isExternal = (url) => /^https?:\/\//i.test(url);

  // key="value" key='value' key=value flag
  function parseAttrs(str) {
    const attrs = {};
    const re = /([a-zA-Z][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;
    let m;
    while ((m = re.exec(str || ''))) {
      attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? true;
    }
    return attrs;
  }

  const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

  // ---------- Block library ----------
  // Each block: { label, icon, description, attrs: {name: {required?, values?, default?}},
  //               example, render(attrs, innerHtml, ctx) }
  // innerHtml is the block's body already rendered from markdown (nested blocks included).
  const BLOCKS = {
    hero: {
      label: 'Hero', icon: '🦸', category: 'layout',
      description: 'Full-width banner with a headline, subtitle and call-to-action button.',
      attrs: { title: { required: true }, subtitle: {}, cta: {}, href: {}, align: { values: ['center', 'left'], default: 'center' } },
      example: ':::hero title="PressyCMS" subtitle="Lorem ipsum dolor sit amet." cta="Get started" href="/about/"\n:::',
      render(a, inner) {
        const align = pick(a.align, ['center', 'left'], 'center');
        const btn = a.cta ? `<p class="pb-hero-actions"><a class="pb-btn pb-btn-primary" href="${escapeHtml(safeUrl(a.href || '#'))}">${escapeHtml(a.cta)}</a></p>` : '';
        return `<section class="pb-hero pb-align-${align}"><div class="pb-hero-inner">` +
          `<h2 class="pb-hero-title">${escapeHtml(a.title || '')}</h2>` +
          (a.subtitle ? `<p class="pb-hero-sub">${escapeHtml(a.subtitle)}</p>` : '') +
          inner + btn + '</div></section>';
      }
    },
    section: {
      label: 'Section', icon: '▭', category: 'layout',
      description: 'A styled band to group content. Backgrounds: light, dark, accent.',
      attrs: { bg: { values: ['none', 'light', 'dark', 'accent'], default: 'light' }, width: { values: ['narrow', 'wide'], default: 'wide' } },
      example: '::::section bg="light"\n## PressyCMS section\n\nLorem ipsum dolor sit amet.\n::::',
      render(a, inner) {
        const bg = pick(a.bg, ['none', 'light', 'dark', 'accent'], 'light');
        const width = pick(a.width, ['narrow', 'wide'], 'wide');
        return `<section class="pb-section pb-bg-${bg} pb-w-${width}">${inner}</section>`;
      }
    },
    columns: {
      label: 'Columns', icon: '▥', category: 'layout',
      description: 'Side-by-side columns. Put `:::col` blocks inside a `::::columns` block.',
      attrs: { gap: { values: ['sm', 'md', 'lg'], default: 'md' } },
      example: '::::columns\n:::col\n### Lorem\nIpsum dolor sit amet.\n:::\n:::col\n### Ipsum\nConsectetur adipiscing elit.\n:::\n::::',
      render(a, inner) {
        return `<div class="pb-columns pb-gap-${pick(a.gap, ['sm', 'md', 'lg'], 'md')}">${inner}</div>`;
      }
    },
    col: {
      label: 'Column', icon: '▯', category: 'layout', child: true,
      description: 'One column inside `columns`.',
      attrs: {},
      example: ':::col\nLorem ipsum.\n:::',
      render(a, inner) { return `<div class="pb-col">${inner}</div>`; }
    },
    callout: {
      label: 'Callout', icon: '💡', category: 'content',
      description: 'Highlighted note. Types: info, tip, warning, success.',
      attrs: { type: { values: ['info', 'tip', 'warning', 'success'], default: 'info' }, title: {} },
      example: ':::callout type="tip" title="Lorem ipsum"\nDolor sit amet, consectetur adipiscing elit.\n:::',
      render(a, inner) {
        const type = pick(a.type, ['info', 'tip', 'warning', 'success'], 'info');
        const icon = { info: 'ℹ️', tip: '💡', warning: '⚠️', success: '✅' }[type];
        return `<aside class="pb-callout pb-callout-${type}" role="note"><span class="pb-callout-icon" aria-hidden="true">${icon}</span><div>` +
          (a.title ? `<p class="pb-callout-title">${escapeHtml(a.title)}</p>` : '') + inner + '</div></aside>';
      }
    },
    button: {
      label: 'Button', icon: '🔘', category: 'content',
      description: 'A call-to-action link styled as a button.',
      attrs: { href: { required: true }, label: {}, style: { values: ['primary', 'secondary'], default: 'primary' } },
      example: ':::button href="/about/" label="Lorem ipsum →"\n:::',
      render(a, inner, ctx) {
        const href = safeUrl(a.href);
        const ext = isExternal(href) ? ' rel="noopener noreferrer" target="_blank"' : '';
        const label = a.label ? escapeHtml(a.label) : (inner.replace(/<\/?p>/g, '').trim() || 'Learn more');
        return `<p class="pb-button-wrap"><a class="pb-btn pb-btn-${pick(a.style, ['primary', 'secondary'], 'primary')}" href="${escapeHtml(href)}"${ext}>${label}</a></p>`;
      }
    },
    cards: {
      label: 'Card grid', icon: '🗂️', category: 'layout',
      description: 'A responsive grid of cards. Put `:::card` blocks inside `::::cards`.',
      attrs: { columns: { values: ['2', '3', '4'], default: '3' } },
      example: '::::cards columns="3"\n:::card title="Lorem" icon="⚡"\nIpsum dolor sit amet.\n:::\n:::card title="Ipsum" icon="🔒"\nConsectetur adipiscing.\n:::\n::::',
      render(a, inner) {
        return `<div class="pb-cards pb-cols-${pick(String(a.columns), ['2', '3', '4'], '3')}">${inner}</div>`;
      }
    },
    card: {
      label: 'Card', icon: '🃏', category: 'content', child: true,
      description: 'A single card with optional icon, title and link.',
      attrs: { title: {}, icon: {}, href: {} },
      example: ':::card title="Lorem ipsum" icon="✨" href="/about/"\nDolor sit amet.\n:::',
      render(a, inner) {
        const title = a.title ? escapeHtml(a.title) : '';
        const heading = a.href
          ? `<h3 class="pb-card-title"><a href="${escapeHtml(safeUrl(a.href))}">${title}</a></h3>`
          : (title ? `<h3 class="pb-card-title">${title}</h3>` : '');
        return `<div class="pb-card">${a.icon ? `<span class="pb-card-icon" aria-hidden="true">${escapeHtml(a.icon)}</span>` : ''}${heading}${inner}</div>`;
      }
    },
    stats: {
      label: 'Stats row', icon: '📊', category: 'layout',
      description: 'A row of big numbers. Put `:::stat` blocks inside `::::stats`.',
      attrs: {},
      example: '::::stats\n:::stat value="0" label="Databases"\n:::\n:::stat value="100" label="Lighthouse"\n:::\n::::',
      render(a, inner) { return `<div class="pb-stats">${inner}</div>`; }
    },
    stat: {
      label: 'Stat', icon: '#️⃣', category: 'content', child: true,
      description: 'One number and label inside `stats`.',
      attrs: { value: { required: true }, label: { required: true } },
      example: ':::stat value="42" label="Lorem ipsum"\n:::',
      render(a) {
        return `<div class="pb-stat"><span class="pb-stat-value">${escapeHtml(a.value || '')}</span><span class="pb-stat-label">${escapeHtml(a.label || '')}</span></div>`;
      }
    },
    testimonial: {
      label: 'Testimonial', icon: '💬', category: 'content',
      description: 'A pull quote with attribution.',
      attrs: { author: { required: true }, role: {} },
      example: ':::testimonial author="Lorem Ipsum" role="Dolor Sit"\nConsectetur adipiscing elit, sed do eiusmod tempor.\n:::',
      render(a, inner) {
        return `<figure class="pb-testimonial"><blockquote>${inner}</blockquote><figcaption><strong>${escapeHtml(a.author || '')}</strong>` +
          (a.role ? ` <span>${escapeHtml(a.role)}</span>` : '') + '</figcaption></figure>';
      }
    },
    faq: {
      label: 'FAQ', icon: '❓', category: 'seo',
      description: 'Accordion of questions. Emits FAQPage structured data for rich results. Put `:::q` blocks inside `::::faq`.',
      attrs: {},
      example: '::::faq\n:::q question="Lorem ipsum dolor?"\nSit amet, consectetur adipiscing elit.\n:::\n::::',
      render(a, inner) { return `<div class="pb-faq">${inner}</div>`; }
    },
    q: {
      label: 'FAQ item', icon: '❔', category: 'seo', child: true,
      description: 'One question and answer inside `faq`.',
      attrs: { question: { required: true } },
      example: ':::q question="Lorem ipsum?"\nDolor sit amet.\n:::',
      render(a, inner, ctx) {
        if (ctx && ctx.collect) ctx.collect('faq', { question: a.question || '', answerHtml: inner });
        return `<details class="pb-faq-item"><summary>${escapeHtml(a.question || '')}</summary><div class="pb-faq-answer">${inner}</div></details>`;
      }
    },
    image: {
      label: 'Image', icon: '🖼️', category: 'media',
      description: 'An image with required alt text and an optional caption.',
      attrs: { src: { required: true }, alt: { required: true }, caption: {}, size: { values: ['normal', 'wide', 'full'], default: 'normal' } },
      example: ':::image src="/media/sample.svg" alt="Lorem ipsum illustration" caption="Lorem ipsum dolor sit amet."\n:::',
      render(a) {
        const size = pick(a.size, ['normal', 'wide', 'full'], 'normal');
        return `<figure class="pb-image pb-size-${size}"><img src="${escapeHtml(safeUrl(a.src))}" alt="${escapeHtml(a.alt || '')}" loading="lazy" decoding="async">` +
          (a.caption ? `<figcaption>${escapeHtml(a.caption)}</figcaption>` : '') + '</figure>';
      }
    },
    divider: {
      label: 'Divider', icon: '➖', category: 'layout',
      description: 'A decorative horizontal rule.',
      attrs: { style: { values: ['line', 'dots'], default: 'line' } },
      example: ':::divider style="dots"\n:::',
      render(a) { return `<hr class="pb-divider pb-divider-${pick(a.style, ['line', 'dots'], 'line')}">`; }
    },
    spacer: {
      label: 'Spacer', icon: '↕️', category: 'layout',
      description: 'Vertical whitespace: sm, md, lg, xl.',
      attrs: { size: { values: ['sm', 'md', 'lg', 'xl'], default: 'md' } },
      example: ':::spacer size="lg"\n:::',
      render(a) { return `<div class="pb-spacer pb-spacer-${pick(a.size, ['sm', 'md', 'lg', 'xl'], 'md')}" aria-hidden="true"></div>`; }
    }
  };

  const OPEN_RE = /^(:{3,})\s*([a-zA-Z][\w-]*)\s*(.*)$/;
  const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;

  // Find blocks at the top level of `src`. Returns a list of segments:
  // strings (plain markdown) and { name, attrs, inner, line } block nodes.
  function scanBlocks(src) {
    const lines = String(src).split('\n');
    const out = [];
    let buf = [];
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const f = line.match(FENCE_RE);
      if (fence) {
        if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
        buf.push(line);
        continue;
      }
      if (f) { fence = f[1]; buf.push(line); continue; }
      const m = line.match(OPEN_RE);
      if (!m) { buf.push(line); continue; }
      const colons = m[1].length;
      const closeRe = new RegExp('^:{' + colons + '}\\s*$');
      const openSameRe = new RegExp('^:{' + colons + '}\\s*[a-zA-Z]');
      let depth = 1;
      let innerFence = null;
      let j = i + 1;
      for (; j < lines.length; j++) {
        const l = lines[j];
        const ff = l.match(FENCE_RE);
        if (innerFence) { if (ff && ff[1][0] === innerFence[0] && ff[1].length >= innerFence.length) innerFence = null; continue; }
        if (ff) { innerFence = ff[1]; continue; }
        if (openSameRe.test(l)) depth++;
        else if (closeRe.test(l) && --depth === 0) break;
      }
      if (j >= lines.length) { buf.push(line); continue; } // unclosed: leave as text
      if (buf.length) { out.push(buf.join('\n')); buf = []; }
      out.push({ name: m[2].toLowerCase(), attrs: parseAttrs(m[3]), inner: lines.slice(i + 1, j).join('\n'), line: i + 1 });
      i = j;
    }
    if (buf.length) out.push(buf.join('\n'));
    return out;
  }

  // Walk every block (recursively) — used by lint to validate names/attrs.
  function walkBlocks(src, visit, depth = 0) {
    for (const seg of scanBlocks(src)) {
      if (typeof seg === 'string') continue;
      visit(seg, depth);
      walkBlocks(seg.inner, visit, depth + 1);
    }
  }

  function randomNonce() {
    let s = '';
    for (let i = 0; i < 12; i++) s += Math.floor(Math.random() * 36).toString(36);
    return s;
  }

  // Marked renderer overrides that make untrusted markdown safe to publish.
  function safeRenderer(opts) {
    const allowRawHtml = !!(opts && opts.allowRawHtml);
    return {
      html({ text }) { return allowRawHtml ? text : escapeHtml(text); },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const url = safeUrl(href);
        const ext = isExternal(url);
        const rel = /^\/go\//.test(url) ? ' rel="noopener sponsored" target="_blank"'
          : ext ? ' rel="noopener noreferrer" target="_blank"' : '';
        return `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ''}${rel}>${text}</a>`;
      },
      image({ href, title, text }) {
        return `<img src="${escapeHtml(safeUrl(href))}" alt="${escapeHtml(text || '')}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" decoding="async">`;
      },
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const plain = html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, '');
        const ids = this.options.pressyIds || (this.options.pressyIds = new Set());
        let id = slugify(plain) || 'section';
        let n = 2;
        while (ids.has(id)) id = `${slugify(plain) || 'section'}-${n++}`;
        ids.add(id);
        return `<h${depth} id="${id}">${html}</h${depth}>\n`;
      }
    };
  }

  // Render markdown (with blocks) to HTML.
  // md: a configured marked instance exposing parse(); blocks: registry.
  function createRenderer({ md, blocks = BLOCKS, onUnknown }) {
    function render(src, ctx) {
      ctx = ctx || {};
      ctx.collected = ctx.collected || {};
      if (!ctx.collect) ctx.collect = (key, value) => { (ctx.collected[key] = ctx.collected[key] || []).push(value); };
      if (!ctx.headingIds) ctx.headingIds = new Set();
      const nonce = randomNonce();
      const rendered = [];
      let mdSrc = '';
      for (const seg of scanBlocks(src)) {
        if (typeof seg === 'string') { mdSrc += seg + '\n'; continue; }
        const def = blocks[seg.name];
        let html;
        if (!def) {
          html = onUnknown ? onUnknown(seg) : `<div class="pb-unknown">Unknown block “${escapeHtml(seg.name)}”</div>`;
        } else {
          const inner = seg.inner.trim() ? render(seg.inner, ctx) : '';
          html = def.render(seg.attrs, inner, ctx);
        }
        mdSrc += `\n\nPRESSYBLOCK${nonce}X${rendered.length}\n\n`;
        rendered.push(html);
      }
      const out = md.parse(mdSrc, { pressyIds: ctx.headingIds });
      return out.replace(new RegExp(`(?:<p>)?PRESSYBLOCK${nonce}X(\\d+)(?:</p>)?\\n?`, 'g'), (_, i) => rendered[+i]);
    }
    return render;
  }

  return { BLOCKS, escapeHtml, slugify, safeUrl, isExternal, parseAttrs, scanBlocks, walkBlocks, safeRenderer, createRenderer };
});
