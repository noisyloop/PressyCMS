# What people dislike about WordPress, and what PressyCMS does differently

WordPress runs a huge part of the web, and it earned that. But the same complaints keep showing up in forums, surveys, agency post-mortems and security advisories. PressyCMS was designed against that list.

| # | Common WordPress complaint | Why it happens | PressyCMS answer |
|---|---|---|---|
| 1 | **Plugin vulnerabilities.** Security trackers such as WPScan and Patchstack attribute the overwhelming majority of WordPress vulnerabilities to plugins and themes, not core. | Plugins run as full PHP on every request with access to the database, filesystem and admin. | Plugins run **only at build time**, never on the live site. Each declares permissions in `plugin.json` (`filters`, `files`, `pages`…) and the API refuses anything else. The live site is static files: there's no plugin code there to exploit. |
| 2 | **Brute-force logins, `wp-login.php`, `xmlrpc.php`.** | A public login form and RPC endpoint on every site. | There is no login page. Publishing = a GitHub pull request, so you get GitHub's 2FA, SSO, audit log and branch protection. `/admin/` is a read-only static dashboard. |
| 3 | **Update treadmill**: core, PHP, theme and plugin updates breaking each other. | Tight runtime coupling between many independently versioned pieces. | Two runtime dependencies (`marked`, `gray-matter`). The output is plain HTML, so a host upgrade can't break your site. CI builds every theme on every PR. |
| 4 | **Slow pages / poor Core Web Vitals.** | PHP + MySQL per request, render-blocking plugin CSS/JS, page-builder bloat. | Pre-rendered HTML, two small stylesheets and a single ~2 KB deferred script (instant search). No web fonts. Serve from any CDN. |
| 5 | **The database**: backups, migrations, `wp_options` bloat, search-replace on domain change. | Content, config and state are mixed in MySQL. | No database. Content is markdown in Git: diffable, reviewable, backed up by every clone. Changing domains = edit `site.url`. |
| 6 | **Page-builder lock-in.** Deactivate a page builder and pages fill up with leftover shortcodes or markup. | Layout stored as builder-specific markup in post content. | Blocks are readable plain-text markdown (`:::callout`). Unknown blocks are flagged by the linter, and any theme renders every core block. |
| 7 | **Gutenberg vs. Classic vs. builders**: three editing models, all different. | Historical layers. | One model: markdown + blocks. Edit it in the admin editor, GitHub's web editor, VS Code, or by asking Claude. The result is the same file every time. |
| 8 | **Expensive or fiddly hosting.** | Needs PHP, MySQL, caching, a security plugin and a backup plugin. | Any static host works, including free tiers: Cloudflare Pages, Netlify, GitHub Pages or S3. `_headers` and `_redirects` are generated for you. |
| 9 | **SEO needs plugins** (sitemaps, meta, schema). | Not in core. | Built in: canonical URLs, Open Graph/Twitter, JSON-LD (BlogPosting, BreadcrumbList, WebSite, FAQPage), `sitemap.xml`, `robots.txt`, RSS, `llms.txt`. The linter checks titles, descriptions, alt text and heading order, and the build fails on broken internal links. |
| 10 | **Comment spam.** | Open comment forms. | No comments by default. Use GitHub Discussions or add a plugin if you need them. |
| 11 | **PHP-heavy themes** with logic and HTML mixed together. | Templates are full PHP. | Themes are logic-less HTML templates that **escape by default** (`{{ }}`). A theme can't run code or XSS by accident. |
| 12 | **Hard to automate / unfriendly to AI agents.** | State lives behind a web UI and a database. | Everything is a file, so agents work like developers do. A bundled MCP server gives Claude typed tools, and `@claude` on GitHub turns an issue into a reviewed PR. `/llms.txt`, `/api/content.json` and `index.md` twins make every page machine-readable. |
| 13 | **Revisions are a black box.** | Stored as DB rows. | Full Git history, blame and diffs. Rollback is `git revert`. |
| 14 | **Multi-author workflow needs plugins.** | Editorial roles live in the DB. | Pull requests are the editorial workflow: review, comments, required approvals, CODEOWNERS. |

## What we kept from WordPress

- The **dashboard look and feel**: dark sidebar, "At a Glance", Quick Draft, Site Health, Posts/Pages tables with row actions.
- **Themes and plugins** as drop-in folders, with actions and filters as the extension model.
- **Page templates**: `template: landing` in front matter, like "Template Name:" headers.
- Categories, tags, archives, pagination, RSS, scheduled posts (future dates) and drafts.

## Trade-offs (honest list)

- No in-browser login means non-technical authors need a GitHub account. The admin editor's "Publish via GitHub" button makes this one click, but it's still GitHub.
- Dynamic features (comments, forms, e-commerce) need an external service or a serverless function.
- Very large sites (tens of thousands of pages) rebuild slower than a DB-backed CMS serves a single page, though still in seconds for typical blogs.
