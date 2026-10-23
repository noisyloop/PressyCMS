---
name: seo-audit
description: Audit and fix SEO and accessibility problems across PressyCMS content (titles, descriptions, alt text, headings, broken links). Use when asked to improve SEO, rankings, site health or accessibility.
---

# SEO audit

1. Run `npx pressy lint --json` (or the `lint_content` tool with no slug).
2. Fix in priority order: errors → `description-*` → `title-length` → `heading-skip` → `thin-content`.
3. Never change a slug to fix SEO. If a URL truly must change, add the old path to `redirect_from`.
4. Run `npm run build` — it fails on broken internal links; fix any it reports.
5. Check `dist/sitemap.xml` includes the changed pages and `dist/llms.txt` reads well.
6. Open one PR titled "SEO pass" listing every file changed and why.
