# Themes

```
themes/<name>/
├── theme.json            title, version, description
├── layout.html           <html> shell, wraps every page ({{{body}}})
├── templates/
│   ├── home.html         required
│   ├── post.html         required
│   ├── page.html         required
│   ├── archive.html      required (categories & tags)
│   ├── landing.html      full-width canvas for block-built pages
│   └── 404.html
├── partials/*.html       {{> name}}
├── assets/theme.css      served at /theme/theme.css (fingerprinted)
└── screenshot.png        shown in the admin's Appearance screen
```

Switch themes with `"theme"` in `pressy.config.json`, or preview without changing anything:

```bash
npx pressy serve --theme paper
```

Any document can choose a template: `template: landing` in front matter. Add a new file in `templates/` and it's available immediately (the editor's Template menu reads the list).

## Template syntax

| Syntax | Meaning |
|---|---|
| `{{ doc.title }}` | Escaped output (default, safe) |
| `{{{ doc.html }}}` | Raw output — only for HTML the build generated (`body`, `doc.html`, `meta.jsonld`) |
| `{{> card }}` | Include `partials/card.html` |
| `{{#if x}}…{{else}}…{{/if}}`, `{{#unless x}}` | Conditionals (empty arrays are false) |
| `{{#each posts}}…{{this.title}} {{@index}} {{@last}}…{{/each}}` | Loops |

## Data available

- Everywhere: `site`, `nav[] {label, href, active}`, `meta {title, description, canonical, image, noindex, jsonld}`, `assets {styles, scripts}`, `sidebar {recent, categories, tags}`, `pages[]`, `year`, `searchEnabled`
- `post` / `page` / `landing`: `doc` (`title`, `html`, `date`, `dateDisplay`, `author`, `category`, `categoryUrl`, `tags[] {name, url}`, `image`, `imageAlt`, `readingTime`, `related[]`, `newer`, `older`, `editUrl`)
- `home`: `posts[]`, `featured[]`, `pagination {prev, next, current, total}`, `isFirstPage`
- `archive`: `archive {kind, name, count}`, `posts[]`

## Styling blocks

Don't rewrite block CSS. Set the custom properties in your `theme.css` and every block follows:

```css
:root {
  --pb-accent: #9a3412;
  --pb-surface: #f3efe6;
  --pb-radius: 4px;
  --pb-font-heading: Georgia, serif;
}
```
