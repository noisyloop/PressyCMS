# PressyCMS — notes for Claude

PressyCMS is a database-free CMS. **One markdown file = one URL.** The build (`npm run build`) turns `content/` + a theme + plugins into static files in `dist/`.

## Where things live

| Path | What |
| --- | --- |
| `content/posts/*.md` | Blog posts → `/<slug>/` |
| `content/pages/*.md` | Pages → `/<slug>/` |
| `pressy.config.json` | Site settings, theme, enabled plugins, nav, agent policy |
| `themes/<name>/` | `layout.html`, `templates/*.html`, `partials/*.html`, `assets/theme.css` |
| `plugins/<name>/` | `plugin.json` (permissions) + `index.js` |
| `src/shared/pressy-core.js` | Block library + safe markdown renderer (shared with the admin editor) |
| `redirects.json` | 301/302 redirects (redirects plugin) |

## Writing content

Front matter (YAML only — JavaScript front matter is rejected):

```yaml
---
title: "Lorem ipsum dolor sit amet"        # required, ≤ 60 chars ideally
description: "70–160 character summary."    # used for meta description + cards
date: 2026-10-23                             # required for posts; future dates are scheduled
category: Lorem Ipsum
tags: [PressyCMS, Blocks]
template: post                               # any template in the active theme, e.g. landing
image: /media/sample.svg                     # optional; needs imageAlt
imageAlt: "Describe the image"
featured: true                               # homepage "Featured" row
toc: true                                    # auto table of contents
draft: true                                  # excluded from production builds
redirect_from: [/old-url/]                   # 301s
---
```

Rules the linter enforces (`npm run lint`, or `--json`):

- Use `##` for sections — the theme renders the title as the only H1. Don't skip heading levels.
- Every image needs alt text.
- Raw HTML is escaped for security. Use blocks instead.
- Only use blocks that exist (`npx pressy blocks`). Outer blocks need **more** colons than inner ones:

```markdown
::::columns
:::col
Lorem ipsum.
:::
::::
```

House style for this demo site: body copy is lorem ipsum; headings start with "PressyCMS".

## Before you finish

1. `npm run lint` — fix every error and warning you introduced.
2. `npm test`
3. `npm run build` — fails on broken internal links.
4. Open a pull request; never push straight to `main`.

## MCP

`.mcp.json` registers `node bin/pressy.js mcp`. Tools: `site_info`, `list_content`, `read_content`, `list_blocks`, `lint_content`, `build_site`, `create_content`, `update_content`. There is deliberately no delete tool — delete files with git so it shows up in review.

## Security rules for changes to the engine

- Templates escape with `{{ }}`; only use `{{{ }}}` for HTML the build generated.
- Every URL from content goes through `safeUrl()`.
- Plugins must declare permissions in `plugin.json`; request the minimum.
- Never add third-party scripts, fonts or trackers — the CSP in `src/seo.js` forbids them.
