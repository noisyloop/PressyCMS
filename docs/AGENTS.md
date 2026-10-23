# Agents (Claude)

PressyCMS is built so an AI agent can run the whole publishing loop safely: write → lint → build → pull request → human review. Today the supported agent is **Claude**. `agents.allowed` in `pressy.config.json` is `["claude"]`, and other MCP clients are turned away at `initialize`.

> `agents.allowed` is a policy switch, not authentication. The real security boundary is who can push to your repository and who can merge PRs.

## 1. Claude Code + MCP (local)

```bash
git clone https://github.com/noisyloop/PressyCMS && cd PressyCMS
npm install
claude
```

`.mcp.json` registers the server automatically (`node bin/pressy.js mcp`). Tools:

| Tool | Does |
|---|---|
| `site_info` | Config, theme, templates, plugins, blocks, house rules |
| `list_content` / `read_content` | Browse content (path-traversal safe) |
| `list_blocks` | Block names, attributes and examples, so the agent never invents blocks |
| `create_content` / `update_content` | Write markdown in `content/` only; returns lint results immediately |
| `lint_content` | SEO / a11y / block checks |
| `build_site` | Full build; reports broken links |

There is **no delete tool**. Removing content is a git operation that shows up in review.

Skills in `.claude/skills/` teach Claude the house workflows: `write-post`, `seo-audit`, `new-plugin`, `new-theme`. `CLAUDE.md` holds the conventions.

## 2. @claude on GitHub

1. Install the [Claude GitHub App](https://github.com/apps/claude) on the repo.
2. Add an `ANTHROPIC_API_KEY` repository secret.
3. Open an **Article request** issue (or comment `@claude …` anywhere). Claude writes the post, runs `npm run lint` and `npm run build`, and opens a PR.

The workflow (`.github/workflows/claude.yml`) restricts Claude to lint/build/test commands, and CI re-checks everything on the PR.

## 3. From the admin dashboard

- **Editor → 🤖 Ask Claude** copies a ready-made prompt that includes your draft.
- **Site Health → Ask @claude on GitHub** files an issue asking Claude to fix every lint finding.
- **Claude → Prompt library** has copy-paste prompts for posts, landing pages, SEO passes, plugins and themes.

## 4. Read-only agent access (any LLM)

| URL | Contents |
|---|---|
| `/llms.txt` | Site map for LLMs ([llmstxt.org](https://llmstxt.org)) |
| `/llms-full.txt` | All content in one file |
| `/api/content.json` | Structured index of every post and page |
| `/<slug>/index.md` | Raw markdown twin of every page |
