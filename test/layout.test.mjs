// Geometry-only layout checks. Browser visual and touch checks remain separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/render.js';
import { LEVELS, createGame } from '../src/core.js';
const ctx = new Proxy(
  {},
  {
    get: (_, name) => (name.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}),
    set: () => true,
  },
);
globalThis.devicePixelRatio = 2;
globalThis.document = { documentElement: {} };
test('playing gardens remain in viewport across notched mobile and desktop layouts', () => {
  for (const [w, h, coarse, top, bottom] of [
    [1440, 900, false, 0, 0],
    [390, 844, true, 47, 34],
    [844, 390, true, 0, 21],
    [320, 568, true, 0, 0],
  ]) {
    globalThis.innerWidth = w;
    globalThis.innerHeight = h;
    globalThis.matchMedia = () => ({ matches: coarse });
    globalThis.getComputedStyle = () => ({
      getPropertyValue: (n) => (n === '--safe-top' ? `${top}px` : `${bottom}px`),
    });
    for (let i = 0; i < LEVELS.length; i++) {
      const r = new Renderer({ style: {}, getContext: () => ctx }),
        g = createGame(i);
      r.overview = true;
      r.frame(g, 1, 0, 'playing');
      for (const [x, y] of g.level.floor)
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          const p = r.project(x + dx, y + dy);
          assert.ok(p.x >= 0 && p.x <= w, `Level ${i + 1}, ${w}×${h}: horizontal clipping`);
          assert.ok(
            p.y >= top && p.y <= h - bottom,
            `Level ${i + 1}, ${w}×${h}: unsafe vertical placement`,
          );
        }
      assert.equal(r.safeTop, top);
      assert.equal(r.safeBottom, bottom);
    }
  }
});

test('mobile follow enlarges the scene, keeps the keeper visible, and does not mutate simulation', () => {
  globalThis.innerWidth = 390;
  globalThis.innerHeight = 844;
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '0px' });
  for (let i = 0; i < LEVELS.length; i++) {
    const g = createGame(i),
      r = new Renderer({ style: {}, getContext: () => ctx });
    r.overview = true;
    r.frame(g, 1, 0, 'playing');
    const fit = r.s;
    const before = JSON.stringify({
      p: g.player,
      time: g.time,
      relays: [...g.relays],
      chimes: [...g.chimes],
    });
    r.overview = false;
    r.cameraReset = true;
    r.frame(g, 1, 0.016, 'playing');
    assert.ok(r.s > fit);
    const p = r.project(g.player.x, g.player.y);
    assert.ok(p.x >= 16 && p.x <= 374);
    assert.ok(p.y >= 128 && p.y <= 664);
    assert.equal(
      JSON.stringify({ p: g.player, time: g.time, relays: [...g.relays], chimes: [...g.chimes] }),
      before,
    );
  }
});

test('reduced motion removes keeper gait offset as walking distance changes', () => {
  const commands = [];
  const recorder = new Proxy(
    {},
    {
      get: (_, name) =>
        name.startsWith('create')
          ? () => ({ addColorStop() {} })
          : (...args) => commands.push([name, ...args]),
      set: () => true,
    },
  );
  const r = new Renderer({ getContext: () => recorder }),
    g = createGame(0);
  Object.assign(r, { reduced: true, s: 35, cx: 400, cy: 200 });
  g.steps = 0;
  r.object(g, { ...g.player, type: 'player' }, 0);
  const still = JSON.stringify(commands);
  commands.length = 0;
  g.steps = 0.7;
  r.object(g, { ...g.player, type: 'player' }, 0);
  assert.equal(JSON.stringify(commands), still);
});

test('photo frames preserve scene framing, particles, visual effects and game state', () => {
  globalThis.innerWidth = 390;
  globalThis.innerHeight = 844;
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '0px' });
  for (let index = 0; index < LEVELS.length; index++) {
    const g = createGame(index);
    const r = new Renderer({ style: {}, getContext: () => ctx });
    r.frame(g, 8, 0.016, 'pause');
    r.burst(g.player.x, g.player.y, '#ffffff', 4);
    r.pops.sample = 0.4;
    r.shake = 2;
    const capture = () =>
      JSON.stringify({
        game: g,
        particles: r.particles,
        pops: r.pops,
        shake: r.shake,
        camera: [r.cx, r.cy, r.s],
        restoration: r.restoration,
      });
    const before = capture();
    for (let frame = 0; frame < 20; frame++) r.frame(g, 8, 0, 'photo');
    assert.equal(capture(), before);
  }
});
