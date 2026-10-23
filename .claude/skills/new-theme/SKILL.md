---
name: new-theme
description: Create or modify a PressyCMS theme (layout, templates, partials, CSS). Use when asked to change the site's look, add a template, or build a new theme.
---

# New theme

Read `docs/THEMES.md` first.

1. Copy `themes/paper` to `themes/<name>` and edit `theme.json`.
2. Required: `layout.html`, `templates/{home,post,page,archive}.html`. Recommended: `landing.html`, `404.html`.
3. Use `{{ }}` (escaped) everywhere except `{{{body}}}`, `{{{doc.html}}}` and `{{{meta.jsonld}}}`.
4. Restyle blocks via the `--pb-*` CSS custom properties rather than rewriting block CSS.
5. No external fonts or scripts (the CSP blocks them). System font stacks only.
6. Preview with `npx pressy serve --theme <name>`; `npm test` builds every theme.
7. Regenerate screenshots with `npm run screenshots` if Playwright is available.
