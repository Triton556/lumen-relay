import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/render.js';
function fixture() {
  const main = [],
    baked = [];
  const ctx = (log) =>
    new Proxy(
      { globalAlpha: 0.4, globalCompositeOperation: 'screen' },
      {
        get: (target, key) => (key in target ? target[key] : (...args) => log.push([key, ...args])),
        set: (target, key, value) => {
          target[key] = value;
          log.push([key, value]);
          return true;
        },
      },
    );
  const screen = ctx(main);
  globalThis.document = { createElement: () => ({ getContext: () => ctx(baked) }) };
  const r = new Renderer({ getContext: () => screen });
  r.dpr = 1;
  return { r, main, baked, screen };
}
test('cached neon keeps both alpha/composite passes without live screen shadows', () => {
  const { r, main, baked, screen } = fixture();
  r.neon(() => r.ellipse(100, 100, 3, 2, '#fff0bc'), '#ffd996', 8);
  assert.deepEqual(
    main.filter((c) => c[0] === 'globalAlpha').map((c) => Math.round(c[1] * 1e10) / 1e10),
    [0.3, 0.4],
  );
  assert.equal(screen.globalCompositeOperation, 'screen');
  assert.equal(main.filter((c) => c[0] === 'drawImage').length, 2);
  assert.ok(!main.some((c) => c[0] === 'shadowBlur' && c[1] > 0));
  assert.deepEqual(
    baked.filter((c) => c[0] === 'shadowBlur').map((c) => c[1]),
    [14, 4.4],
  );
  delete globalThis.document;
});
test('translation reuses glow geometry and oversized fallback has no live blur', () => {
  const { r, main } = fixture();
  for (let n = 0; n < 100; n++)
    r.neon(() => r.line({ x: n, y: n }, { x: n + 20, y: n + 10 }, '#aaffdd', 2), '#67ffe9', 8);
  assert.equal(r.neonCache.size, 1);
  assert.equal(r.neonStats.misses, 1);
  assert.equal(r.neonStats.hits, 99);
  r.neon(() => r.ellipse(0, 0, 5000, 5000, '#fff'), '#ffd996', 20);
  assert.equal(r.neonCache.size, 1);
  assert.ok(r.neonStats.fallbacks > 0);
  assert.ok(!main.some((c) => c[0] === 'shadowBlur' && c[1] > 0));
  delete globalThis.document;
});

test('composed details reuse world translations and preserve nonstandard blending via live fallback', () => {
  const { r, main, screen } = fixture();
  Object.assign(r, { s: 30, cx: 500, cy: 200 });
  screen.globalAlpha = 1;
  screen.globalCompositeOperation = 'source-over';
  let paints = 0;
  const paint = () => {
    paints++;
    r.ellipse(0, 0, 2, 2, '#ffe');
  };
  r.cachedDetail('flower-test', 2, 3, [-10, -10, 20, 20], paint);
  r.cachedDetail('flower-test', 8, 9, [-10, -10, 20, 20], paint);
  assert.equal(paints, 1);
  assert.equal(r.neonCache.size, 1);
  assert.equal(r.neonPixels, 400);
  assert.equal(main.filter((c) => c[0] === 'drawImage').length, 2);
  assert.equal(r.cx, 500);
  assert.equal(r.cy, 200);
  screen.globalCompositeOperation = 'screen';
  r.cachedDetail('flower-test', 8, 9, [-10, -10, 20, 20], paint);
  screen.globalCompositeOperation = 'source-over';
  screen.globalAlpha = 0.5;
  r.cachedDetail('flower-test', 8, 9, [-10, -10, 20, 20], paint);
  assert.equal(paints, 3);
  assert.equal(r.neonPixels, 400);
  delete globalThis.document;
});
