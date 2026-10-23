'use strict';
module.exports = (pressy) => {
  const limit = Number(pressy.options.limit) || 3;
  pressy.addFilter('docs', (docs) => {
    const posts = docs.filter((d) => d.type === 'post');
    return docs.map((d) => {
      if (d.type !== 'post') return d;
      const mine = new Set(d.tags.map((t) => t.slug));
      const related = posts
        .filter((o) => o.slug !== d.slug)
        .map((o) => ({ o, score: o.tags.filter((t) => mine.has(t.slug)).length * 2 + (o.categorySlug === d.categorySlug ? 1 : 0) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || b.o.date.localeCompare(a.o.date))
        .slice(0, limit)
        .map(({ o }) => ({ title: o.title, path: o.path }));
      return { ...d, related };
    });
  });
};
