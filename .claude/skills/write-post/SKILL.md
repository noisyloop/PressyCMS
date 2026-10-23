---
name: write-post
description: Write or update a PressyCMS post or page in content/ using markdown and blocks, then lint and build. Use when asked to write, draft, publish or edit an article, post or page.
---

# Write a PressyCMS post

1. Call the `site_info` and `list_blocks` MCP tools (or run `npx pressy blocks`) so you only use real blocks and templates.
2. Pick a slug: lowercase, dashes, ≤ 60 chars. Check `list_content` so it's unique.
3. Write the file with `create_content` (or create `content/posts/<slug>.md`). Include `title`, a 70–160 char `description`, `date`, `category`, `tags`.
4. Structure: short intro paragraph → `##` sections → at least one block where it helps (callout, columns, faq). FAQ blocks earn rich results.
5. Run `lint_content` with the slug and fix every issue. Then `build_site`.
6. Commit on a branch and open a PR. Summarise the post and paste the lint result in the PR body.
