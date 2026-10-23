# Security model

| Layer | Protection |
|---|---|
| **Runtime** | The deployed site is static files. No PHP, database, login form, sessions or write API exist on the server. |
| **Authoring** | Changes arrive as Git commits / PRs, protected by GitHub auth, 2FA, branch protection and review. |
| **Markdown** | Raw HTML is escaped (`markdown.allowRawHtml: false`). Link and image URLs pass through `safeUrl()`, which allows only relative URLs, `http(s):` and `mailto:` — `javascript:`, `data:`, `vbscript:` and protocol-relative URLs become `#`. External links get `rel="noopener noreferrer"`. |
| **Front matter** | YAML/JSON only; executable (`---js`) front matter is rejected. Slugs are validated against `^[a-z0-9-]+$` and reserved names. |
| **Templates** | `{{ }}` escapes by default; JSON-LD is serialised so it can't close its `<script>` tag. |
| **Plugins** | Build-time only. Declared permissions are enforced. File output is confined to `dist/`. |
| **Headers** | `_headers` sets a strict CSP (`script-src 'self'`, no inline scripts, no third-party origins), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP. `/admin/` is `noindex`. |
| **Privacy** | No cookies, analytics, web fonts or third-party requests by default. |
| **Agents** | MCP tools are confined to `content/*.md`, have no delete, and are gated by `agents.allowed` / `agents.allowWrite`. |
| **Supply chain** | Two runtime dependencies; CI runs `npm audit --audit-level=high`. |
| **Build integrity** | Build fails on broken internal links, invalid config, duplicate slugs, unknown templates. |

## The admin dashboard

`/admin/` is a static page that reads `/admin/data.json`, which contains only public, already-published information. It cannot change the site. Publish buttons open GitHub, where normal authentication applies. To hide it completely, set `"admin": { "enabled": false }`.

## Reporting a vulnerability

Please open a private security advisory on the GitHub repository instead of a public issue.
