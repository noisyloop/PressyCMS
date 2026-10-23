'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createMarkdown } = require('../src/markdown');
const core = require('../src/shared/pressy-core');
const { createEngine } = require('../src/template');
const { lintDoc } = require('../src/lint');
const { toDoc } = require('../src/content');
const { safeOutPath } = require('../src/plugins');

const md = createMarkdown();

test('raw HTML is escaped, not executed', () => {
  const html = md('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
});

test('dangerous URL schemes are neutralised', () => {
  for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.example']) {
    assert.match(md(`[x](${url})`), /href="#"/, url);
  }
  assert.match(md('[x](https://example.com)'), /rel="noopener noreferrer"/);
});

test('safeUrl normalises URLs the way browsers do before checking the scheme', () => {
  for (const url of ['java\tscript:alert(1)', 'java\nscript:alert(1)', 'java\rscript:alert(1)', '\x01javascript:alert(1)', ' \x00javascript:alert(1)', '/\\evil.example', '\\\\evil.example', '\\/evil.example']) {
    assert.strictEqual(core.safeUrl(url), '#', JSON.stringify(url));
  }
  assert.match(md('[x](<java\tscript:alert(1)>)'), /href="#"/);
  for (const block of ['button', 'card', 'hero']) {
    const html = md(`:::${block} title="x" cta="x" href="java\tscript:alert(1)"\n:::`);
    assert.ok(!/script:/.test(html), block);
  }
});

test('block attributes are escaped', () => {
  const html = md(':::callout title="<img src=x onerror=alert(1)>"\nhi\n:::');
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img src=x'));
});

test('nested blocks render and code fences are left alone', () => {
  const html = md('::::columns\n:::col\n**a**\n:::\n:::col\n```\n:::fake\n```\n:::\n::::');
  assert.match(html, /<div class="pb-columns[^"]*"><div class="pb-col"><p><strong>a<\/strong>/);
  assert.ok(html.includes(':::fake'));
});

test('content cannot forge block placeholders', () => {
  assert.match(md('PRESSYBLOCKabcX0'), /<p>PRESSYBLOCKabcX0<\/p>/);
});

test('FAQ blocks collect structured data', () => {
  const ctx = {};
  md('::::faq\n:::q question="Why?"\nBecause.\n:::\n::::', ctx);
  assert.deepStrictEqual(ctx.collected.faq.map((q) => q.question), ['Why?']);
});

test('templates escape by default', () => {
  const engine = createEngine({ partials: { p: '[{{x}}]' } });
  assert.strictEqual(engine.render('{{x}}|{{{x}}}|{{> p}}', { x: '<b>' }), '&lt;b&gt;|<b>|[&lt;b&gt;]');
  assert.strictEqual(engine.render('{{#each xs}}{{this}}{{#unless @last}},{{/unless}}{{/each}}', { xs: [1, 2, 3] }), '1,2,3');
  assert.strictEqual(engine.render('{{#if a}}y{{else}}n{{/if}}', { a: [] }), 'n');
});

test('lint catches missing alt text and unknown blocks', () => {
  const doc = toDoc({ title: 'Lorem', description: 'x'.repeat(100), date: '2026-01-01' }, '![](/a.png)\n\n:::nope\n:::', { name: 'lorem.md', type: 'post' });
  const rules = lintDoc(doc).map((i) => i.rule);
  assert.ok(rules.includes('img-alt'));
  assert.ok(rules.includes('unknown-block'));
});

test('plugins cannot write outside dist', () => {
  assert.throws(() => safeOutPath('../../etc/passwd'));
  assert.strictEqual(safeOutPath('/search-index.json'), 'search-index.json');
});

test('safeUrl keeps relative links', () => {
  assert.strictEqual(core.safeUrl('/about/'), '/about/');
  assert.strictEqual(core.safeUrl('#top'), '#top');
  assert.strictEqual(core.safeUrl('mailto:a@b.c'), 'mailto:a@b.c');
});
