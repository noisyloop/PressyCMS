/* PressyCMS instant search — runs only on /search/. */
(function () {
  const form = document.querySelector('[data-pressy-search]');
  if (!form) return;
  const input = form.querySelector('input');
  const list = document.querySelector('.search-results');
  const status = document.querySelector('.search-status');
  let index = null;

  const tokens = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/\W+/).filter(Boolean);

  function score(doc, terms) {
    let s = 0;
    const t = doc.t.toLowerCase(), d = (doc.d || '').toLowerCase(), b = doc.b.toLowerCase(), g = doc.g.join(' ').toLowerCase();
    for (const term of terms) {
      const hit = (t.includes(term) ? 10 : 0) + (g.includes(term) ? 5 : 0) + (d.includes(term) ? 3 : 0) + (b.includes(term) ? 1 : 0);
      if (!hit) return 0;
      s += hit;
    }
    return s;
  }

  function render(q) {
    const terms = tokens(q);
    list.replaceChildren();
    if (!terms.length) { status.textContent = ''; return; }
    const hits = index.map((doc) => ({ doc, s: score(doc, terms) })).filter((h) => h.s > 0).sort((a, b) => b.s - a.s).slice(0, 25);
    status.textContent = `${hits.length} result${hits.length === 1 ? '' : 's'} for “${q}”`;
    for (const { doc } of hits) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = doc.u;
      a.textContent = doc.t;
      const p = document.createElement('p');
      p.textContent = (doc.c ? doc.c + ' — ' : '') + doc.d;
      li.append(a, p);
      list.append(li);
    }
  }

  const q = new URLSearchParams(location.search).get('q') || '';
  input.value = q;
  fetch('/search-index.json').then((r) => r.json()).then((data) => {
    index = data;
    render(input.value);
  });
  input.addEventListener('input', () => {
    if (!index) return;
    render(input.value);
    const url = new URL(location.href);
    url.searchParams.set('q', input.value);
    history.replaceState(null, '', url);
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); if (index) render(input.value); });
})();
