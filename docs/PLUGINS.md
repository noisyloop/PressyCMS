# Plugins

A plugin is a folder in `plugins/` with a manifest and an entry point. Enable it in `pressy.config.json → plugins`; pass options via `pluginOptions.<name>`.

```
plugins/hello/
├── plugin.json
├── index.js
└── assets/        (optional, served at /plugins/hello/ when "assets" is granted)
```

```json
{
  "name": "hello",
  "title": "Hello",
  "version": "1.0.0",
  "description": "Says hello.",
  "permissions": ["filters"]
}
```

```js
module.exports = (pressy) => {
  pressy.addFilter('post', (doc) => ({ ...doc, greeting: `Hello from ${pressy.site.title}` }));
};
```

## Permissions

Plugins get **only** the APIs their manifest asks for. Calling anything else throws at build time with a clear message.

| Permission | Grants |
|---|---|
| `filters` | `addFilter(hook, fn, priority)` |
| `blocks` | `registerBlock(name, def)` |
| `files` | `emitFile(path, contents)`, confined to `dist/` |
| `pages` | `addPage({ path, title, html, description, noindex, template })`, rendered with the active theme |
| `assets` | `addScript(file)`, `addStyle(file)` from the plugin's `assets/` |
| `redirects` | `addRedirect(from, to, status)` |
| `headers` | `addHeader(name, value)` on every response |

`addAction(hook, fn)` is always allowed. `pressy.site`, `pressy.options` and `pressy.root` are read-only.

## Hooks

| Hook | Type | Receives |
|---|---|---|
| `post` | filter | each document after loading (before render) |
| `docs` | filter | the array of all documents |
| `templateData` | filter | `(data, { template, path })` passed to the theme |
| `html` | filter | `(html, { template, path, doc })` final page HTML |
| `build:start` | action | build context `{ site, posts, pages, docs, categories, tags }` |
| `build:end` | action | same, after pages are rendered |

## Why build-time only?

In WordPress, plugins execute on every request with full access to the database. Most WordPress security advisories are about plugins. PressyCMS plugins finish running before your site is deployed, and what ships is static HTML. A plugin bug can at worst produce a wrong page, which CI and code review will catch.

## Bundled plugins

| Plugin | Permissions | What it does |
|---|---|---|
| `reading-time` | filters | "4 min read" |
| `toc` | filters, blocks | `:::toc` block + `toc: true` front matter |
| `related-posts` | filters | Related posts by shared tags/category |
| `search` | files, pages, assets | `/search/` page + JSON index, no server |
| `redirects` | redirects, files | `redirects.json` → `_redirects` + HTML fallbacks |
