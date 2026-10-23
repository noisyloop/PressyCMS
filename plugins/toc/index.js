'use strict';
const MARKER = '<!--pressy-toc-->';

module.exports = (pressy) => {
  const levels = pressy.options.levels || [2, 3];
  const title = pressy.options.title || 'On this page';

  pressy.registerBlock('toc', {
    label: 'Table of contents', icon: '📑', category: 'seo',
    description: 'Lists the headings on this page with jump links.',
    example: ':::toc\n:::',
    render: () => MARKER
  });

  // Posts with `toc: true` get one automatically before the first H2.
  pressy.addFilter('post', (doc) => {
    if (doc.toc && !/^:{3,}[ \t]*toc\b/m.test(doc.body)) {
      const i = doc.body.search(/^##\s/m);
      const body = i === -1 ? doc.body : doc.body.slice(0, i) + ':::toc\n:::\n\n' + doc.body.slice(i);
      return { ...doc, body };
    }
    return doc;
  });

  pressy.addFilter('html', (html, { doc }) => {
    if (!html.includes(MARKER)) return html;
    // Only the document's own headings — not the theme's.
    const source = doc && doc.html ? doc.html : html;
    const re = new RegExp(`<h([${levels.join('')}]) id="([^"]+)">([\\s\\S]*?)</h\\1>`, 'g');
    const items = [...source.matchAll(re)].map(([, level, id, inner]) => ({ level: +level, id, text: inner.replace(/<[^>]+>/g, '') }));
    if (!items.length) return html.replace(MARKER, '');
    const top = Math.min(...items.map((i) => i.level));
    let out = '<ol>';
    let depth = top;
    items.forEach((it, idx) => {
      while (it.level > depth) { out += '<ol>'; depth++; }
      while (it.level < depth) { out += '</li></ol>'; depth--; }
      if (idx > 0 && it.level === depth && out.slice(-4) !== '<ol>') out += '</li>';
      out += `<li><a href="#${it.id}">${it.text}</a>`;
    });
    while (depth > top) { out += '</li></ol>'; depth--; }
    out += '</li></ol>';
    return html.replace(MARKER, `<nav class="pb-toc" aria-label="Table of contents"><p class="pb-toc-title">${title.replace(/[<>&"]/g, '')}</p>${out}</nav>`);
  });
};
