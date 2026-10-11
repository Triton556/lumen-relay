import assert from 'node:assert/strict';
import {
  freshSave,
  validateSave,
  readSave,
  writeSave,
  packGame,
  restoreGame,
} from '../src/storage.js';
import { LEVELS, createGame, update, walkable } from '../src/core.js';
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
test('Malformed/absent storage resets safely', () => {
  for (const v of [null, '', 'undefined', '{bad', 'null', '42', '[]', '{"version":2}'])
    assert.deepEqual(readSave({ getItem: () => v }), freshSave());
});
test('Denied read/write storage fails gracefully', () => {
  assert.deepEqual(
    readSave({
      getItem() {
        throw Error('denied');
      },
    }),
    freshSave(),
  );
  assert.equal(
    writeSave(
      {
        setItem() {
          throw Error('quota');
        },
      },
      freshSave(),
    ),
    false,
  );
});
test('Unlocked progress bounded and invalid current rejected', () => {
  assert.equal(validateSave({ version: 1, unlocked: 99 }).unlocked, LEVELS.length - 1);
  assert.equal(validateSave({ version: 1, unlocked: -2 }).unlocked, 0);
  assert.equal(validateSave({ version: 1, unlocked: 0, current: { index: 3 } }).current, null);
});
test('Settings normalized', () => {
  assert.deepEqual(
    validateSave({ version: 1, settings: { sound: false, quality: 'low', reduced: true } })
      .settings,
    { sound: false, quality: 'low', reduced: true, diagnostics: false },
  );
  assert.deepEqual(
    validateSave({ version: 1, settings: { sound: 0, quality: 'ultra', reduced: 'true' } })
      .settings,
    freshSave().settings,
  );
});
test('Invalid best records are rejected or clamped', () => {
  const v = validateSave({
    version: 1,
    best: {
      0: { time: -1, wisps: 3 },
      1: { time: 32, wisps: 99 },
      2: { time: Infinity, wisps: 2 },
    },
  });
  assert.equal(v.best[0], undefined);
  assert.equal(v.best[2], undefined);
  assert.equal(v.best[1].wisps, 3);
});
test('Pack/restore preserves legitimate puzzle progress', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const g = createGame(i);
    g.relays.add(g.level.relays[0].id);
    g.player.carrying = true;
    g.wisps.add(0);
    g.checkpoint = [g.level.sources[0].x, g.level.sources[0].y];
    g.elapsed = 10;
    g.time = 4;
    g.falls = 2;
    const r = restoreGame(packGame(g));
    assert.deepEqual(packGame(r), packGame(g));
    assert.deepEqual([r.player.x, r.player.y], g.checkpoint);
  }
});
test('Unknown relay/mirror/wisp and invalid numeric state rejected', () => {
  const g = restoreGame({
    index: 1,
    relays: ['bad', 'r1', 'r1'],
    mirrors: { m1: 98, m2: -1 },
    wisps: [-1, 1, 1, 99],
    elapsed: NaN,
    time: -1,
    falls: 1.5,
    carrying: 'yes',
    checkpoint: [999, 999],
  });
  assert.deepEqual([...g.relays], ['r1']);
  assert.deepEqual([...g.wisps], [1]);
  assert.equal(g.mirrors.m1, 2);
  assert.equal(g.elapsed, 0);
  assert.equal(g.time, 0);
  assert.equal(g.falls, 0);
  assert.equal(g.player.carrying, false);
  assert.deepEqual(g.checkpoint, g.level.spawn);
});
test('Invalid level indices rejected', () => {
  for (const index of [-1, LEVELS.length, 1.5, '1', NaN, null])
    assert.equal(restoreGame({ index }), null);
});
test('Corrupted corner checkpoint cannot create immovable spawn', () => {
  const g = restoreGame({ index: 0, checkpoint: [1, 6] });
  const before = [g.player.x, g.player.y];
  for (let i = 0; i < 20; i++) update(g, 0.05, { x: 1, y: 1 });
  assert.ok(
    Math.hypot(g.player.x - before[0], g.player.y - before[1]) > 0.1,
    'Validating only center tile accepts corner [1,6], but body collision blocks all movement',
  );
});
test('Bloom progress round-trips, filters corrupt IDs, and supports old saves', () => {
  const g = createGame(3);
  g.blooms.add('f1');
  g.blooms.add('f4');
  const restored = restoreGame(packGame(g));
  assert.deepEqual([...restored.blooms], ['f1', 'f4']);
  assert.deepEqual(
    [...restoreGame({ index: 3, blooms: ['f1', 'f1', 'unknown', 4, null] }).blooms],
    ['f1'],
  );
  assert.equal(restoreGame({ index: 0 }).blooms.size, 0);
  const best = validateSave({
    version: 1,
    best: {
      0: { time: 12, wisps: 3, blooms: 99 },
      1: { time: 10, wisps: 2, blooms: -3 },
      2: { time: 8, wisps: 1 },
    },
  });
  assert.equal(best.best[0].blooms, 2);
  assert.equal(best.best[1].blooms, 0);
  assert.equal(best.best[2].blooms, 0);
});
test('Four-garden completed save unlocks fifth only; partial save stays partial', () => {
  const old = { version: 1, unlocked: 3, best: { 3: { time: 60, wisps: 4 } }, current: null };
  assert.equal(validateSave(old).unlocked, 4);
  const partial = {
    version: 1,
    unlocked: 3,
    best: { 2: { time: 50, wisps: 2 } },
    current: { index: 3, relays: ['r1'], carrying: true },
  };
  const p = validateSave(partial);
  assert.equal(p.unlocked, 3);
  assert.deepEqual(p.current, partial.current);
  assert.equal(
    validateSave({ version: 1, unlocked: 4, best: { 4: { time: 60, wisps: 3 } } }).unlocked,
    5,
  );
});
test('Chime save round-trip preserves pair and valid checkpoint, filters invalid IDs', () => {
  const g = createGame(4);
  g.chimes.add('c1');
  g.chimes.add('c2');
  g.checkpoint = [4.5, 3.5];
  g.player.carrying = true;
  const r = restoreGame(packGame(g));
  assert.deepEqual(packGame(r), packGame(g));
  assert.equal(restoreGame({ index: 4, chimes: ['c1', 'c1', 'bad', 9] }).chimes.size, 1);
  assert.deepEqual(
    restoreGame({ index: 4, chimes: [], checkpoint: [4.5, 3.5] }).checkpoint,
    LEVELS[4].spawn,
  );
  assert.equal(restoreGame({ index: 4 }).chimes.size, 0);
});
test('Completed stroll roundtrips only when all mandatory restoration IDs validate', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const g = createGame(i);
    g.relays = new Set(g.level.relays.map((r) => r.id));
    g.chimes = new Set((g.level.chimes || []).map((c) => c.id));
    g.complete = true;
    g.exploring = true;
    g.elapsed = 123.45;
    let packed = packGame(g),
      restored = restoreGame(JSON.parse(JSON.stringify(packed)));
    assert.equal(restored.complete, true);
    assert.equal(restored.exploring, true);
    update(restored, 0.05, { x: 1, y: 0 });
    assert.equal(restored.elapsed, 123.45);
    packed.relays = [];
    restored = restoreGame(packed);
    assert.equal(restored.complete, false);
    assert.equal(restored.exploring, false);
    if (g.chimes.size) {
      packed = packGame(g);
      packed.chimes = [];
      restored = restoreGame(packed);
      assert.equal(restored.complete, false);
      assert.equal(restored.exploring, false);
    }
    packed = packGame(g);
    packed.exploring = false;
    restored = restoreGame(packed);
    assert.equal(restored.complete, true);
    assert.equal(restored.exploring, false);
    packed.complete = false;
    packed.exploring = true;
    restored = restoreGame(packed);
    assert.equal(restored.complete, false);
    assert.equal(restored.exploring, false);
  }
});
console.log(`${passed} tests passed`);
