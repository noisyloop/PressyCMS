'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { PassThrough } = require('stream');
const { startMcpServer, clientAllowed } = require('../src/mcp');

const root = path.join(__dirname, '..');

function session(clientName) {
  const input = new PassThrough();
  const output = new PassThrough();
  const rl = startMcpServer({ root, input, output });
  const pending = new Map();
  let buf = '';
  output.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) !== -1) {
      const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      pending.get(msg.id)?.(msg);
    }
  });
  let id = 0;
  const call = (method, params) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); input.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  return { call, close: () => rl.close(), init: () => call('initialize', { protocolVersion: '2025-06-18', clientInfo: { name: clientName } }) };
}

test('only allowed agents may connect', async () => {
  const s = session('random-bot');
  const r = await s.init();
  assert.ok(r.error);
  s.close();
  assert.ok(clientAllowed({ agents: { allowed: ['claude'] } }, { name: 'claude-code' }));
});

test('claude can list and read content but not escape content/', async () => {
  const s = session('claude-code');
  assert.ok((await s.init()).result);
  const tools = (await s.call('tools/list')).result.tools.map((t) => t.name);
  assert.ok(tools.includes('create_content'));
  const list = JSON.parse((await s.call('tools/call', { name: 'list_content', arguments: {} })).result.content[0].text);
  assert.ok(list.length > 0);
  const bad = (await s.call('tools/call', { name: 'read_content', arguments: { slug: '../../package' } })).result;
  assert.strictEqual(bad.isError, true);
  s.close();
});
