// Headless DOM/event harness: tests UI lifecycle logic, not rendering or human playability.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { icon } from '../src/icons.js';
import * as core from '../src/core.js';
import * as storage from '../src/storage.js';
const source = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8').replace(
  /\bimport\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm,
  '',
);
function harness(initialSave = null, options = {}) {
  const soundCalls = [],
    renderFrames = [],
    blobCallbacks = [],
    downloads = [],
    revoked = [],
    createdUrls = [];
  let persisted = initialSave;
  let captured,
    now = 0;
  const nodes = new Map(),
    listeners = {},
    timers = [],
    raf = [];
  const doc = {
    hidden: false,
    body: { dataset: {}, append() {} },
    activeElement: null,
    addEventListener: (n, f) => (listeners['doc:' + n] = f),
    createElement: () => node('created' + nodes.size),
    getElementById: (id) => node(id),
  };
  function node(id) {
    if (nodes.has(id)) return nodes.get(id);
    const classes = new Set();
    const n = {
      style: {},
      remove() {
        n.removed = true;
      },
      click() {
        if (options.downloadThrows) throw Error('blocked download');
        downloads.push(n.download);
      },
      toBlob(callback) {
        if (options.blobThrows) throw Error('canvas failure');
        blobCallbacks.push(callback);
      },
      classList: {
        toggle(c, on) {
          if (on ?? !classes.has(c)) classes.add(c);
          else classes.delete(c);
        },
        add(c) {
          classes.add(c);
        },
        remove(c) {
          classes.delete(c);
        },
        contains(c) {
          return classes.has(c);
        },
      },
      focus() {
        doc.activeElement = n;
      },
      blur() {
        doc.activeElement = null;
      },
      querySelector: () => node(id + 'child'),
      querySelectorAll: () => [],
      setAttribute() {},
      setPointerCapture() {},
      releasePointerCapture() {},
      children: [],
      replaceChildren() {
        n.children = [];
      },
      append(child) {
        n.children.push(child);
      },
      addEventListener(name, f) {
        n[name] = f;
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    };
    nodes.set(id, n);
    return n;
  }
  class Renderer {
    constructor() {
      this.particles = [];
    }
    frame(g, t, dt, mode) {
      renderFrames.push({ t, dt, mode });
    }
    burst() {}
  }
  class Sound {
    unlock() {
      soundCalls.push('unlock');
    }
    suspend() {
      soundCalls.push('suspend');
    }
    setEnabled(v) {
      soundCalls.push('enabled:' + v);
    }
    play() {}
  }
  const context = {
    ...core,
    ...storage,
    icon,
    URL: {
      createObjectURL() {
        const url = 'blob:test-' + createdUrls.length;
        createdUrls.push(url);
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
    createGame(i) {
      captured = core.createGame(i);
      return captured;
    },
    restoreGame(data) {
      const restored = storage.restoreGame(data);
      if (restored) captured = restored;
      return restored;
    },
    Renderer,
    Sound,
    document: doc,
    window: { addEventListener: (n, f) => (listeners[n] = f) },
    localStorage: {
      getItem: () => persisted,
      setItem(k, v) {
        if (options.denyWrites) throw Error('Storage denied');
        persisted = v;
      },
    },
    matchMedia: () => ({ matches: false }),
    innerWidth: 1000,
    performance: { now: () => 0 },
    setTimeout: (f, ms) => timers.push({ f, ms }),
    requestAnimationFrame: (f) => raf.push(f),
    console,
  };
  vm.runInNewContext(source, context);
  return {
    node,
    saved: () => JSON.parse(persisted),
    soundCalls,
    renderFrames,
    blobCallbacks,
    downloads,
    revoked,
    createdUrls,
    pagehide() {
      listeners.pagehide();
    },
    key(code, modifiers = {}) {
      let prevented = false;
      listeners.keydown({
        code,
        preventDefault() {
          prevented = true;
        },
        repeat: false,
        ...modifiers,
      });
      return prevented;
    },
    frame(dt = 16) {
      now += dt;
      raf.shift()(now);
    },
    timer(ms) {
      for (const t of timers.splice(0)) if (t.ms === ms) t.f();
    },
    state: () => JSON.parse(context.window.render_game_to_text()),
    get game() {
      return captured;
    },
    blur() {
      listeners.blur();
    },
    resize(w) {
      context.innerWidth = w;
      listeners.resize();
    },
  };
}
let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('PASS', name);
    passed++;
  } catch (e) {
    console.error('FAIL', name, e.stack);
    process.exitCode = 1;
  }
}
test('Pause freezes simulation and clears held keys', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.key('KeyD');
  h.frame();
  h.key('Escape');
  const before = h.state();
  for (let i = 0; i < 20; i++) h.frame();
  assert.equal(h.state().elapsed, before.elapsed);
  h.key('Escape');
  h.frame();
  assert.equal(h.state().player.x, before.player.x);
  assert.equal(h.state().player.y, before.player.y);
});
test('Settings returns to pause, resume works, restart resets', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.frame();
  h.key('Escape');
  h.node('pause-settings').onclick();
  assert.equal(h.state().mode, 'settings');
  h.node('settings-back').onclick();
  assert.equal(h.state().mode, 'pause');
  h.node('resume-btn').onclick();
  h.frame();
  h.node('restart-btn').onclick();
  assert.equal(h.state().elapsed, 0);
  assert.equal(h.state().mode, 'playing');
});
test('Completion survives pause during celebration', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.game.complete = true;
  h.game.events.push({ type: 'complete' });
  h.frame();
  h.key('Escape');
  h.timer(1300);
  h.key('Escape');
  h.frame();
  assert.equal(h.state().mode, 'complete');
});
test('Completion survives browser blur during celebration', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.game.complete = true;
  h.game.events.push({ type: 'complete' });
  h.frame();
  h.blur();
  h.timer(1300);
  if (h.state().mode === 'pause') h.node('resume-btn').onclick();
  h.frame();
  assert.equal(h.state().mode, 'complete');
});
test('Pause recall button provides touch-accessible recovery and resumes', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.key('KeyE');
  h.frame();
  assert.equal(h.state().player.carrying, true);
  h.key('KeyD');
  for (let i = 0; i < 8; i++) h.frame();
  h.key('Escape');
  h.node('recall-btn').onclick();
  assert.equal(h.state().mode, 'playing');
  assert.equal(h.state().player.carrying, true);
  assert.deepEqual([h.state().player.x, h.state().player.y], h.game.checkpoint);
});
test('Touch controls synchronize immediately on viewport resize', () => {
  const h = harness();
  h.node('play-btn').onclick();
  assert.equal(h.node('touch-controls').classList.contains('hidden'), true);
  h.key('KeyD');
  h.frame();
  h.resize(500);
  assert.equal(h.node('touch-controls').classList.contains('hidden'), false);
  const before = h.state().player;
  h.frame();
  assert.equal(h.state().player.x, before.x);
  h.resize(1000);
  assert.equal(h.node('touch-controls').classList.contains('hidden'), true);
  h.key('Escape');
  h.resize(500);
  assert.equal(h.node('touch-controls').classList.contains('hidden'), true);
});
test('Completion panel reports optional bloom count', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.game.blooms.add('f1');
  h.game.complete = true;
  h.game.events.push({ type: 'complete' });
  h.frame();
  assert.equal(h.node('stat-blooms').textContent, '1 / 2');
});
test('Low frame-rate simulation advances same distance as high frame-rate', () => {
  const slow = harness(),
    fast = harness();
  slow.node('play-btn').onclick();
  fast.node('play-btn').onclick();
  slow.key('KeyD');
  fast.key('KeyD');
  for (let i = 0; i < 4; i++) slow.frame(100);
  for (let i = 0; i < 20; i++) fast.frame(20);
  assert.ok(Math.abs(slow.state().elapsed - fast.state().elapsed) < 1e-9);
  assert.ok(Math.abs(slow.state().player.x - fast.state().player.x) < 1e-9);
  assert.ok(Math.abs(slow.state().player.y - fast.state().player.y) < 1e-9);
});
test('Long frame gaps are bounded rather than teleporting player', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.key('KeyD');
  h.frame(1000);
  assert.ok(Math.abs(h.state().elapsed - 0.15) < 1e-9);
});
test('Mobile view toggle preserves game state and resets with a new garden', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.resize(500);
  assert.equal(h.node('camera-btn').classList.contains('hidden'), false);
  const before = h.state();
  h.node('camera-btn').onclick();
  assert.equal(h.node('camera-btn').textContent, 'За хранителем');
  assert.deepEqual(h.state(), before);
  h.node('camera-btn').onclick();
  assert.equal(h.node('camera-btn').textContent, 'Весь сад');
  assert.deepEqual(h.state(), before);
  h.node('camera-btn').onclick();
  h.node('restart-btn').onclick();
  assert.equal(h.node('camera-btn').textContent, 'Весь сад');
});
test('Paused or resized joystick cannot revive a stale captured pointer', () => {
  const h = harness();
  h.node('play-btn').onclick();
  const joy = h.node('joystick'),
    event = { pointerId: 7, clientX: 95, clientY: 50, preventDefault() {} };
  joy.pointerdown(event);
  h.frame();
  h.key('Escape');
  joy.pointermove(event);
  h.key('Escape');
  const before = h.state().player;
  h.frame();
  assert.equal(h.state().player.x, before.x);
  assert.equal(h.state().player.y, before.y);
  joy.pointerdown(event);
  h.resize(500);
  joy.pointermove(event);
  const resized = h.state().player;
  h.frame();
  assert.equal(h.state().player.x, resized.x);
  assert.equal(h.state().player.y, resized.y);
});
function completedFixture(h) {
  h.node('play-btn').onclick();
  for (const r of h.game.level.relays) h.game.relays.add(r.id);
  h.game.complete = true;
  h.game.events.push({ type: 'complete' });
  h.frame();
  h.key('Escape');
}
test('Stroll stays playable through stale celebration, pause, results, and reload', () => {
  const h = harness();
  completedFixture(h);
  h.node('stay-btn').onclick();
  assert.equal(h.state().mode, 'playing');
  assert.equal(h.state().exploring, true);
  h.timer(1300);
  assert.equal(h.state().mode, 'playing');
  const elapsed = h.state().elapsed;
  h.key('KeyD');
  h.frame();
  assert.equal(h.state().elapsed, elapsed);
  h.key('Escape');
  assert.equal(h.state().mode, 'pause');
  assert.equal(h.node('results-btn').classList.contains('hidden'), false);
  h.node('results-btn').onclick();
  assert.equal(h.state().mode, 'complete');
  h.node('stay-btn').onclick();
  assert.equal(h.state().mode, 'playing');
  h.key('Escape');
  const reload = harness(JSON.stringify(h.saved()));
  reload.node('play-btn').onclick();
  assert.equal(reload.state().exploring, true);
  assert.equal(reload.state().complete, true);
  assert.equal(reload.state().mode, 'playing');
  assert.equal(reload.state().elapsed, elapsed);
});
test('Postlude collection updates best counts without changing completion time', () => {
  const h = harness();
  completedFixture(h);
  h.node('stay-btn').onclick();
  const time = h.saved().best[0].time;
  h.game.blooms.add('f1');
  h.game.events.push({ type: 'bloom', id: 'f1' });
  h.frame();
  assert.equal(h.saved().best[0].blooms, 1);
  assert.equal(h.saved().best[0].time, time);
  assert.equal(h.saved().current.exploring, true);
  h.key('Escape');
  h.node('results-btn').onclick();
  assert.equal(h.node('stat-blooms').textContent, '1 / 2');
  h.node('stay-btn').onclick();
  h.node('restart-btn').onclick();
  assert.equal(h.state().complete, false);
  assert.equal(h.state().exploring, false);
  assert.equal(h.saved().best[0].blooms, 1);
});
test('HUD marks a full source as informational rather than a redundant action', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.frame();
  assert.equal(h.node('interact-prompt').disabled, false);
  h.key('KeyE');
  h.frame();
  assert.equal(h.node('interact-prompt').disabled, true);
  assert.equal(h.node('interact-prompt').classList.contains('informational'), true);
});
test('Storage denial in title/settings remains visible through start and pause, and recovers', () => {
  const options = { denyWrites: true },
    h = harness(null, options);
  h.node('title-settings').onclick();
  h.node('quality-setting').onchange({ target: { value: 'low' } });
  for (const screen of ['title', 'settings', 'pause', 'complete'])
    assert.equal(h.node(screen + '-storage-warning').classList.contains('hidden'), false);
  assert.equal(h.node('settings-save-note').classList.contains('hidden'), true);
  h.node('settings-back').onclick();
  assert.equal(h.state().mode, 'title');
  assert.equal(h.node('title-storage-warning').classList.contains('hidden'), false);
  h.node('play-btn').onclick();
  h.key('Escape');
  assert.equal(h.node('pause-storage-warning').classList.contains('hidden'), false);
  options.denyWrites = false;
  h.node('pause-settings').onclick();
  h.node('sound-setting').onchange({ target: { checked: false } });
  for (const screen of ['title', 'settings', 'pause', 'complete'])
    assert.equal(h.node(screen + '-storage-warning').classList.contains('hidden'), true);
  assert.equal(h.node('settings-save-note').classList.contains('hidden'), false);
});
test('Sound setting changes never unlock audio in title or paused settings', () => {
  const h = harness();
  h.node('title-settings').onclick();
  h.soundCalls.length = 0;
  h.node('sound-setting').onchange({ target: { checked: true } });
  assert.equal(h.soundCalls.includes('unlock'), false);
  assert.equal(h.soundCalls.at(-1), 'suspend');
  h.node('settings-back').onclick();
  h.node('play-btn').onclick();
  h.key('Escape');
  h.node('pause-settings').onclick();
  h.soundCalls.length = 0;
  h.node('sound-setting').onchange({ target: { checked: false } });
  h.node('sound-setting').onchange({ target: { checked: true } });
  h.node('quality-setting').onchange({ target: { value: 'low' } });
  assert.equal(h.soundCalls.includes('unlock'), false);
  h.node('settings-back').onclick();
  h.node('resume-btn').onclick();
  assert.equal(h.soundCalls.at(-1), 'unlock');
});
test('Selector Continue preserves stroll; explicit fresh replay preserves best records', () => {
  const h = harness();
  completedFixture(h);
  h.node('stay-btn').onclick();
  h.game.blooms.add('f1');
  h.game.events.push({ type: 'bloom', id: 'f1' });
  h.frame();
  h.key('Escape');
  h.node('menu-btn').onclick();
  const current = JSON.stringify(h.saved().current);
  const best = JSON.stringify(h.saved().best);
  h.node('levels-btn').onclick();
  assert.equal(h.node('levels-continue').disabled, false);
  assert.match(h.node('levels-continue').textContent, /прогулка/);
  assert.match(h.node('levels-replay-note').textContent, /вместо текущего/);
  assert.match(h.node('level-list').children[0].innerHTML, /цветы 1\/2/);
  h.node('levels-continue').onclick();
  assert.equal(h.state().exploring, true);
  assert.equal(JSON.stringify(h.saved().current), current);
  h.key('Escape');
  h.node('menu-btn').onclick();
  h.node('levels-btn').onclick();
  h.node('level-list').children[0].onclick();
  assert.equal(h.state().exploring, false);
  assert.equal(h.game.blooms.size, 0);
  assert.equal(JSON.stringify(h.saved().best), best);
});
test('Completion invitation distinguishes missing optional finds from fully tended garden', () => {
  const h = harness();
  completedFixture(h);
  assert.match(h.node('complete-invitation').textContent, /оставшиеся цветы/);
  assert.match(h.node('complete-invitation').textContent, /Время результата больше не меняется/);
  h.node('stay-btn').onclick();
  h.game.level.buds.forEach((b) => h.game.blooms.add(b.id));
  h.game.level.wisps.forEach((_, i) => h.game.wisps.add(i));
  h.key('Escape');
  h.node('results-btn').onclick();
  assert.match(
    h.node('complete-invitation').textContent,
    /Все огоньки найдены, все цветы проснулись/,
  );
});
test('Browser modifiers bypass gameplay keys without preventing shortcuts', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.key('KeyE');
  h.frame();
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    const before = JSON.stringify(h.state().player);
    for (const code of ['KeyR', 'KeyE', 'KeyD', 'Space', 'Escape'])
      assert.equal(h.key(code, { [modifier]: true }), false);
    h.frame();
    assert.equal(h.state().mode, 'playing');
    assert.equal(JSON.stringify(h.state().player), before);
  }
  assert.equal(h.key('KeyD', { shiftKey: true }), true);
  const x = h.state().player.x;
  h.frame();
  assert.notEqual(h.state().player.x, x);
});
test('Photo mode freezes simulation and decorative time, exits to pause, reload stays ordinary', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.key('KeyE');
  h.frame();
  h.key('Escape');
  const before = JSON.stringify(h.game),
    saved = JSON.stringify(h.saved());
  h.node('photo-btn').onclick();
  assert.equal(h.state().mode, 'photo');
  const t = h.renderFrames.at(-1).t;
  h.key('KeyD');
  h.key('KeyE');
  h.key('Space');
  h.key('KeyR');
  for (let i = 0; i < 30; i++) h.frame(100);
  assert.equal(JSON.stringify(h.game), before);
  assert.equal(JSON.stringify(h.saved()), saved);
  assert.equal(h.renderFrames.at(-1).t, t);
  assert.equal(h.renderFrames.at(-1).dt, 0);
  h.key('Escape');
  assert.equal(h.state().mode, 'pause');
  h.node('photo-btn').onclick();
  h.node('photo-back').onclick();
  assert.equal(h.state().mode, 'pause');
  const reload = harness(JSON.stringify(h.saved()));
  reload.node('play-btn').onclick();
  assert.equal(reload.state().mode, 'playing');
  assert.equal(reload.game.player.carrying, true);
});
test('Photo export debounces, downloads PNG and releases object URL after browser grace period', () => {
  const h = harness();
  h.node('play-btn').onclick();
  h.key('Escape');
  h.node('photo-btn').onclick();
  h.node('photo-export').onclick();
  h.node('photo-export').onclick();
  assert.equal(h.blobCallbacks.length, 1);
  assert.equal(h.node('photo-export').disabled, true);
  h.blobCallbacks.shift()({});
  assert.deepEqual(h.downloads, ['lumen-relay-garden-01.png']);
  assert.equal(h.node('photo-export').disabled, false);
  assert.equal(h.revoked.length, 0);
  h.timer(60000);
  assert.deepEqual(h.revoked, h.createdUrls);
});
test('Photo null/throw/download failures are retryable and stale callbacks never download', () => {
  const options = {},
    h = harness(null, options);
  h.node('play-btn').onclick();
  h.key('Escape');
  h.node('photo-btn').onclick();
  h.node('photo-export').onclick();
  h.blobCallbacks.shift()(null);
  assert.match(h.node('photo-status').textContent, /Не удалось/);
  assert.equal(h.node('photo-export').disabled, false);
  options.blobThrows = true;
  h.node('photo-export').onclick();
  assert.equal(h.node('photo-export').disabled, false);
  options.blobThrows = false;
  options.downloadThrows = true;
  h.node('photo-export').onclick();
  h.blobCallbacks.shift()({});
  assert.equal(h.downloads.length, 0);
  assert.equal(h.node('photo-export').disabled, false);
  h.pagehide();
  assert.deepEqual(h.revoked, h.createdUrls);
  options.downloadThrows = false;
  h.node('photo-export').onclick();
  const callback = h.blobCallbacks.shift();
  h.node('photo-back').onclick();
  callback({});
  assert.equal(h.downloads.length, 0);
  h.node('photo-btn').onclick();
  h.node('photo-export').onclick();
  const late = h.blobCallbacks.shift();
  h.pagehide();
  late({});
  assert.equal(h.downloads.length, 0);
});
console.log(`${passed} tests passed`);
