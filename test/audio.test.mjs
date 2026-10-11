import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/core.js';
import { Sound } from '../src/audio.js';
function mockAudio() {
  let created = 0;
  const nodes = [];
  class Audio {
    constructor() {
      created++;
      this.currentTime = 0;
      this.state = 'suspended';
      this.destination = {};
    }
    createGain() {
      const n = {
        gain: {
          value: 0,
          setTargetAtTime() {},
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {
          n.disconnected = true;
        },
      };
      nodes.push(n);
      return n;
    }
    createOscillator() {
      const n = {
        frequency: {
          value: 0,
          setTargetAtTime(v) {
            this.value = v;
          },
        },
        connect() {},
        disconnect() {
          n.disconnected = true;
        },
        start() {
          n.started = true;
        },
        stop() {
          n.stopped = true;
        },
      };
      nodes.push(n);
      return n;
    }
    async resume() {
      this.state = 'running';
    }
    async suspend() {
      this.state = 'suspended';
    }
  }
  globalThis.window = { AudioContext: Audio };
  return {
    nodes,
    get created() {
      return created;
    },
  };
}
test('audio is not constructed before a user-gesture unlock', async () => {
  const m = mockAudio(),
    s = new Sound();
  s.setEnabled(true);
  assert.equal(m.created, 0);
  s.setEnabled(false);
  await s.unlock();
  assert.equal(m.created, 0);
  s.setEnabled(true);
  await s.unlock();
  assert.equal(m.created, 1);
  await s.unlock();
  assert.equal(m.created, 1);
  assert.equal(s.voices.length, 4);
});
test('biomes have distinct ambience and pause suspends audio', async () => {
  mockAudio();
  const s = new Sound();
  await s.unlock();
  const chords = [];
  for (let i = 0; i < LEVELS.length; i++) {
    s.setBiome(i);
    chords.push(s.voices.map((v) => v.frequency.value).join(','));
  }
  assert.equal(new Set(chords).size, LEVELS.length);
  s.suspend();
  assert.equal(s.ctx.state, 'suspended');
  await s.unlock();
  assert.equal(s.ctx.state, 'running');
});
test('chime voices stop and disconnect, while muted cues allocate nothing', async () => {
  const m = mockAudio(),
    s = new Sound();
  await s.unlock();
  const count = m.nodes.length;
  s.play('bloom');
  const notes = m.nodes.slice(count).filter((n) => 'frequency' in n);
  assert.equal(notes.length, 3);
  for (const n of notes) {
    assert.equal(n.stopped, true);
    n.onended();
    assert.equal(n.disconnected, true);
  }
  s.setEnabled(false);
  const mutedCount = m.nodes.length;
  s.play('complete');
  assert.equal(m.nodes.length, mutedCount);
});

test('refreshing enabled settings never resumes a paused context', async () => {
  mockAudio();
  const s = new Sound();
  await s.unlock();
  s.suspend();
  s.setEnabled(true);
  assert.equal(s.ctx.state, 'suspended');
  s.setEnabled(false);
  s.setEnabled(true);
  assert.equal(s.ctx.state, 'suspended');
  await s.unlock();
  assert.equal(s.ctx.state, 'running');
});
