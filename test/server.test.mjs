import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

test('development preview binds only IPv4 loopback and advertises the same address', () => {
  const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8').replace(
    /^import .*;\n/gm,
    '',
  );
  let binding;
  let advertised;
  vm.runInNewContext(source, {
    path,
    fs: {},
    http: {
      createServer(handler) {
        assert.equal(typeof handler, 'function');
        return {
          listen(port, host, ready) {
            binding = { port, host };
            ready();
          },
        };
      },
    },
    console: {
      log: (text) => {
        advertised = text;
      },
    },
  });
  assert.deepEqual(binding, { port: 4173, host: '127.0.0.1' });
  assert.match(advertised, /http:\/\/127\.0\.0\.1:4173$/);
});
