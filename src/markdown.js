'use strict';
/* Configured markdown → HTML pipeline (safe renderer + block library). */

const { Marked } = require('marked');
const core = require('./shared/pressy-core');

function createMarkdown({ allowRawHtml = false, blocks = core.BLOCKS } = {}) {
  const md = new Marked({ gfm: true, breaks: false });
  md.use({ renderer: core.safeRenderer({ allowRawHtml }) });
  return core.createRenderer({ md, blocks });
}

module.exports = { createMarkdown };
