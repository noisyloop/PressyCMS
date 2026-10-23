---
title: "PressyCMS Blocks"
description: "Every PressyCMS block in one place — hero, columns, cards, callouts, stats, FAQ and more, all written in plain markdown."
menuOrder: 2
toc: true
---

Lorem ipsum dolor sit amet. Every element on this page is written in markdown using `:::block` syntax — open the [source on GitHub](/go/github) to compare. Nest blocks by giving the outer block more colons (`::::columns` around `:::col`).

:::toc
:::

## PressyCMS hero

:::hero title="PressyCMS hero" subtitle="Lorem ipsum dolor sit amet, consectetur adipiscing elit." cta="Lorem ipsum" href="/about/"
:::

## PressyCMS callouts

:::callout type="info" title="Info"
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
:::

:::callout type="tip" title="Tip"
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
:::

:::callout type="warning" title="Warning"
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
:::

:::callout type="success" title="Success"
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
:::

## PressyCMS columns

::::columns
:::col
### Lorem
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
:::
:::col
### Ipsum
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
:::
::::

## PressyCMS cards

::::cards columns="3"
:::card title="Lorem ipsum" icon="⚡" href="/lorem-ipsum-dolor-sit-amet/"
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
:::
:::card title="Dolor sit" icon="🔒"
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
:::
:::card title="Amet" icon="🎨"
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
:::
::::

## PressyCMS stats

::::stats
:::stat value="42" label="Lorem"
:::
:::stat value="7ms" label="Ipsum"
:::
:::stat value="100" label="Dolor"
:::
::::

## PressyCMS testimonial

:::testimonial author="Lorem Ipsum" role="Consectetur"
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
:::

## PressyCMS FAQ

::::faq
:::q question="Lorem ipsum dolor sit amet?"
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
:::
:::q question="Sed do eiusmod tempor?"
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
:::
::::

## PressyCMS image

:::image src="/media/sample.svg" alt="Abstract lorem ipsum illustration" caption="Lorem ipsum dolor sit amet."
:::

## PressyCMS buttons and dividers

:::button href="/about/" label="Primary button"
:::

:::button href="/" style="secondary" label="Secondary button"
:::

:::divider style="dots"
:::

## PressyCMS sections

::::section bg="light"
### Light section
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
::::

::::section bg="dark"
### Dark section
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
::::
