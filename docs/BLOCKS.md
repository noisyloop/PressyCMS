# Blocks

Blocks are PressyCMS's take on Elementor widgets, written in plain markdown so they survive any theme, any editor and any diff.

```markdown
:::name attr="value" other=value
Markdown content (optional)
:::
```

**Nesting:** an outer block must use more colons than the blocks inside it.

```markdown
::::cards columns="3"
:::card title="Lorem" icon="⚡"
Ipsum dolor sit amet.
:::
::::
```

| Block | Attributes (* required) | Notes |
|---|---|---|
| `hero` | `title`*, `subtitle`, `cta`, `href`, `align: center\|left` | Full-width banner |
| `section` | `bg: none\|light\|dark\|accent`, `width: narrow\|wide` | Coloured band |
| `columns` → `col` | `gap: sm\|md\|lg` | Responsive columns |
| `cards` → `card` | `columns: 2\|3\|4` / `title`, `icon`, `href` | Card grid |
| `stats` → `stat` | `value`*, `label`* | Big numbers |
| `callout` | `type: info\|tip\|warning\|success`, `title` | Note box |
| `button` | `href`*, `label`, `style: primary\|secondary` | CTA link |
| `testimonial` | `author`*, `role` | Quote |
| `faq` → `q` | `question`* | Accordion, emits FAQPage JSON-LD |
| `image` | `src`*, `alt`*, `caption`, `size: normal\|wide\|full` | Lazy-loaded figure |
| `divider` | `style: line\|dots` | |
| `spacer` | `size: sm\|md\|lg\|xl` | |
| `toc` | — | From the **toc** plugin |

See every block rendered at `/blocks/` on the demo site, or run `npx pressy blocks`.

## Why not raw HTML?

Raw HTML in markdown is escaped by default (`markdown.allowRawHtml: false`). Contributors can submit articles through GitHub, so letting markdown carry `<script>` or `onerror=` would turn every contributor into a potential XSS vector. Blocks give you layout without that risk: their attributes are escaped and their URLs are filtered through `safeUrl()`.

## Adding a block

Core blocks live in `src/shared/pressy-core.js` (the same file powers the admin editor's live preview). Sites should add blocks from a plugin instead:

```js
pressy.registerBlock('pricing', {
  label: 'Pricing', icon: '💲', description: 'A price card.',
  attrs: { price: { required: true } },
  example: ':::pricing price="$9"\nLorem ipsum.\n:::',
  render: (attrs, innerHtml) => `<div class="pricing"><strong>${escape(attrs.price)}</strong>${innerHtml}</div>`
});
```
