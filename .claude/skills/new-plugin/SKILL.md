---
name: new-plugin
description: Scaffold a new PressyCMS plugin with least-privilege permissions and a test. Use when asked to add a feature that should be a plugin.
---

# New plugin

Read `docs/PLUGINS.md` first.

1. Create `plugins/<name>/plugin.json` with `name`, `title`, `version`, `description` and the **smallest** `permissions` list (`filters`, `blocks`, `files`, `pages`, `assets`, `redirects`, `headers`).
2. Create `plugins/<name>/index.js` exporting `(pressy) => { … }`. Use `pressy.addFilter`, `pressy.addAction`, `pressy.registerBlock`, `pressy.emitFile`, `pressy.addPage`.
3. Plugins run at build time only. No network calls, no secrets, no third-party scripts in output.
4. Escape any user content you put into HTML.
5. Add a test in `test/` and enable the plugin in `pressy.config.json`.
6. `npm test && npm run build`, then open a PR.
