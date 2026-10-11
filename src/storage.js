import { LEVELS, createGame, walkable, restorationReady } from './core.js';
export const SAVE_KEY = 'lumen-relay-v1';
export function freshSave() {
  return {
    version: 1,
    unlocked: 0,
    best: {},
    current: null,
    settings: { sound: true, quality: 'high', reduced: false, diagnostics: false },
  };
}
export function validateSave(raw) {
  const out = freshSave();
  if (!raw || raw.version !== 1) return out;
  out.unlocked = Number.isInteger(raw.unlocked)
    ? Math.max(0, Math.min(LEVELS.length - 1, raw.unlocked))
    : 0;
  if (raw.best && typeof raw.best === 'object')
    for (let i = 0; i < LEVELS.length; i++) {
      const b = raw.best[i];
      if (b && Number.isFinite(b.time) && b.time >= 0 && Number.isInteger(b.wisps))
        out.best[i] = {
          time: b.time,
          wisps: Math.min(LEVELS[i].wisps.length, Math.max(0, b.wisps)),
          blooms: Number.isInteger(b.blooms)
            ? Math.min(LEVELS[i].buds.length, Math.max(0, b.blooms))
            : 0,
          falls: Math.max(0, Number(b.falls) || 0),
        };
    }
  for (const index of Object.keys(out.best))
    out.unlocked = Math.max(out.unlocked, Math.min(LEVELS.length - 1, Number(index) + 1));
  if (raw.settings) {
    out.settings.sound = raw.settings.sound !== false;
    out.settings.quality = raw.settings.quality === 'low' ? 'low' : 'high';
    out.settings.reduced = raw.settings.reduced === true;
    out.settings.diagnostics = raw.settings.diagnostics === true;
  }
  if (
    raw.current &&
    Number.isInteger(raw.current.index) &&
    raw.current.index >= 0 &&
    raw.current.index <= out.unlocked
  )
    out.current = raw.current;
  return out;
}
export function readSave(storage) {
  try {
    return validateSave(JSON.parse(storage.getItem(SAVE_KEY)));
  } catch {
    return freshSave();
  }
}
export function writeSave(storage, save) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
export function packGame(g) {
  return {
    index: g.index,
    relays: [...g.relays],
    mirrors: { ...g.mirrors },
    wisps: [...g.wisps],
    blooms: [...g.blooms],
    chimes: [...g.chimes],
    carrying: g.player.carrying,
    checkpoint: [...g.checkpoint],
    elapsed: g.elapsed,
    time: g.time,
    falls: g.falls,
    complete: g.complete,
    exploring: g.exploring,
  };
}
export function restoreGame(data) {
  if (!data || !Number.isInteger(data.index) || data.index < 0 || data.index >= LEVELS.length)
    return null;
  const g = createGame(data.index);
  if (Array.isArray(data.relays))
    data.relays.forEach((id) => {
      if (g.level.relays.some((r) => r.id === id)) g.relays.add(id);
    });
  for (const m of g.level.mirrors) {
    const d = data.mirrors?.[m.id];
    if (Number.isInteger(d) && d >= 0 && d < 4) g.mirrors[m.id] = d;
  }
  if (Array.isArray(data.wisps))
    data.wisps.forEach((i) => {
      if (Number.isInteger(i) && i >= 0 && i < g.level.wisps.length) g.wisps.add(i);
    });
  if (Array.isArray(data.blooms))
    data.blooms.forEach((id) => {
      if (g.level.buds.some((b) => b.id === id)) g.blooms.add(id);
    });
  if (Array.isArray(data.chimes))
    data.chimes.forEach((id) => {
      if ((g.level.chimes || []).some((c) => c.id === id)) g.chimes.add(id);
    });
  // Completion flags alone cannot unlock a restored world in a corrupt save.
  if (data.complete === true && restorationReady(g)) {
    g.complete = true;
    g.exploring = data.exploring === true;
  }
  g.player.carrying = data.carrying === true;
  if (
    Array.isArray(data.checkpoint) &&
    data.checkpoint.length === 2 &&
    data.checkpoint.every(Number.isFinite) &&
    [
      g.level.spawn,
      ...g.level.sources.map((s) => [s.x, s.y]),
      ...g.level.relays.filter((r) => g.relays.has(r.id)).map((r) => [r.x, r.y]),
      ...(g.level.chimes || []).filter((c) => g.chimes.has(c.id)).map((c) => [c.x, c.y]),
    ].some((p) => p[0] === data.checkpoint[0] && p[1] === data.checkpoint[1]) &&
    walkable(g, ...data.checkpoint)
  ) {
    g.checkpoint = [...data.checkpoint];
    [g.player.x, g.player.y] = g.checkpoint;
  }
  g.elapsed = Number.isFinite(data.elapsed) ? Math.max(0, data.elapsed) : 0;
  g.time = Number.isFinite(data.time) ? Math.max(0, data.time) : 0;
  g.falls = Number.isInteger(data.falls) ? Math.max(0, data.falls) : 0;
  g.player.invincible = 1.25;
  return g;
}
