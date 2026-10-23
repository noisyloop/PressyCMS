'use strict';
/* SEO + machine-readable outputs: sitemap, robots, RSS, JSON-LD, llms.txt,
   security headers. Everything here is generated — nothing to install. */

const { escapeHtml } = require('./shared/pressy-core');

const xml = (s) => escapeHtml(s);

// JSON inside <script> must not be able to close the tag.
const jsonForScript = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

const ldScript = (obj) => `<script type="application/ld+json">${jsonForScript(obj)}</script>`;

function absolute(site, p) {
  if (!p) return '';
  return /^https?:\/\//.test(p) ? p : site.url + (p.startsWith('/') ? p : '/' + p);
}

function articleLd(site, doc) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: doc.title,
    description: doc.description,
    datePublished: doc.date,
    dateModified: doc.updated || doc.date,
    author: { '@type': 'Person', name: doc.author || site.author },
    publisher: { '@type': 'Organization', name: site.title, logo: site.logo ? { '@type': 'ImageObject', url: absolute(site, site.logo) } : undefined },
    image: doc.image ? absolute(site, doc.image) : undefined,
    mainEntityOfPage: doc.url,
    articleSection: doc.category || undefined,
    keywords: doc.tags.map((t) => t.name).join(', ') || undefined,
    wordCount: doc.wordCount
  };
}

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url }))
  };
}

function websiteLd(site, { search } = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.title,
    url: site.url + '/',
    description: site.description,
    inLanguage: site.language,
    potentialAction: search ? { '@type': 'SearchAction', target: `${site.url}/search/?q={search_term_string}`, 'query-input': 'required name=search_term_string' } : undefined
  };
}

function faqLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answerHtml.replace(/<[^>]+>/g, '').trim() }
    }))
  };
}

function sitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

function robots(site, { disallow = [] } = {}) {
  return ['User-agent: *', 'Allow: /', ...disallow.map((d) => `Disallow: ${d}`), '', `Sitemap: ${site.url}/sitemap.xml`, ''].join('\n');
}

function rss(site, posts) {
  const items = posts.slice(0, 20).map((p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${xml(p.url)}</link>
      <guid isPermaLink="true">${xml(p.url)}</guid>
      <pubDate>${new Date(p.date + 'T00:00:00Z').toUTCString()}</pubDate>
      ${p.category ? `<category>${xml(p.category)}</category>` : ''}
      <description>${xml(p.description)}</description>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(site.title)}</title>
    <link>${xml(site.url)}/</link>
    <description>${xml(site.description)}</description>
    <language>${xml(site.language)}</language>
    <atom:link href="${xml(site.url)}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

// llms.txt — a plain-text map of the site for AI agents (https://llmstxt.org).
function llmsTxt(site, posts, pages) {
  const line = (d) => `- [${d.title}](${d.url}): ${d.description || ''}`.trim();
  return `# ${site.title}

> ${site.description}

Every page on this site is also available as raw markdown — add \`index.md\` to any URL (e.g. ${site.url}/about/index.md).
A full JSON index lives at ${site.url}/api/content.json.

## Posts

${posts.map(line).join('\n')}

## Pages

${pages.map(line).join('\n')}
`;
}

function llmsFull(site, docs) {
  return `# ${site.title} — full content\n\n` + docs.map((d) => `---\n\n# ${d.title}\n\nURL: ${d.url}\n\n${d.body.trim()}\n`).join('\n');
}

const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests'
].join('; ');

const contentSecurityPolicy = (config) => config.security.contentSecurityPolicy || DEFAULT_CSP;

// The same policy as a <meta> tag, for hosts that ignore _headers (GitHub
// Pages, S3, the dev server). Browsers ignore frame-ancestors, sandbox and
// reporting in a meta tag; upgrade-insecure-requests would break plain-http
// local previews. _headers still sends all of them.
const META_SKIP = new Set(['frame-ancestors', 'sandbox', 'report-uri', 'report-to', 'upgrade-insecure-requests']);
function metaCsp(config) {
  return contentSecurityPolicy(config).split(';').map((d) => d.trim())
    .filter((d) => d && !META_SKIP.has(d.split(/\s+/)[0].toLowerCase())).join('; ');
}

// Insert the CSP meta tag right after <meta charset>, before anything it governs.
function injectMetaCsp(html, config) {
  if (/http-equiv=["']?content-security-policy/i.test(html)) return html;
  const tag = `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(metaCsp(config))}">`;
  return html.replace(/<meta charset[^>]*>/i, (m) => `${m}\n  ${tag}`);
}

function headersFile(config, extra = []) {
  const csp = contentSecurityPolicy(config);
  const lines = [
    '# Generated by PressyCMS — Cloudflare Pages / Netlify _headers format',
    '/*',
    '  X-Frame-Options: DENY',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()',
    '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
    '  Cross-Origin-Opener-Policy: same-origin',
    `  Content-Security-Policy: ${csp}`,
    ...extra.map((h) => `  ${h.header}: ${h.value}`),
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '/theme/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/admin/*',
    '  X-Robots-Tag: noindex, nofollow',
    '  Cache-Control: no-cache',
    ''
  ];
  return lines.join('\n');
}

module.exports = { ldScript, jsonForScript, articleLd, breadcrumbLd, websiteLd, faqLd, sitemap, robots, rss, llmsTxt, llmsFull, headersFile, metaCsp, injectMetaCsp, absolute, DEFAULT_CSP };
