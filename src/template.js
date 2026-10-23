'use strict';
/* Tiny logic-less template engine for themes.

   {{ path.to.value }}          HTML-escaped output (the default — themes can't XSS by accident)
   {{{ path }}}                  raw output, for HTML the build generated itself
   {{> partial }}                include themes/<name>/partials/partial.html
   {{#if path}} … {{else}} … {{/if}}
   {{#unless path}} … {{/unless}}
   {{#each path}} … {{this.x}} {{@index}} {{@first}} {{@last}} … {{else}} … {{/each}}

   Paths resolve against the current scope, then parent scopes. `this` is the
   current item; `@root` is the top-level data. */

const { escapeHtml } = require('./shared/pressy-core');

const TAG_RE = /\{\{\{\s*([^}]+?)\s*\}\}\}|\{\{\s*([#/>]?)\s*([^}]*?)\s*\}\}/g;

function tokenize(src) {
  const tokens = [];
  let last = 0;
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(src))) {
    if (m.index > last) tokens.push({ type: 'text', value: src.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ type: 'raw', path: m[1] });
    else if (m[2] === '#') {
      const [kw, ...rest] = m[3].split(/\s+/);
      tokens.push({ type: 'open', kw, path: rest.join(' ') });
    } else if (m[2] === '/') tokens.push({ type: 'close', kw: m[3] });
    else if (m[2] === '>') tokens.push({ type: 'partial', name: m[3] });
    else if (m[3] === 'else') tokens.push({ type: 'else' });
    else if (m[3].startsWith('!')) { /* comment */ } else tokens.push({ type: 'var', path: m[3] });
    last = TAG_RE.lastIndex;
  }
  if (last < src.length) tokens.push({ type: 'text', value: src.slice(last) });
  return tokens;
}

function parse(tokens, name) {
  const root = { children: [] };
  const stack = [root];
  for (const t of tokens) {
    const top = stack[stack.length - 1];
    if (t.type === 'open') {
      if (!['if', 'unless', 'each'].includes(t.kw)) throw new Error(`${name}: unknown block helper #${t.kw}`);
      const node = { type: t.kw, path: t.path, children: [], alt: null };
      (top.inAlt ? top.alt : top.children).push(node);
      stack.push(node);
    } else if (t.type === 'else') {
      if (stack.length < 2) throw new Error(`${name}: {{else}} outside a block`);
      top.alt = [];
      top.inAlt = true;
    } else if (t.type === 'close') {
      if (stack.length < 2 || top.type !== t.kw) throw new Error(`${name}: unexpected {{/${t.kw}}}`);
      stack.pop();
    } else {
      (top.inAlt ? top.alt : top.children).push(t);
    }
  }
  if (stack.length !== 1) throw new Error(`${name}: unclosed {{#${stack[stack.length - 1].type}}}`);
  return root.children;
}

function lookup(scopes, path) {
  path = path.trim();
  if (path === 'this' || path === '.') return scopes[scopes.length - 1].value;
  if (path.startsWith('@root.')) return dig(scopes[0].value, path.slice(6));
  if (path.startsWith('@')) {
    for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].meta && path in scopes[i].meta) return scopes[i].meta[path];
    return undefined;
  }
  if (path.startsWith('this.')) return dig(scopes[scopes.length - 1].value, path.slice(5));
  const head = path.split('.')[0];
  for (let i = scopes.length - 1; i >= 0; i--) {
    const v = scopes[i].value;
    if (v != null && typeof v === 'object' && head in v) return dig(v, path);
  }
  return undefined;
}

function dig(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

const truthy = (v) => Array.isArray(v) ? v.length > 0 : !!v;

function createEngine({ partials = {}, onMissingPartial } = {}) {
  const cache = new Map();
  const compile = (src, name) => {
    if (!cache.has(name + '\0' + src)) cache.set(name + '\0' + src, parse(tokenize(src), name));
    return cache.get(name + '\0' + src);
  };

  function run(nodes, scopes, name, depth) {
    if (depth > 20) throw new Error(`${name}: partials nested too deeply`);
    let out = '';
    for (const n of nodes) {
      switch (n.type) {
        case 'text': out += n.value; break;
        case 'var': { const v = lookup(scopes, n.path); out += v == null ? '' : escapeHtml(v); break; }
        case 'raw': { const v = lookup(scopes, n.path); out += v == null ? '' : String(v); break; }
        case 'partial': {
          const src = partials[n.name];
          if (src == null) { if (onMissingPartial) onMissingPartial(n.name); break; }
          out += run(compile(src, n.name), scopes, n.name, depth + 1);
          break;
        }
        case 'if': case 'unless': {
          let cond = truthy(lookup(scopes, n.path));
          if (n.type === 'unless') cond = !cond;
          out += run(cond ? n.children : (n.alt || []), scopes, name, depth);
          break;
        }
        case 'each': {
          const list = lookup(scopes, n.path);
          if (!truthy(list)) { out += run(n.alt || [], scopes, name, depth); break; }
          const arr = Array.isArray(list) ? list : Object.values(list);
          arr.forEach((item, i) => {
            out += run(n.children, [...scopes, { value: item, meta: { '@index': i, '@number': i + 1, '@first': i === 0, '@last': i === arr.length - 1 } }], name, depth);
          });
          break;
        }
      }
    }
    return out;
  }

  return {
    render(src, data, name = 'template') {
      return run(compile(src, name), [{ value: data }], name, 0);
    }
  };
}

module.exports = { createEngine };
