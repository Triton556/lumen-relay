// Command-stream rendering checks; these do not establish pixel quality.
import assert from 'node:assert/strict';
import { Renderer } from '../src/render.js';
import { LEVELS, createGame } from '../src/core.js';
globalThis.innerWidth = 1280;
globalThis.innerHeight = 800;
globalThis.devicePixelRatio = 1;
globalThis.matchMedia = () => ({ matches: false });
function recorder() {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name === 'createLinearGradient' || name === 'createRadialGradient')
          return (...args) => {
            calls.push([name, ...args]);
            return {
              addColorStop(...v) {
                calls.push(['addColorStop', ...v]);
              },
            };
          };
        return (...args) => calls.push([name, ...args]);
      },
      set(_, name, value) {
        calls.push([name, typeof value === 'object' ? 'gradient' : value]);
        return true;
      },
    },
  );
  const canvas = { style: {}, getContext: () => ctx };
  return { calls, renderer: new Renderer(canvas) };
}
let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('PASS', name);
    passed++;
  } catch (e) {
    console.error('FAIL', name, e.message);
    process.exitCode = 1;
  }
}
test('All levels render finite command geometry on desktop and compact mobile', () => {
  for (const [w, h] of [
    [1280, 800],
    [390, 844],
    [844, 390],
  ]) {
    globalThis.innerWidth = w;
    globalThis.innerHeight = h;
    for (let i = 0; i < LEVELS.length; i++) {
      const { renderer, calls } = recorder();
      renderer.frame(createGame(i), 3, 0.016, 'playing');
      for (const c of calls)
        for (const v of c)
          if (typeof v === 'number')
            assert.ok(Number.isFinite(v), `Nonfinite render command: ${c}`);
    }
  }
});
test('Reduced motion freezes decorative command stream at unchanged game state', () => {
  const { renderer, calls } = recorder();
  renderer.reduced = true;
  const g = createGame(0);
  renderer.frame(g, 1, 0, 'playing');
  calls.length = 0;
  renderer.frame(g, 2, 0, 'playing');
  const first = JSON.stringify(calls);
  calls.length = 0;
  renderer.frame(g, 3, 0, 'playing');
  assert.equal(
    JSON.stringify(calls) === first,
    true,
    'Decorative geometry/alpha still changes with real time in reduced-motion mode',
  );
});
test('Static renderer layers reuse and invalidate independently of glow sprites', () => {
  const { renderer } = recorder();
  globalThis.document = { createElement: () => recorder().renderer.canvas };
  try {
    const layers = () => [renderer.backgroundLayer, renderer.terrainLayer];
    renderer.frame(createGame(0), 1, 0, 'playing');
    let old = layers();
    renderer.frame(createGame(0), 2, 0, 'playing');
    assert.deepEqual(layers(), old);
    renderer.quality = 'low';
    renderer.frame(createGame(0), 3, 0, 'playing');
    assert.notEqual(renderer.backgroundLayer, old[0]);
    assert.notEqual(renderer.terrainLayer, old[1]);
    old = layers();
    renderer.frame(createGame(1), 4, 0, 'playing');
    assert.notEqual(renderer.backgroundLayer, old[0]);
    assert.notEqual(renderer.terrainLayer, old[1]);
    old = layers();
    globalThis.innerWidth += 10;
    renderer.frame(createGame(1), 5, 0, 'playing');
    assert.notEqual(renderer.backgroundLayer, old[0]);
    assert.equal(renderer.terrainLayer, old[1]);
    old = layers();
    renderer.frame(createGame(1), 6, 0, 'title');
    assert.equal(renderer.backgroundLayer, old[0]);
    assert.notEqual(renderer.terrainLayer, old[1]);
  } finally {
    delete globalThis.document;
  }
});
test('Glow sprites reuse translations, bound memory, and invalidate scale/DPR/quality', () => {
  const { renderer } = recorder();
  globalThis.document = { createElement: () => recorder().renderer.canvas };
  try {
    const shape = { kind: 'ellipse', x: 10, y: 20, rx: 3, ry: 4, fill: '#ffeeaa', width: 0 };
    const a = renderer.cachedNeon(shape, '#ffdd88', 8);
    const b = renderer.cachedNeon({ ...shape, x: 510, y: -20 }, '#ffdd88', 8);
    assert.equal(a.entry, b.entry);
    assert.equal(b.x - a.x, 500);
    assert.equal(b.y - a.y, -40);
    for (let i = 0; i < 1000; i++) {
      renderer.cachedNeon({ ...shape, rx: 3 + i / 10 }, '#ffdd88', 8);
      assert.ok(renderer.neonCache.size <= renderer.neonCacheLimit);
      assert.ok(renderer.neonPixels <= renderer.neonPixelLimit);
    }
    assert.equal(
      renderer.neonPixels,
      [...renderer.neonCache.values()].reduce((n, e) => n + e.pixels, 0),
    );
    assert.equal(renderer.cachedNeon({ ...shape, rx: 10000 }, '#ffdd88', 8), null);
    renderer.frame(createGame(5), 1, 0, 'playing');
    const sentinel = () => renderer.neonCache.set('sentinel', { pixels: 0 });
    sentinel();
    globalThis.devicePixelRatio = 2;
    renderer.frame(createGame(5), 2, 0, 'playing');
    assert.equal(renderer.neonCache.has('sentinel'), false);
    sentinel();
    renderer.quality = 'low';
    renderer.frame(createGame(5), 3, 0, 'playing');
    assert.equal(renderer.neonCache.has('sentinel'), false);
    sentinel();
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;
    renderer.frame(createGame(5), 4, 0, 'playing');
    assert.equal(renderer.neonCache.has('sentinel'), false);
  } finally {
    delete globalThis.document;
    globalThis.devicePixelRatio = 1;
  }
});
test('Mobile camera toggle preserves simulation and reset recenters immediately', () => {
  globalThis.innerWidth = 390;
  globalThis.innerHeight = 844;
  const { renderer } = recorder();
  const g = createGame(5);
  renderer.frame(g, 1, 0.016, 'playing');
  const initial = JSON.stringify(g),
    zoom = renderer.s;
  renderer.overview = true;
  renderer.frame(g, 1, 0.016, 'playing');
  assert.ok(renderer.s < zoom);
  assert.equal(JSON.stringify(g), initial);
  renderer.overview = false;
  renderer.cameraReset = true;
  renderer.frame(g, 1, 0.016, 'playing');
  assert.equal(JSON.stringify(g), initial);
  const x = renderer.cx,
    y = renderer.cy;
  renderer.cameraX += 100;
  renderer.cameraY += 100;
  renderer.cameraReset = true;
  renderer.frame(g, 1, 0.016, 'playing');
  assert.equal(renderer.cx, x);
  assert.equal(renderer.cy, y);
  renderer.cameraX += 100;
  renderer.cameraY += 100;
  renderer.reduced = true;
  renderer.frame(g, 2, 0.016, 'playing');
  assert.equal(renderer.cx, x);
  assert.equal(renderer.cy, y);
});
test('Composed details share bounded glow budget and reuse across translation', () => {
  globalThis.document = { createElement: () => recorder().renderer.canvas };
  const { renderer: r } = recorder();
  r.s = 30;
  r.cx = 100;
  r.cy = 100;
  r.dpr = 1;
  let paints = 0;
  const paint = () => {
    paints++;
    r.neon(() => r.ellipse(10, 20, 3, 4, '#ffeeaa'), '#ffeeaa', 8);
  };
  try {
    r.cachedDetail('test', 1, 2, [-20, -20, 40, 40], paint);
    r.cachedDetail('test', 4, 6, [-20, -20, 40, 40], paint);
    assert.equal(paints, 1);
    for (let i = 0; i < 600; i++) {
      r.cachedDetail('vary' + i, 1, 2, [-20, -20, 40, 40], paint);
      assert.ok(r.neonCache.size <= r.neonCacheLimit);
      assert.ok(r.neonPixels <= r.neonPixelLimit);
    }
    assert.equal(
      r.neonPixels,
      [...r.neonCache.values()].reduce((n, e) => n + e.pixels, 0),
    );
    const count = r.neonCache.size,
      old = paints;
    r.cachedDetail('oversized', 1, 2, [-2000, -2000, 4000, 4000], () => paints++);
    assert.equal(paints, old + 1);
    assert.equal(r.neonCache.size, count);
  } finally {
    delete globalThis.document;
  }
});
test('Rendered bridge decks track activation and completed exploration states', () => {
  const { renderer: r } = recorder(),
    g = createGame(5);
  let painted = [];
  const tile = r.tile.bind(r);
  r.tile = (x, y, kind, ...rest) => {
    painted.push(kind);
    tile(x, y, kind, ...rest);
  };
  r.frame(g, 1, 0, 'playing');
  assert.equal(painted.includes('bridge'), false);
  assert.equal(painted.includes('living'), false);
  painted = [];
  g.relays.add('r1');
  r.frame(g, 2, 0, 'playing');
  assert.ok(painted.includes('bridge'));
  painted = [];
  g.relays.delete('r1');
  r.frame(g, 3, 0, 'playing');
  assert.equal(painted.includes('bridge'), false);
  painted = [];
  g.complete = true;
  g.exploring = true;
  r.frame(g, 4, 0, 'playing');
  assert.ok(painted.includes('living'));
  assert.equal(painted.includes('ghost'), false);
});
console.log(`${passed} tests passed`);
