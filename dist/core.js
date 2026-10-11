// Deterministic simulation. The renderer and UI never mutate puzzle state.
export const TAU = Math.PI * 2;
const rect = (x, y, w, h) =>
  Array.from({ length: w * h }, (_, i) => [x + (i % w), y + Math.floor(i / w)]);
const tiles = (...regions) => regions.flatMap((r) => rect(...r));
export const LEVELS = [
  {
    id: 'awakening',
    name: 'Пробуждение',
    subtitle: 'Сад забытого рассвета',
    description: 'Возьми искру у источника и зажги реле. Свет проложит дорогу.',
    palette: ['#55eee5', '#ffbd77'],
    spawn: [2.5, 7.5],
    floor: tiles(
      [1, 6, 5, 5],
      [8, 3, 5, 5],
      [0, 7, 1, 2],
      [2, 11, 2, 1],
      [3, 5, 2, 1],
      [8, 8, 2, 1],
      [10, 2, 2, 1],
      [13, 4, 1, 2],
    ),
    bridges: [{ id: 'b1', cells: rect(6, 6, 2, 1), relay: 'r1' }],
    sources: [
      { id: 's1', x: 2.5, y: 8.5 },
      { id: 's2', x: 9.5, y: 6.5 },
    ],
    relays: [
      { id: 'r1', x: 4.5, y: 7.5 },
      { id: 'r2', x: 11.5, y: 4.5 },
    ],
    mirrors: [],
    hazards: [],
    wisps: [
      [1.5, 6.5],
      [5.5, 10.5],
      [8.5, 3.5],
    ],
    buds: [
      { id: 'f1', x: 2.5, y: 11.5 },
      { id: 'f2', x: 13.5, y: 5.5 },
    ],
    exit: { x: 11.5, y: 6.5 },
    note: 'Каждый огонёк возвращает саду память.',
  },
  {
    id: 'refraction',
    name: 'Преломление',
    subtitle: 'Архипелаг зеркал',
    description: 'Поворачивай призмы, чтобы луч попадал в приёмник. Зажжённый луч удерживает мост.',
    palette: ['#81b4ff', '#fda4d9'],
    spawn: [2.5, 9.5],
    floor: tiles(
      [1, 8, 4, 4],
      [7, 5, 4, 5],
      [12, 2, 4, 5],
      [0, 9, 1, 2],
      [2, 12, 2, 1],
      [8, 10, 2, 1],
      [6, 6, 1, 2],
      [13, 1, 2, 1],
      [16, 3, 1, 2],
    ),
    bridges: [
      { id: 'b1', cells: rect(5, 8, 2, 1), mirror: 'm1' },
      { id: 'b2', cells: rect(11, 5, 1, 1), mirror: 'm2' },
    ],
    sources: [
      { id: 's1', x: 2.5, y: 10.5 },
      { id: 's2', x: 8.5, y: 8.5 },
      { id: 's3', x: 13.5, y: 5.5 },
    ],
    relays: [
      { id: 'r1', x: 9.5, y: 6.5 },
      { id: 'r2', x: 14.5, y: 3.5 },
    ],
    mirrors: [
      { id: 'm1', x: 4.5, y: 9.5, direction: 2, target: 0, receiver: [7.5, 9.5] },
      { id: 'm2', x: 10.5, y: 6.5, direction: 1, target: 0, receiver: [12.5, 6.5], relay: 'r1' },
    ],
    hazards: [],
    wisps: [
      [1.5, 11.5],
      [7.5, 5.5],
      [15.5, 2.5],
    ],
    buds: [
      { id: 'f1', x: 0.5, y: 10.5 },
      { id: 'f2', x: 8.5, y: 10.5 },
      { id: 'f3', x: 16.5, y: 4.5 },
    ],
    exit: { x: 14.5, y: 5.5 },
    note: 'Свет всегда находит новый путь.',
  },
  {
    id: 'pulse',
    name: 'Сердцебиение',
    subtitle: 'Ритм грозового сада',
    description:
      'Коралловые плиты пульсируют. Дождись тишины или проскользни рывком сквозь вспышку.',
    palette: ['#70f7c9', '#ff798d'],
    spawn: [2.5, 10.5],
    floor: tiles(
      [1, 8, 5, 4],
      [3, 3, 3, 5],
      [6, 3, 6, 3],
      [10, 6, 4, 5],
      [0, 9, 1, 2],
      [3, 12, 2, 1],
      [2, 3, 1, 2],
      [6, 2, 2, 1],
      [12, 11, 1, 1],
    ),
    bridges: [],
    sources: [
      { id: 's1', x: 2.5, y: 9.5 },
      { id: 's2', x: 7.5, y: 4.5 },
      { id: 's3', x: 12.5, y: 9.5 },
    ],
    relays: [
      { id: 'r1', x: 4.5, y: 4.5 },
      { id: 'r2', x: 11.5, y: 4.5 },
      { id: 'r3', x: 12.5, y: 7.5 },
    ],
    mirrors: [],
    hazards: [
      { cells: rect(3, 6, 3, 1), period: 3.4, offset: 0 },
      { cells: rect(8, 3, 1, 3), period: 3.4, offset: 1.3 },
      { cells: rect(10, 6, 4, 1), period: 3.6, offset: 2 },
    ],
    wisps: [
      [5.5, 11.5],
      [3.5, 3.5],
      [13.5, 10.5],
    ],
    buds: [
      { id: 'f1', x: 3.5, y: 12.5 },
      { id: 'f2', x: 6.5, y: 2.5 },
      { id: 'f3', x: 12.5, y: 11.5 },
    ],
    exit: { x: 11.5, y: 9.5 },
    note: 'Даже буря умеет слушать.',
  },
  {
    id: 'constellation',
    name: 'Созвездие',
    subtitle: 'Лунная обсерватория',
    description: 'Соедини четыре сада. Призмы, искры и ритм сойдутся в одном созвездии.',
    palette: ['#c4a0ff', '#ffdf91'],
    spawn: [2.5, 11.5],
    floor: tiles(
      [1, 10, 4, 4],
      [7, 9, 4, 5],
      [7, 3, 4, 4],
      [1, 2, 4, 5],
      [0, 11, 1, 2],
      [2, 14, 2, 1],
      [11, 11, 1, 2],
      [8, 14, 2, 1],
      [8, 2, 2, 1],
      [0, 2, 1, 2],
      [2, 1, 2, 1],
    ),
    bridges: [
      { id: 'b1', cells: rect(5, 11, 2, 1), relay: 'r1' },
      { id: 'b2', cells: rect(8, 7, 1, 2), mirror: 'm1' },
      { id: 'b3', cells: rect(5, 4, 2, 1), relay: 'r3' },
    ],
    sources: [
      { id: 's1', x: 2.5, y: 12.5 },
      { id: 's2', x: 9.5, y: 12.5 },
      { id: 's3', x: 9.5, y: 5.5 },
      { id: 's4', x: 2.5, y: 5.5 },
    ],
    relays: [
      { id: 'r1', x: 3.5, y: 11.5 },
      { id: 'r2', x: 9.5, y: 9.5 },
      { id: 'r3', x: 8.5, y: 3.5 },
      { id: 'r4', x: 2.5, y: 3.5 },
    ],
    mirrors: [
      { id: 'm1', x: 8.5, y: 10.5, direction: 0, target: 3, receiver: [8.5, 6.5], relay: 'r2' },
    ],
    hazards: [
      { cells: rect(7, 4, 4, 1), period: 4, offset: 1.3 },
      { cells: rect(1, 4, 4, 1), period: 4, offset: 0 },
    ],
    wisps: [
      [1.5, 13.5],
      [10.5, 13.5],
      [10.5, 3.5],
      [1.5, 2.5],
    ],
    buds: [
      { id: 'f1', x: 2.5, y: 14.5 },
      { id: 'f2', x: 11.5, y: 12.5 },
      { id: 'f3', x: 9.5, y: 2.5 },
      { id: 'f4', x: 2.5, y: 1.5 },
    ],
    exit: { x: 3.5, y: 5.5 },
    note: 'Обсерватория снова слышит далёкие сады.',
  },
  {
    id: 'station',
    name: 'Тихий вокзал',
    subtitle: 'Сад среди забытых арок',
    description:
      'Разбуди два колокольчика со знаком листа, неся искру. Вместе они вырастят постоянный мост. Искра останется с тобой.',
    style: 1,
    palette: ['#8ae2b5', '#f8c891'],
    spawn: [2.5, 11.5],
    floor: tiles(
      [1, 8, 5, 5],
      [2, 2, 4, 4],
      [9, 5, 5, 6],
      [0, 9, 1, 2],
      [2, 13, 2, 1],
      [1, 3, 1, 2],
      [4, 1, 1, 1],
      [14, 7, 1, 2],
      [10, 11, 2, 1],
    ),
    bridges: [
      { id: 'b1', cells: rect(3, 6, 1, 2), relay: 'r1' },
      { id: 'b2', cells: rect(6, 9, 3, 1), pair: 'leaf' },
    ],
    sources: [
      { id: 's1', x: 2.5, y: 10.5 },
      { id: 's2', x: 2.5, y: 4.5 },
      { id: 's3', x: 10.5, y: 9.5 },
    ],
    relays: [
      { id: 'r1', x: 4.5, y: 9.5 },
      { id: 'r2', x: 3.5, y: 2.5 },
      { id: 'r3', x: 12.5, y: 6.5 },
    ],
    mirrors: [],
    pairs: [{ id: 'leaf', name: 'Лист', symbol: 'leaf', color: '#a5e8bb' }],
    chimes: [
      { id: 'c1', pair: 'leaf', x: 4.5, y: 11.5 },
      { id: 'c2', pair: 'leaf', x: 4.5, y: 3.5 },
    ],
    hazards: [],
    wisps: [
      [1.5, 12.5],
      [2.5, 2.5],
      [13.5, 5.5],
    ],
    buds: [
      { id: 'f1', x: 0.5, y: 10.5 },
      { id: 'f2', x: 4.5, y: 1.5 },
      { id: 'f3', x: 14.5, y: 8.5 },
    ],
    exit: { x: 12.5, y: 9.5 },
    note: 'Пути заросли цветами. Но здесь по-прежнему ждут возвращения.',
  },
  {
    id: 'wellspring',
    name: 'Песня истока',
    subtitle: 'Лес, в котором рождаются звёзды',
    description:
      'Собери созвучия Солнца и Луны. Свет, призмы и живые мосты приведут к сердцу леса. Здесь начнётся новый рассвет.',
    style: 0,
    palette: ['#8ef1cc', '#ffdda4'],
    spawn: [2.5, 12.5],
    floor: tiles(
      [1, 10, 4, 4],
      [8, 10, 5, 4],
      [8, 3, 5, 4],
      [1, 2, 4, 5],
      [5, 7, 3, 3],
      [2, 14, 2, 1],
      [13, 11, 1, 2],
      [9, 2, 2, 1],
      [0, 3, 1, 2],
    ),
    bridges: [
      { id: 'b1', cells: rect(5, 11, 3, 1), relay: 'r1' },
      { id: 'b2', cells: rect(10, 7, 1, 3), mirror: 'm1' },
      { id: 'b3', cells: rect(5, 4, 3, 1), pair: 'sun' },
      { id: 'b4', cells: rect(4, 7, 1, 1), pair: 'moon' },
    ],
    sources: [
      { id: 's1', x: 2.5, y: 10.5 },
      { id: 's2', x: 9.5, y: 12.5 },
      { id: 's3', x: 11.5, y: 6.5 },
      { id: 's4', x: 2.5, y: 5.5 },
    ],
    relays: [
      { id: 'r1', x: 3.5, y: 11.5 },
      { id: 'r2', x: 9.5, y: 11.5 },
      { id: 'r3', x: 9.5, y: 3.5 },
      { id: 'r4', x: 3.5, y: 5.5 },
    ],
    mirrors: [
      { id: 'm1', x: 10.5, y: 10.5, direction: 1, target: 3, receiver: [10.5, 6.5], relay: 'r2' },
    ],
    pairs: [
      { id: 'sun', name: 'Солнце', symbol: 'sun', color: '#ffdda4' },
      { id: 'moon', name: 'Луна', symbol: 'moon', color: '#d6c2ff' },
    ],
    chimes: [
      { id: 'c1', pair: 'sun', x: 12.5, y: 12.5 },
      { id: 'c2', pair: 'sun', x: 12.5, y: 3.5 },
      { id: 'c3', pair: 'moon', x: 1.5, y: 13.5 },
      { id: 'c4', pair: 'moon', x: 1.5, y: 2.5 },
    ],
    hazards: [{ cells: rect(8, 5, 5, 1), period: 4.5, offset: 1.5 }],
    wisps: [
      [4.5, 13.5],
      [12.5, 13.5],
      [8.5, 3.5],
      [4.5, 2.5],
      [7.5, 8.5],
    ],
    buds: [
      { id: 'f1', x: 2.5, y: 14.5 },
      { id: 'f2', x: 13.5, y: 11.5 },
      { id: 'f3', x: 10.5, y: 2.5 },
      { id: 'f4', x: 0.5, y: 4.5 },
      { id: 'f5', x: 5.5, y: 9.5 },
    ],
    exit: { x: 6.5, y: 8.5 },
    note: 'Ты поделился маленькой искрой. И целый мир ответил светом.',
  },
];
export const key = (x, y) => `${Math.floor(x)},${Math.floor(y)}`;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function createGame(index = 0) {
  const level = LEVELS[Math.max(0, Math.min(index, LEVELS.length - 1))];
  return {
    index: LEVELS.indexOf(level),
    level,
    player: {
      x: level.spawn[0],
      y: level.spawn[1],
      facingX: 0,
      facingY: -1,
      carrying: false,
      dash: 0,
      cooldown: 0,
      invincible: 0,
      walking: false,
    },
    time: 0,
    elapsed: 0,
    relays: new Set(),
    mirrors: Object.fromEntries(level.mirrors.map((m) => [m.id, m.direction])),
    wisps: new Set(),
    blooms: new Set(),
    chimes: new Set(),
    checkpoint: [...level.spawn],
    events: [],
    complete: false,
    exploring: false,
    falls: 0,
    steps: 0,
  };
}
export function mirrorActive(g, m) {
  return g.mirrors[m.id] === m.target && (!m.relay || g.relays.has(m.relay));
}
export function pairActive(g, id) {
  const chimes = (g.level.chimes || []).filter((c) => c.pair === id);
  return chimes.length >= 2 && chimes.every((c) => g.chimes.has(c.id));
}
export function bridgeActive(g, b) {
  if (g.complete) return true;
  return b.relay
    ? g.relays.has(b.relay)
    : b.pair
      ? pairActive(g, b.pair)
      : mirrorActive(
          g,
          g.level.mirrors.find((m) => m.id === b.mirror),
        );
}
export function walkable(g, x, y) {
  const k = key(x, y);
  return (
    g.level.floor.some((p) => `${p[0]},${p[1]}` === k) ||
    g.level.bridges.some((b) => bridgeActive(g, b) && b.cells.some((p) => `${p[0]},${p[1]}` === k))
  );
}
export function hazardActive(g, h) {
  if (g.complete) return false;
  return ((g.time + h.offset) % h.period) / h.period < 0.52;
}
export function restorationReady(g) {
  return (
    g.level.relays.every((relay) => g.relays.has(relay.id)) &&
    (g.level.chimes || []).every((chime) => g.chimes.has(chime.id))
  );
}
export function beginExploration(g) {
  if (!g.complete || !restorationReady(g)) return false;
  g.exploring = true;
  g.player.dash = 0;
  return true;
}
export function interactable(g) {
  const candidates = [
    ...g.level.sources.map((o) => ({ ...o, type: 'source' })),
    ...g.level.relays.map((o) => ({ ...o, type: 'relay' })),
    ...g.level.mirrors.map((o) => ({ ...o, type: 'mirror' })),
    ...g.level.buds.map((o) => ({ ...o, type: 'bud' })),
    ...(g.level.chimes || []).map((o) => ({ ...o, type: 'chime' })),
    { ...g.level.exit, id: 'exit', type: 'exit' },
  ];
  return (
    candidates
      .filter((o) => distance(g.player, o) < 1.2)
      .sort(
        (a, b) =>
          interactionPriority(g, a) - interactionPriority(g, b) ||
          distance(g.player, a) - distance(g.player, b),
      )[0] || null
  );
}
function interactionPriority(g, o) {
  if (!interactionAvailable(g, o)) return 2;
  return o.type === 'bud' ? 1 : 0;
}
// Authored guidance describes the next blocked connection, without solving its route.
const GUIDANCE = {
  refraction: [
    { until: 'r1', mirror: 'm1' },
    { until: 'r2', after: 'r1', mirror: 'm2' },
  ],
  constellation: [{ until: 'r3', after: 'r2', mirror: 'm1' }],
  station: [{ until: 'r3', after: 'r2', pair: 'leaf' }],
  wellspring: [
    { until: 'r3', after: 'r2', mirror: 'm1' },
    { until: 'r4', after: 'r3', pair: 'sun' },
  ],
};
function pairObjective(g, id) {
  const pair = g.level.pairs.find((p) => p.id === id);
  const count = g.level.chimes.filter((c) => c.pair === id && g.chimes.has(c.id)).length;
  return `Собери созвучие «${pair.name}» · ${count} / 2`;
}
export function objective(g) {
  if (g.exploring) return 'Сад восстановлен · побудь здесь';
  for (const step of GUIDANCE[g.level.id] || []) {
    if (g.relays.has(step.until) || (step.after && !g.relays.has(step.after))) continue;
    if (step.mirror) {
      const mirror = g.level.mirrors.find((m) => m.id === step.mirror);
      if (!mirrorActive(g, mirror)) return 'Направь призму на приёмник';
    }
    if (step.pair && !pairActive(g, step.pair)) return pairObjective(g, step.pair);
  }
  const done = g.relays.size,
    total = g.level.relays.length;
  if (done === total) {
    const pair = (g.level.pairs || []).find((p) => !pairActive(g, p.id));
    return pair ? pairObjective(g, pair.id) : 'Верни свет в маяк';
  }
  return `Зажги реле · ${done} / ${total}`;
}
// Whether the nearby prompt represents a useful action rather than a status label.
export function interactionAvailable(g, o = interactable(g)) {
  if (!o || (g.complete && !g.exploring)) return false;
  if (g.exploring && !['source', 'bud'].includes(o.type)) return false;
  if (o.type === 'source') return !g.player.carrying;
  if (o.type === 'relay') return !g.relays.has(o.id) && g.player.carrying;
  if (o.type === 'bud') return !g.blooms.has(o.id) && g.player.carrying;
  if (o.type === 'chime') return !g.chimes.has(o.id) && g.player.carrying;
  if (o.type === 'mirror') return !o.relay || g.relays.has(o.relay);
  return restorationReady(g);
}
export function interactionText(g, o = interactable(g)) {
  if (!o) return '';
  if (g.exploring && ['relay', 'mirror', 'chime'].includes(o.type))
    return 'Свет сохранён · сад уже восстановлен';
  if (g.exploring && o.type === 'exit') return 'Маяк светит · итоги сада в меню паузы';
  if (o.type === 'chime') {
    const pair = g.level.pairs.find((p) => p.id === o.pair),
      count = g.level.chimes.filter((c) => c.pair === o.pair && g.chimes.has(c.id)).length;
    return pairActive(g, o.pair)
      ? `Созвучие «${pair.name}» собрано`
      : g.chimes.has(o.id)
        ? `Ждёт парный колокольчик · «${pair.name}» ${count}/2`
        : g.player.carrying
          ? `Разбудить «${pair.name}» · ${count}/2`
          : `Нужна искра · колокольчик «${pair.name}»`;
  }
  if (o.type === 'bud')
    return g.blooms.has(o.id)
      ? 'Цветок проснулся'
      : g.player.carrying
        ? 'Поделиться светом с цветком'
        : 'Цветку нужна искра рядом';
  if (o.type === 'source') return g.player.carrying ? 'Искра уже с тобой' : 'Взять искру';
  if (o.type === 'relay')
    return g.relays.has(o.id)
      ? 'Реле зажжено'
      : g.player.carrying
        ? 'Зажечь реле'
        : 'Нужна искра из источника';
  if (o.type === 'mirror')
    return o.relay && !g.relays.has(o.relay) ? 'Сначала зажги соседнее реле' : 'Повернуть призму';
  return restorationReady(g)
    ? 'Пробудить маяк'
    : `Сначала зажги все реле · ${g.relays.size}/${g.level.relays.length}`;
}
function emit(g, type, data = {}) {
  g.events.push({ ...data, type });
}
export function interact(g) {
  if (g.complete && !g.exploring) return;
  const o = interactable(g);
  if (!o) return;
  if (g.exploring && !['source', 'bud'].includes(o.type)) return;
  if (o.type === 'source') {
    if (!g.player.carrying) {
      g.player.carrying = true;
      g.checkpoint = [o.x, o.y];
      emit(g, 'pickup', o);
    }
  }
  if (o.type === 'relay') {
    if (g.relays.has(o.id)) return;
    if (!g.player.carrying) {
      emit(g, 'hint', { text: 'Возьми искру у светящегося источника.' });
      return;
    }
    g.relays.add(o.id);
    g.player.carrying = false;
    g.checkpoint = [o.x, o.y];
    emit(g, 'relay', o);
  }
  if (o.type === 'mirror') {
    if (o.relay && !g.relays.has(o.relay)) {
      emit(g, 'hint', { text: 'Этой призме нужна энергия соседнего реле.' });
      return;
    }
    g.mirrors[o.id] = (g.mirrors[o.id] + 1) % 4;
    emit(g, mirrorActive(g, o) ? 'aligned' : 'rotate', o);
    if (
      ![
        [-0.16, -0.16],
        [0.16, -0.16],
        [-0.16, 0.16],
        [0.16, 0.16],
      ].every(([dx, dy]) => walkable(g, g.player.x + dx, g.player.y + dy))
    ) {
      recall(g);
      emit(g, 'hint', { text: 'Мост погас. Ты вернулся к последнему огню, сохранив искру.' });
    }
  }
  if (o.type === 'chime') {
    if (g.chimes.has(o.id)) {
      if (!pairActive(g, o.pair))
        emit(g, 'hint', {
          text: 'Этот колокольчик ждёт второй с таким же знаком. Найди его в другом саду.',
        });
      return;
    }
    if (!g.player.carrying) {
      emit(g, 'hint', { text: 'Принеси искру к колокольчику. Он споёт и сохранит твой свет.' });
      return;
    }
    g.chimes.add(o.id);
    g.checkpoint = [o.x, o.y];
    emit(g, pairActive(g, o.pair) ? 'duet' : 'chime', o);
  }
  if (o.type === 'bud') {
    if (g.blooms.has(o.id)) return;
    if (!g.player.carrying) {
      emit(g, 'hint', {
        text: 'Принеси искру к спящему цветку. Цветок не заберёт её — только согреется.',
      });
      return;
    }
    g.blooms.add(o.id);
    emit(g, 'bloom', o);
  }
  if (o.type === 'exit') {
    if (restorationReady(g)) {
      g.complete = true;
      emit(g, 'complete', o);
    } else emit(g, 'hint', { text: 'Маяк ждёт все реле и созвучия этого сада.' });
  }
}
export function startDash(g) {
  if ((g.complete && !g.exploring) || g.player.cooldown > 0) return false;
  g.player.dash = 0.2;
  g.player.cooldown = 1.05;
  emit(g, 'dash');
  return true;
}
export function recall(g) {
  if (g.complete && !g.exploring) return;
  g.player.x = g.checkpoint[0];
  g.player.y = g.checkpoint[1];
  g.player.dash = 0;
  g.player.invincible = 1.25;
  emit(g, 'recall');
}
export function update(g, dt, input = { x: 0, y: 0 }) {
  if (g.complete && !g.exploring) return;
  dt = Math.min(Math.max(dt, 0), 0.05);
  g.time += dt;
  if (!g.complete) g.elapsed += dt;
  const p = g.player,
    oldX = p.x,
    oldY = p.y;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.invincible = Math.max(0, p.invincible - dt);
  let x = input.x || 0,
    y = input.y || 0;
  const norm = Math.hypot(x, y);
  if (norm > 0.05) {
    x /= Math.max(1, norm);
    y /= Math.max(1, norm);
    p.facingX = x / (Math.hypot(x, y) || 1);
    p.facingY = y / (Math.hypot(x, y) || 1);
  }
  const dashing = p.dash > 0;
  const speed = dashing ? 8 : 2.6;
  if (dashing) {
    x = p.facingX;
    y = p.facingY;
  }
  p.dash = Math.max(0, p.dash - dt);
  // Substeps prevent tunnelling through gaps and hazards on low-frame-rate devices.
  const sub = Math.max(1, Math.ceil((speed * dt) / 0.08));
  for (let i = 0; i < sub; i++) {
    const mx = (x * speed * dt) / sub,
      my = (y * speed * dt) / sub;
    const safe = (xx, yy) =>
      walkable(g, xx - 0.16, yy - 0.16) &&
      walkable(g, xx + 0.16, yy - 0.16) &&
      walkable(g, xx - 0.16, yy + 0.16) &&
      walkable(g, xx + 0.16, yy + 0.16);
    if (safe(p.x + mx, p.y)) p.x += mx;
    if (safe(p.x, p.y + my)) p.y += my;
    if (
      !dashing &&
      p.invincible === 0 &&
      g.level.hazards.some(
        (h) => hazardActive(g, h) && h.cells.some((c) => key(p.x, p.y) === `${c[0]},${c[1]}`),
      )
    ) {
      g.falls++;
      recall(g);
      emit(g, 'hurt');
      break;
    }
  }
  p.walking = Math.hypot(p.x - oldX, p.y - oldY) > 0.0001;
  if (p.walking) g.steps += dt;
  g.level.wisps.forEach((w, i) => {
    if (!g.wisps.has(i) && Math.hypot(p.x - w[0], p.y - w[1]) < 0.52) {
      g.wisps.add(i);
      emit(g, 'wisp', { x: w[0], y: w[1] });
    }
  });
}
export function snapshot(g) {
  return {
    level: g.index,
    player: { ...g.player },
    relays: [...g.relays],
    mirrors: { ...g.mirrors },
    wisps: [...g.wisps],
    blooms: [...g.blooms],
    chimes: [...g.chimes],
    complete: g.complete,
    exploring: g.exploring,
    objective: objective(g),
    nearby: interactionText(g),
    elapsed: g.elapsed,
    falls: g.falls,
  };
}
