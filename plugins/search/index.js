'use strict';
module.exports = (pressy) => {
  pressy.addScript('search.js');
  pressy.addPage({
    path: '/search/',
    title: 'Search',
    description: 'Search every post and page.',
    noindex: true,
    html: `<form class="search-form" action="/search/" method="get" role="search" data-pressy-search>
  <label class="sr-only" for="search-q">Search</label>
  <input id="search-q" name="q" type="search" placeholder="Type to search…" autocomplete="off">
  <button type="submit">Search</button>
</form>
<p class="search-status" aria-live="polite"></p>
<ol class="search-results"></ol>
<noscript><p>Search needs JavaScript. Browse the <a href="/sitemap.xml">sitemap</a> instead.</p></noscript>`
  });
  pressy.addAction('build:end', ({ docs }) => {
    const index = docs.filter((d) => !d.noindex).map((d) => ({
      t: d.title,
      u: d.path,
      d: d.description || d.excerpt,
      c: d.category || '',
      g: d.tags.map((t) => t.name),
      b: d.body.replace(/^:{3,}.*$/gm, '').replace(/[#>*_`[\]()!|-]/g, ' ').replace(/\s+/g, ' ').slice(0, 5000)
    }));
    pressy.emitFile('search-index.json', JSON.stringify(index));
  });
};
