import { bridgeActive, pairActive, mirrorActive, hazardActive, interactable, TAU } from './core.js';
const cyan = '#67ffe9',
  gold = '#ffd996',
  coral = '#ff8198';
const hash = (a, b = 0) => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.width = 0;
    this.height = 0;
    this.particles = [];
    this.quality = 'high';
    this.reduced = false;
    this.shake = 0;
    this.stars = Array.from({ length: 135 }, (_, i) => ({
      x: hash(i, 1),
      y: hash(i, 2),
      r: hash(i, 3) * 1.3 + 0.3,
      p: hash(i, 4) * 6,
    }));
    this.pointer = { x: 0, y: 0 };
    this.pathCache = new WeakMap();
    this.pops = {};
    this.neonCache = new Map();
    this.neonPixels = 0;
    this.neonCacheLimit = 256;
    this.neonPixelLimit = 8_000_000;
    this.neonStats = { hits: 0, misses: 0, fallbacks: 0 };
  }
  resize() {
    const w = innerWidth,
      h = innerHeight,
      dpr = Math.min(devicePixelRatio || 1, this.quality === 'high' ? 2 : 1.25);
    if (w !== this.width || h !== this.height || this.dpr !== dpr) {
      this.width = w;
      this.height = h;
      this.dpr = dpr;
      if (typeof getComputedStyle === 'function' && typeof document !== 'undefined') {
        const css = getComputedStyle(document.documentElement);
        this.safeTop = parseFloat(css.getPropertyValue('--safe-top')) || 0;
        this.safeBottom = parseFloat(css.getPropertyValue('--safe-bottom')) || 0;
      }
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  project(x, y, z = 0) {
    return { x: this.cx + (x - y) * this.s, y: this.cy + (x + y) * this.s * 0.5 - z * this.s };
  }
  path(points, fill, stroke, width = 1) {
    if (this.neonCapture) {
      this.neonCapture.push({ kind: 'path', points, fill, stroke, width });
      return;
    }
    const c = this.ctx;
    c.beginPath();
    points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.stroke();
    }
  }
  line(a, b, color, width = 1) {
    if (this.neonCapture) {
      this.neonCapture.push({ kind: 'line', points: [a, b], stroke: color, width });
      return;
    }
    const c = this.ctx;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  ellipse(x, y, rx, ry, color) {
    if (this.neonCapture) {
      this.neonCapture.push({
        kind: 'ellipse',
        x,
        y,
        rx: Math.max(0.1, rx),
        ry: Math.max(0.1, ry),
        fill: color,
        width: 0,
      });
      return;
    }
    const c = this.ctx;
    c.beginPath();
    c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    c.fillStyle = color;
    c.fill();
  }
  glow(x, y, r, color, alpha = 1) {
    if (this.quality === 'low') r *= 0.72;
    const c = this.ctx;
    c.save();
    c.globalAlpha = (typeof c.globalAlpha === 'number' ? c.globalAlpha : 1) * alpha;
    const gr = c.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    gr.addColorStop(0, color);
    gr.addColorStop(1, color.slice(0, 7) + '00');
    c.fillStyle = gr;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  }
  clearNeonCache() {
    this.neonCache.clear();
    this.neonPixels = 0;
  }
  paintNeonPrimitive(ctx, shape) {
    ctx.beginPath();
    if (shape.kind === 'ellipse') ctx.ellipse(shape.x, shape.y, shape.rx, shape.ry, 0, 0, TAU);
    else {
      shape.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (shape.kind === 'path') ctx.closePath();
    }
    if (shape.fill) {
      ctx.fillStyle = shape.fill;
      ctx.fill();
    }
    if (shape.stroke) {
      ctx.strokeStyle = shape.stroke;
      ctx.lineWidth = shape.width;
      ctx.stroke();
    }
  }
  cachedNeon(shape, color, blur) {
    // Translation is deliberately absent from the cache key: moving particles,
    // camera following and keeper bobbing must reuse the same tiny sprites.
    if (
      typeof document === 'undefined' ||
      !document.createElement ||
      (shape.fill && typeof shape.fill !== 'string') ||
      (shape.stroke && typeof shape.stroke !== 'string')
    )
      return null;
    const x =
      shape.kind === 'ellipse' ? shape.x - shape.rx : Math.min(...shape.points.map((p) => p.x));
    const y =
      shape.kind === 'ellipse' ? shape.y - shape.ry : Math.min(...shape.points.map((p) => p.y));
    const round = (n) => Math.round(n * 1000) / 1000;
    const local =
      shape.kind === 'ellipse'
        ? {
            ...shape,
            x: round(shape.rx),
            y: round(shape.ry),
            rx: round(shape.rx),
            ry: round(shape.ry),
          }
        : { ...shape, points: shape.points.map((p) => ({ x: round(p.x - x), y: round(p.y - y) })) };
    local.width = round(shape.width);
    const dpr = this.dpr || 1;
    const key = JSON.stringify([local, color, blur, dpr]);
    let entry = this.neonCache.get(key);
    if (entry) {
      this.neonStats.hits++;
      // LRU bounds remain enforced even for continuously changing geometry.
      this.neonCache.delete(key);
      this.neonCache.set(key, entry);
      return { entry, x, y };
    }
    const extentX =
      local.kind === 'ellipse' ? local.rx * 2 : Math.max(...local.points.map((p) => p.x));
    const extentY =
      local.kind === 'ellipse' ? local.ry * 2 : Math.max(...local.points.map((p) => p.y));
    const pad = Math.ceil(blur * 3.5 + local.width + 3);
    const width = Math.ceil((extentX + pad * 2) * dpr);
    const height = Math.ceil((extentY + pad * 2) * dpr);
    const pixels = width * height * 2;
    if (
      !Number.isFinite(pixels) ||
      width > 1536 ||
      height > 1536 ||
      pixels > this.neonPixelLimit / 2
    )
      return null;
    const layers = [];
    try {
      for (const factor of [1.75, 0.55]) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.setTransform(dpr, 0, 0, dpr, pad * dpr, pad * dpr);
        ctx.shadowColor = color;
        ctx.shadowBlur = blur * factor;
        this.paintNeonPrimitive(ctx, local);
        layers.push(canvas);
      }
    } catch {
      return null;
    }
    while (
      this.neonCache.size >= this.neonCacheLimit ||
      this.neonPixels + pixels > this.neonPixelLimit
    ) {
      const oldest = this.neonCache.keys().next().value;
      if (oldest === undefined) break;
      this.neonPixels -= this.neonCache.get(oldest).pixels;
      this.neonCache.delete(oldest);
    }
    entry = { layers, width: width / dpr, height: height / dpr, pad, pixels };
    this.neonCache.set(key, entry);
    this.neonPixels += pixels;
    this.neonStats.misses++;
    return { entry, x, y };
  }
  cachedDetail(key, x, y, bounds, paint) {
    const c = this.ctx;
    // These composed details use ordinary source-over at full opacity. Keep
    // caller-specific alpha/blend cases live rather than changing their meaning.
    if (
      this.quality !== 'high' ||
      typeof document === 'undefined' ||
      !document.createElement ||
      (typeof c.globalAlpha === 'number' && c.globalAlpha !== 1) ||
      (typeof c.globalCompositeOperation === 'string' &&
        c.globalCompositeOperation !== 'source-over')
    ) {
      paint();
      return;
    }
    const p = this.project(x, y),
      dpr = this.dpr || 1;
    const cacheKey = `detail:${key}:${this.s}:${dpr}`;
    let entry = this.neonCache.get(cacheKey);
    if (entry) {
      this.neonCache.delete(cacheKey);
      this.neonCache.set(cacheKey, entry);
      this.neonStats.hits++;
    } else {
      const width = Math.ceil(bounds[2] * dpr),
        height = Math.ceil(bounds[3] * dpr);
      const pixels = width * height;
      if (
        !Number.isFinite(pixels) ||
        width > 1536 ||
        height > 1536 ||
        pixels > this.neonPixelLimit / 2
      ) {
        paint();
        return;
      }
      let canvas, ctx;
      try {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext('2d');
      } catch {
        paint();
        return;
      }
      if (!ctx) {
        paint();
        return;
      }
      const cx = this.cx,
        cy = this.cy;
      try {
        this.ctx = ctx;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.cx -= p.x + bounds[0];
        this.cy -= p.y + bounds[1];
        paint();
      } finally {
        this.ctx = c;
        this.cx = cx;
        this.cy = cy;
      }
      while (
        this.neonCache.size >= this.neonCacheLimit ||
        this.neonPixels + pixels > this.neonPixelLimit
      ) {
        const oldest = this.neonCache.keys().next().value;
        if (oldest === undefined) break;
        this.neonPixels -= this.neonCache.get(oldest).pixels;
        this.neonCache.delete(oldest);
      }
      entry = { canvas, width: width / dpr, height: height / dpr, pixels };
      this.neonCache.set(cacheKey, entry);
      this.neonPixels += pixels;
      this.neonStats.misses++;
    }
    c.drawImage(entry.canvas, p.x + bounds[0], p.y + bounds[1], entry.width, entry.height);
  }
  neon(fn, color, blur = 16) {
    const c = this.ctx;
    c.save();
    try {
      if (this.quality !== 'high' || blur <= 0) {
        fn();
        return;
      }
      // Capture our simple primitives, then composite the original two glow passes.
      // Rare custom curves render crisply with their existing surrounding light pool;
      // no fallback ever restores expensive per-frame shadowBlur work.
      const previous = this.neonCapture;
      const shapes = [];
      this.neonCapture = shapes;
      try {
        fn();
      } finally {
        this.neonCapture = previous;
      }
      const sprites = shapes.map((shape) => this.cachedNeon(shape, color, blur));
      const alpha = typeof c.globalAlpha === 'number' ? c.globalAlpha : 1;
      c.shadowBlur = 0;
      for (let pass = 0; pass < 2; pass++) {
        c.globalAlpha = alpha * (pass === 0 ? 0.75 : 1);
        shapes.forEach((shape, i) => {
          const sprite = sprites[i];
          if (sprite) {
            const { entry, x, y } = sprite;
            c.drawImage(
              entry.layers[pass],
              x - entry.pad,
              y - entry.pad,
              entry.width,
              entry.height,
            );
          } else {
            if (pass === 0) this.neonStats.fallbacks++;
            this.paintNeonPrimitive(c, shape);
          }
        });
      }
    } finally {
      c.restore();
    }
  }
  burst(x, y, color, count = 24) {
    if (this.reduced) count = 5;
    for (let i = 0; i < count; i++)
      this.particles.push({
        x,
        y,
        z: 0.4,
        vx: (hash(i + this.particles.length, 9) - 0.5) * 2,
        vy: (hash(i + this.particles.length, 8) - 0.5) * 2,
        vz: hash(i, 7) * 2 + 0.3,
        life: 1.2 + hash(i, 4),
        max: 2,
        color,
      });
  }
  frame(g, t, dt, mode = 'playing') {
    this.resize();
    const c = this.ctx,
      w = this.width,
      h = this.height;
    t = this.reduced ? 0 : t;
    this.visualTime = t;
    if (this.lastGame !== g) {
      this.lastGame = g;
      this.restoration = 0;
      this.cameraReset = true;
      this.pops = {};
    }
    if (g.complete) this.restoration = Math.min(1, (this.restoration || 0) + dt * 0.55);
    this.currentLevel = g.level;
    this.currentPlayer = g.player;
    if (!this.pathCache.has(g.level)) this.pathCache.set(g.level, this.makePaths(g.level));
    this.paths = this.pathCache.get(g.level);
    for (const id of Object.keys(this.pops)) {
      this.pops[id] -= dt;
      if (this.pops[id] <= 0) delete this.pops[id];
    }
    this.biome = g.level.style ?? g.index;
    this.finished = g.complete;
    this.palette = g.level.palette;
    this.flourish = g.blooms.size / g.level.buds.length;
    this.background(g, t);
    const cells = [...g.level.floor, ...g.level.bridges.flatMap((b) => b.cells)];
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const [x, y] of cells) {
      minX = Math.min(minX, x - y - 1);
      maxX = Math.max(maxX, x - y + 1);
      minY = Math.min(minY, (x + y) * 0.5 - 1.8);
      maxY = Math.max(maxY, (x + y) * 0.5 + 2.6);
    }
    const mobile = w < 700 || matchMedia('(pointer: coarse)').matches;
    const landscape = mobile && w > h;
    const areaTop = (landscape ? 96 : mobile ? 128 : 116) + (this.safeTop || 0),
      areaBottom = (landscape ? 95 : mobile ? 180 : 100) + (this.safeBottom || 0);
    const fitScale = Math.max(
      12,
      Math.min(
        ((w - (mobile ? 30 : 150)) * (mode === 'title' && !mobile ? 0.66 : 1)) / (maxX - minX),
        (h - areaTop - areaBottom) / (maxY - minY),
        65,
      ),
    );
    this.s =
      mobile && !this.overview && mode !== 'title'
        ? Math.max(fitScale, Math.min(36, fitScale * 1.5))
        : fitScale;
    this.cx = w * 0.5 - (minX + maxX) * 0.5 * this.s;
    this.cy = areaTop + (h - areaTop - areaBottom) * 0.5 - (minY + maxY) * 0.5 * this.s;
    if (mobile && !this.overview && mode !== 'title') {
      const clamp = (v, min, max) =>
        min > max ? (min + max) * 0.5 : Math.max(min, Math.min(max, v));
      const desiredX = clamp(
          w * 0.5 - (g.player.x - g.player.y) * this.s,
          w - 16 - maxX * this.s,
          16 - minX * this.s,
        ),
        desiredY = clamp(
          areaTop + (h - areaTop - areaBottom) * 0.5 - (g.player.x + g.player.y) * this.s * 0.5,
          h - areaBottom - maxY * this.s,
          areaTop - minY * this.s,
        );
      const cameraKey = [g.index, w, h, this.s].join(':');
      if (this.cameraKey !== cameraKey || this.cameraReset || this.reduced) {
        this.cameraX = desiredX;
        this.cameraY = desiredY;
        this.cameraKey = cameraKey;
        this.cameraReset = false;
      } else {
        const ease = 1 - Math.exp(-dt * 6);
        this.cameraX += (desiredX - this.cameraX) * ease;
        this.cameraY += (desiredY - this.cameraY) * ease;
      }
      this.cx = this.cameraX;
      this.cy = this.cameraY;
    }
    if (mode === 'title') {
      if (!mobile) {
        this.s = Math.min(62, w * 0.047);
        const focus = g.level.sources[0];
        const fx = focus.x + 1,
          fy = focus.y - 0.5;
        this.cx = w * 0.74 - (fx - fy) * this.s;
        this.cy = h * 0.56 - (fx + fy) * this.s * 0.5;
      } else this.cx += w * 0.18;
    }
    const neonSignature = [this.s, this.dpr, this.quality].join(':');
    if (this.neonSignature !== neonSignature) {
      this.clearNeonCache();
      this.neonSignature = neonSignature;
    }
    c.save();
    if (this.shake > 0 && !this.reduced) {
      c.translate(Math.sin(t * 80) * this.shake, Math.cos(t * 67) * this.shake * 0.5);
      this.shake = Math.max(0, this.shake - dt * 15);
    }
    const cp = this.project(
      (g.level.spawn[0] + g.level.exit.x) * 0.5,
      (g.level.spawn[1] + g.level.exit.y) * 0.5,
    );
    this.glow(cp.x, cp.y, this.s * 8, g.level.palette[0] + '12');
    const sorted = [...g.level.floor].sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    const floorSet = new Set(g.level.floor.map((p) => p.join(',')));
    this.terrain(g, sorted, floorSet, t);
    for (const b of g.level.bridges) {
      const on = bridgeActive(g, b);
      for (const [x, y] of b.cells)
        this.tile(x, y, on ? (b.pair ? 'living' : 'bridge') : 'ghost', t, floorSet);
    }

    for (const source of g.level.sources) this.lightPool(source.x, source.y, gold, 1.4, 0.31);
    for (const relay of g.level.relays)
      if (g.relays.has(relay.id)) this.lightPool(relay.x, relay.y, cyan, 1.8, 0.38);
    for (const hz of g.level.hazards) {
      for (const [x, y] of hz.cells)
        this.hazard(x, y, hazardActive(g, hz), ((g.time + hz.offset) % hz.period) / hz.period, t);
    }
    // Thin energy channels make the architecture feel built rather than scattered.
    for (const r of g.level.relays) {
      const p = this.project(r.x, r.y, 0.015);
      const on = g.relays.has(r.id);
      for (const b of g.level.bridges.filter((b) => b.relay === r.id)) {
        const target = b.cells[0];
        const end = this.project(target[0] + 0.5, target[1] + 0.5, 0.015);
        this.neon(() => this.line(p, end, on ? cyan + 'b0' : '#7998b52b', on ? 2 : 1), cyan, 8);
      }
    }
    for (const m of g.level.mirrors) this.beam(g, m, t);
    const scenery = [
      [
        [1.25, 6.3, 'tree'],
        [12.7, 3.3, 'tree'],
        [5.6, 10.6, 'shrub'],
      ],
      [
        [1.25, 8.3, 'tree'],
        [7.25, 5.3, 'tree'],
        [15.7, 2.3, 'tree'],
        [10.65, 9.5, 'shrub'],
      ],
      [
        [1.25, 8.3, 'tree'],
        [3.3, 3.2, 'shrub'],
        [11.65, 3.2, 'tree'],
        [13.6, 10.7, 'shrub'],
      ],
      [
        [1.3, 10.3, 'tree'],
        [10.7, 13.5, 'tree'],
        [10.6, 3.3, 'tree'],
        [1.25, 2.3, 'tree'],
      ],
      [
        [1.3, 8.3, 'tree'],
        [5.7, 2.3, 'tree'],
        [13.7, 5.3, 'tree'],
      ],
      [
        [1.25, 10.3, 'tree'],
        [12.7, 10.3, 'tree'],
        [8.3, 3.3, 'tree'],
        [1.3, 2.3, 'tree'],
      ],
    ][g.index];
    const objects = scenery.map(([x, y, type]) => ({ x, y, type, seed: hash(x, y) }));
    const landmarks = [
      [0.35, 7.3, 'lotus'],
      [7.6, 5.15, 'arch'],
      [1.4, 8.3, 'bells'],
      [8.4, 3.1, 'observatory'],
      [3.5, 2.3, 'station'],
      [7.65, 7.35, 'hearttree'],
    ];
    const lm = landmarks[g.index];
    objects.push({ x: lm[0], y: lm[1], type: lm[2] });
    for (const [x, y] of sorted) {
      const n = hash(x, y);
      if (n > 0.35 && !this.occupied(g, x, y) && !floorSet.has(`${x - 1},${y}`))
        objects.push({ x: x + 0.14, y: y + 0.2, type: 'plant', seed: n });
      if (n > 0.9 && !this.occupied(g, x, y) && !floorSet.has(`${x},${y - 1}`))
        objects.push({ x: x + 0.7, y: y + 0.18, type: 'post' });
    }
    for (const o of g.level.chimes || []) objects.push({ ...o, type: 'chime' });
    for (const o of g.level.buds) objects.push({ ...o, type: 'bud' });
    for (const o of g.level.sources) objects.push({ ...o, type: 'source' });
    for (const o of g.level.relays) objects.push({ ...o, type: 'relay' });
    for (const o of g.level.mirrors) objects.push({ ...o, type: 'mirror' });
    objects.push({ ...g.level.exit, type: 'exit' });
    objects.push({ ...g.player, type: 'player' });
    g.level.wisps.forEach((p, i) => {
      if (!g.wisps.has(i)) objects.push({ x: p[0], y: p[1], type: 'wisp', seed: i });
    });
    objects.sort((a, b) => a.x + a.y - b.x - b.y);
    for (const o of objects) if (o.type !== 'wisp') this.object(g, o, t);
    for (const o of objects) if (o.type === 'wisp') this.object(g, o, t);
    this.keeperOutline(g, objects);
    this.ambientLife(g, t);
    if (g.complete) this.restorationLight(g, t);
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= 1.3 * dt;
      const pos = this.project(p.x, p.y, p.z);
      c.globalAlpha = Math.min(1, p.life);
      this.neon(() => this.ellipse(pos.x, pos.y, 2, 2, p.color), p.color, 8);
    }
    c.globalAlpha = 1;
    if (mode === 'playing') {
      const obj = interactable(g);
      if (obj) {
        const p = this.project(obj.x, obj.y, 1.28);
        const a = 0.65 + Math.sin(t * 4) * 0.12;
        c.globalAlpha = a;
        this.neon(
          () => {
            this.line({ x: p.x - 4, y: p.y - 4 }, { x: p.x, y: p.y }, gold, 2);
            this.line({ x: p.x, y: p.y }, { x: p.x + 4, y: p.y - 4 }, gold, 2);
          },
          gold,
          8,
        );
        c.globalAlpha = 1;
      }
    }
    c.restore();
    // Restrained film vignette; no flashing or full-screen post-processing.
    const vignette = c.createRadialGradient(
      w * 0.5,
      h * 0.5,
      h * 0.12,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.7,
    );
    vignette.addColorStop(0, '#010b1900');
    vignette.addColorStop(1, '#01071665');
    c.fillStyle = vignette;
    c.fillRect(0, 0, w, h);
  }
  lightPool(x, y, color, r = 1.4, opacity = 0.3) {
    const p = this.project(x, y, 0.02),
      c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'screen';
    c.globalAlpha = opacity;
    c.translate(p.x, p.y);
    c.scale(1, 0.52);
    this.glow(0, 0, this.s * r, color);
    c.restore();
  }
  aurora(t, g) {
    const c = this.ctx,
      w = this.width,
      h = this.height;
    c.save();
    c.globalCompositeOperation = 'screen';
    const drift = Math.sin(t * 0.07) * h * 0.025;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(-w * 0.1, h * (0.2 + i * 0.035) + drift);
      c.bezierCurveTo(
        w * 0.26,
        h * (-0.05 + i * 0.04),
        w * 0.56,
        h * (0.8 + i * 0.045),
        w * 1.1,
        h * (0.26 + i * 0.027) + drift,
      );
      c.strokeStyle = [
        g.level.palette[0] + '09',
        '#a3b5ff0b',
        '#c7b3ff08',
        g.level.palette[1] + '07',
      ][i];
      c.lineWidth = h * (0.05 + i * 0.025);
      if (this.quality === 'high') {
        c.shadowColor = g.level.palette[0];
        c.shadowBlur = 40;
      }
      c.stroke();
    }
    c.restore();
  }
  underislands(cells, set, t) {
    const c = this.ctx,
      s = this.s;
    for (const [x, y] of cells) {
      if (set.has(`${x},${y + 1}`) && set.has(`${x + 1},${y}`)) continue;
      const n = hash(x, y),
        p = this.project(x + 0.5, y + 0.5, -0.45);
      if (n > 0.3) {
        const drop = s * (0.8 + n * 1.6);
        this.path(
          [
            { x: p.x - s * 0.55, y: p.y },
            { x: p.x + s * 0.55, y: p.y },
            { x: p.x + s * 0.12, y: p.y + drop },
          ],
          '#172d3b',
        );
        this.path(
          [
            { x: p.x + s * 0.55, y: p.y },
            { x: p.x + s * 0.12, y: p.y + drop },
            { x: p.x + s * 0.08, y: p.y + s * 0.2 },
          ],
          '#24474b',
        );
        if (n > 0.68) {
          this.neon(
            () =>
              this.line(
                { x: p.x + s * 0.1, y: p.y + s * 0.35 },
                { x: p.x + s * 0.12, y: p.y + drop * 0.85 },
                this.palette[0] + '66',
                1,
              ),
            this.palette[0],
            8,
          );
        }
      }
      if (n > 0.48) {
        const root = this.project(x + 0.7, y + 0.88, -0.45);
        c.beginPath();
        c.moveTo(root.x, root.y);
        c.bezierCurveTo(
          root.x + s * 0.12,
          root.y + s * 0.5,
          root.x - s * 0.3,
          root.y + s * 0.9,
          root.x - s * 0.08,
          root.y + s * 1.5,
        );
        c.strokeStyle = '#608e7180';
        c.lineWidth = 2;
        c.stroke();
        for (let j = 0; j < 4; j++)
          this.ellipse(
            root.x + Math.sin(j * 2) * s * 0.1,
            root.y + s * (0.25 + j * 0.26),
            s * 0.045,
            s * 0.065,
            j % 2 ? '#5a9f7a' : '#83b281',
          );
      }
    }
  }
  groundlife(g, x, y, set, t) {
    const c = this.ctx,
      s = this.s,
      n = hash(x, y);
    c.save();
    this.path(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ].map(([dx, dy]) => this.project(x + dx, y + dy)),
      null,
    );
    c.clip();
    const edge =
      !set.has(`${x - 1},${y}`) ||
      !set.has(`${x},${y - 1}`) ||
      !set.has(`${x + 1},${y}`) ||
      !set.has(`${x},${y + 1}`);
    const paved = this.paths?.has(`${x},${y}`);
    for (let j = 0; j < (edge ? 5 : paved ? 0 : 3); j++) {
      const px = x + hash(x + j, y + 4),
        py = y + hash(x + j, y + 7),
        p = this.project(px, py, 0.01);
      this.ellipse(
        p.x,
        p.y,
        s * (0.1 + hash(x + j, y + 8) * 0.12),
        s * 0.065,
        ['#75ac6835', '#75a7aa24', '#a3aa6c3d', '#afa76a27'][this.biome],
      );
    }
    c.restore();
    if (edge) {
      for (let j = 0; j < 3; j++) {
        if (hash(x + j, y + 40) < 0.42) continue;
        const ax = x + 0.04 + j * 0.29 + (hash(x + j, y + 17) - 0.5) * 0.12;
        if (!set.has(`${x},${y + 1}`)) {
          const p = this.project(ax, y + 1, 0.015);
          this.ellipse(
            p.x,
            p.y,
            s * (0.15 + hash(x + j, y + 12) * 0.12),
            s * (0.045 + hash(x + j, y + 11) * 0.03),
            ['#4b8b6f', '#586c88', '#7f9567', '#7c8c67'][this.biome],
          );
        }
        if (!set.has(`${x + 1},${y}`)) {
          const p = this.project(x + 1, y + 0.04 + j * 0.29, 0.015);
          this.ellipse(
            p.x,
            p.y,
            s * (0.14 + hash(x + j, y + 15) * 0.1),
            s * (0.04 + hash(x + j, y + 13) * 0.035),
            ['#568f72', '#686f93', '#9aab73', '#8c956c'][this.biome],
          );
        }
      }
    }
    if (this.occupied(g, x, y)) return;
    for (let j = 0; j < (edge ? (n > 0.55 ? 9 : 1) : n > 0.86 ? 6 : 1); j++) {
      if (!edge && (n < 0.7 || paved)) continue;
      const px = x + 0.1 + hash(x + j, y + 2) * 0.8,
        py = y + 0.1 + hash(x + j, y + 3) * 0.8,
        p = this.project(px, py, 0.02);
      const ht = s * (0.07 + hash(x + j, y + 8) * 0.11);
      this.line(p, { x: p.x - ht * 0.35, y: p.y - ht }, '#81aa76a0', 1);
      this.line(p, { x: p.x + ht * 0.4, y: p.y - ht * 0.8 }, '#a1bc8599', 1);
      if (hash(x + j, y + 6) > 0.68) {
        const col = ['#f6b4c5', '#d7b8ff', '#ffc49e', '#fce9ac'][this.biome];
        this.ellipse(p.x, p.y - ht, s * 0.035, s * 0.027, col);
        this.ellipse(p.x - s * 0.03, p.y - ht * 0.9, s * 0.025, s * 0.023, col);
        if (g.index === 2) {
          this.ellipse(p.x + s * 0.032, p.y - ht * 0.86, s * 0.025, s * 0.021, '#e9bf86');
          this.ellipse(p.x, p.y - ht * 0.84, s * 0.015, s * 0.012, '#ffe5ac');
        }
      }
    }
  }
  tree(o, t) {
    const c = this.ctx,
      s = this.s,
      small = o.type === 'shrub',
      height = small ? 0.5 : this.biome === 2 ? 1.85 : 2.15,
      p = this.project(o.x, o.y),
      top = this.project(o.x, o.y, height);
    const colors = [
      ['#3f9675', '#77c88e', '#b1e7a5'],
      ['#9374b1', '#c0a3d9', '#f2c9df'],
      ['#9b8052', '#d2b172', '#f3d99d'],
      ['#558b88', '#8fc4a8', '#d1e3ad'],
    ][this.biome || 0];
    c.save();
    this.ellipse(p.x, p.y, s * 0.43, s * 0.15, '#081e2860');
    c.strokeStyle = '#688579';
    c.lineWidth = small ? 2 : s * 0.1;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.bezierCurveTo(p.x - s * 0.1, p.y - s * 0.5, top.x + s * 0.12, top.y + s * 0.3, top.x, top.y);
    c.stroke();
    if (!small) {
      this.line(
        { x: p.x, y: p.y - s * 0.5 },
        { x: p.x - s * 0.32, y: p.y - s },
        '#688579',
        s * 0.055,
      );
      this.line(
        { x: p.x, y: p.y - s * 0.68 },
        { x: p.x + s * 0.34, y: p.y - s * 1.2 },
        '#688579',
        s * 0.045,
      );
    }
    const size = small ? 0.28 : this.biome === 2 ? 1.12 : 0.88;
    // Prune visual density where a canopy would conceal the keeper or a useful landmark.
    const important = [this.currentPlayer, ...this.currentLevel.sources, this.currentLevel.exit];
    const obscures =
      !small &&
      important.some((target) => {
        const q = this.project(target.x, target.y, 0.5);
        return Math.abs(q.x - top.x) < s * size * 1.15 && Math.abs(q.y - top.y) < s * size * 0.72;
      });
    c.globalAlpha = obscures ? 0.48 : 1;
    for (let j = 0; j < 14; j++) {
      const ang = j * 2.4,
        rad = 0.3 + hash(j, o.y) * 0.5,
        cx = top.x + Math.cos(ang) * s * size * rad,
        cy = top.y + Math.sin(ang) * s * size * rad * 0.53 + j * 0.15,
        rx = s * size * (0.38 + hash(j, o.x) * 0.28),
        ry = rx * (this.biome === 2 ? 0.43 : 0.62);
      const shade = c.createRadialGradient(cx - rx * 0.35, cy - ry * 0.45, 0, cx, cy, rx);
      shade.addColorStop(0, colors[2]);
      shade.addColorStop(0.65, colors[1]);
      shade.addColorStop(1, colors[0]);
      this.ellipse(cx, cy, rx, ry, shade);
    }
    if (!small && this.biome === 1) {
      // Soft wisteria curtains give the prism orchard and reclaimed station a drooping silhouette.
      for (let j = 0; j < 9; j++) {
        const x = top.x + (j - 4) * s * 0.16;
        const y = top.y + s * (0.15 + hash(j, o.x) * 0.2);
        const length = s * (0.28 + hash(j, o.y) * 0.48);
        this.line({ x, y }, { x: x + s * 0.035, y: y + length }, '#987fac99', 1);
        for (let k = 0; k < 4; k++)
          this.ellipse(
            x + Math.sin(k * 2 + j) * s * 0.026,
            y + (length * k) / 4,
            s * 0.054,
            s * 0.095,
            k === 3 ? '#dfb9d5' : '#ab8dbf',
          );
      }
    }
    for (let j = 0; j < 7; j++) {
      const a = j * 2.4,
        px = top.x + Math.cos(a) * s * size * 0.9,
        py = top.y + Math.sin(a) * s * size * 0.6;
      this.ellipse(px, py, s * 0.035, s * 0.024, this.biome === 1 ? '#ffdbda' : '#f9e4ad');
    }
    if (!small) {
      const lamp = { x: top.x + s * 0.36, y: top.y + s * 0.45 };
      this.line({ x: lamp.x, y: lamp.y - s * 0.23 }, lamp, '#bfc78990', 1);
      this.glow(lamp.x, lamp.y, s * 0.55, gold + '48');
      this.neon(() => this.ellipse(lamp.x, lamp.y, s * 0.045, s * 0.07, '#fff0c2'), gold, 13);
    }
    c.restore();
  }
  ambientLife(g, t) {
    const c = this.ctx,
      s = this.s;
    for (let i = 0; i < 20; i++) {
      const cell = g.level.floor[Math.floor(hash(i, 17) * g.level.floor.length)];
      const x = cell[0] + 0.5 + Math.sin(t * 0.4 + i) * 0.23,
        y = cell[1] + 0.5 + Math.cos(t * 0.3 + i * 2) * 0.23,
        p = this.project(x, y, 0.35 + hash(i, 5) * 0.9);
      const a = 0.22 + (Math.sin(t * 1.3 + i * 3) + 1) * 0.24;
      c.save();
      c.globalAlpha = a;
      this.glow(p.x, p.y, s * 0.2, '#ffe0a850');
      this.neon(() => this.ellipse(p.x, p.y, 1.2, 1.2, '#ffedb0'), gold, 8);
      c.restore();
    }
  }
  gardenArchitecture(g, t) {
    const c = this.ctx,
      s = this.s;
    const sources = g.level.sources;
    for (const o of sources) {
      const p = this.project(o.x, o.y, 0.015);
      c.save();
      c.strokeStyle = '#c7d6a648';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(p.x, p.y, s * 0.58, s * 0.29, 0, 0, TAU);
      c.stroke();
      for (let j = 0; j < 8; j++) {
        const a = (j * TAU) / 8;
        this.ellipse(
          p.x + Math.cos(a) * s * 0.58,
          p.y + Math.sin(a) * s * 0.29,
          s * 0.025,
          s * 0.015,
          '#dee4b577',
        );
      }
      c.restore();
    }
    // Each garden has its own small crafted landmark, kept behind the playable routes.
    if (g.index === 0) {
      const a = this.project(2.2, 6.08, 0.08),
        b = this.project(4.1, 6.08, 0.08);
      this.line(a, b, '#8fa78a', s * 0.065);
      for (let i = 0; i < 6; i++) {
        const p = this.project(2.2 + i * 0.38, 6.08, 0.08);
        this.line(p, { x: p.x, y: p.y - s * 0.2 }, '#88a48c', s * 0.035);
      }
    }
    if (g.index === 1) {
      for (const m of g.level.mirrors) {
        const p = this.project(m.x, m.y, 0.02);
        c.save();
        c.strokeStyle = '#cfb8ed65';
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(p.x, p.y, s * 0.45, s * 0.22, 0, 0, TAU);
        c.stroke();
        c.restore();
      }
    }
    if (g.index === 2) {
      for (const [x, y] of [
        [1.6, 10.8],
        [4.8, 3.6],
        [12.8, 10.1],
      ]) {
        const p = this.project(x, y, 0.012);
        this.ellipse(p.x, p.y, s * 0.35, s * 0.13, '#67b6b22b');
        c.strokeStyle = '#a4e6d551';
        c.lineWidth = 0.8;
        c.beginPath();
        c.ellipse(p.x, p.y, s * 0.26, s * 0.1, 0, 0, TAU);
        c.stroke();
      }
    }
    if (g.index === 3) {
      const p = this.project(2.8, 5.2, 0.02);
      c.strokeStyle = '#d4c59155';
      c.lineWidth = 1.3;
      for (let i = 0; i < 2; i++) {
        c.beginPath();
        c.ellipse(p.x, p.y, s * (0.8 + i * 0.3), s * (0.4 + i * 0.15), 0, 0, TAU);
        c.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        this.line(
          { x: p.x + Math.cos(a) * s * 0.9, y: p.y + Math.sin(a) * s * 0.45 },
          { x: p.x + Math.cos(a) * s * 1.06, y: p.y + Math.sin(a) * s * 0.53 },
          '#dfc28b88',
          1,
        );
      }
    }
  }
  landmark(o, t) {
    const c = this.ctx,
      s = this.s,
      p = this.project(o.x, o.y);
    c.save();
    if (o.type === 'lotus') {
      this.ellipse(p.x, p.y + s * 0.04, s * 1.03, s * 0.51, '#243e4b');
      this.ellipse(p.x, p.y, s * 0.94, s * 0.45, '#24757a');
      this.ellipse(p.x, p.y - s * 0.02, s * 0.8, s * 0.37, '#1b5a6d');
      c.strokeStyle = '#9ae2c073';
      c.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.ellipse(p.x, p.y, s * (0.55 + i * 0.13), s * (0.22 + i * 0.06), 0, 0, TAU);
        c.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const a = i * 2.1,
          q = { x: p.x + Math.cos(a) * s * 0.65, y: p.y + Math.sin(a) * s * 0.25 };
        this.ellipse(q.x, q.y, s * 0.2, s * 0.1, i % 2 ? '#88bb7c' : '#61a782');
        this.line(q, { x: q.x + s * 0.18, y: q.y }, '#d5dfa680', 1);
      }
      const flower = { x: p.x, y: p.y - s * 0.48 };
      this.glow(flower.x, flower.y, s * 1.8, '#ffb7b552');
      this.glow(flower.x, flower.y, s * 0.7, '#ffe7c283');
      this.line({ x: p.x, y: p.y }, flower, '#a2c89d', s * 0.05);
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        c.save();
        c.translate(flower.x, flower.y);
        c.scale(1, 0.62);
        c.rotate(a);
        const petal = c.createLinearGradient(0, 0, 0, -s * 0.63);
        petal.addColorStop(0, '#f0a8af');
        petal.addColorStop(0.6, i % 2 ? '#ffd7cf' : '#ffe8d3');
        petal.addColorStop(1, '#fff5d8');
        this.neon(
          () => {
            c.beginPath();
            c.moveTo(0, s * 0.04);
            c.bezierCurveTo(-s * 0.24, -s * 0.2, -s * 0.12, -s * 0.47, 0, -s * 0.65);
            c.bezierCurveTo(s * 0.17, -s * 0.43, s * 0.24, -s * 0.13, 0, s * 0.04);
            c.fillStyle = petal;
            c.fill();
          },
          '#ffbba8',
          8,
        );
        this.line({ x: 0, y: -s * 0.08 }, { x: 0, y: -s * 0.5 }, '#fff7dc55', 0.8);
        c.restore();
      }
      this.neon(
        () => this.ellipse(flower.x, flower.y - s * 0.05, s * 0.11, s * 0.15, '#fff6c9'),
        gold,
        24,
      );
    }
    if (o.type === 'arch' || o.type === 'station') {
      const a = this.project(o.x - 0.75, o.y),
        b = this.project(o.x + 0.75, o.y),
        top = this.project(o.x, o.y, 2.25);
      this.pillar(o.x - 0.75, o.y, 1.75, '#698c88');
      this.pillar(o.x + 0.75, o.y, 1.75, '#78988d');
      c.strokeStyle = '#9aafa0';
      c.lineWidth = s * 0.18;
      c.beginPath();
      c.moveTo(a.x, a.y - s * 1.6);
      c.bezierCurveTo(a.x, top.y - s * 0.5, b.x, top.y - s * 0.5, b.x, b.y - s * 1.6);
      c.stroke();
      c.strokeStyle = '#b1d1b070';
      c.lineWidth = s * 0.035;
      c.beginPath();
      c.moveTo(a.x, a.y - s * 1.6);
      c.bezierCurveTo(a.x, top.y - s * 0.45, b.x, top.y - s * 0.45, b.x, b.y - s * 1.6);
      c.stroke();
      for (let i = 0; i < 12; i++) {
        const f = i / 11,
          q = {
            x: a.x + (b.x - a.x) * f,
            y: top.y - s * 0.23 + Math.sin(f * Math.PI) * s * 0.23 + f * s * 0.3,
          };
        this.ellipse(q.x, q.y, s * 0.09, s * 0.045, i % 3 ? '#699e89' : '#b6c5a0');
        if (i % 3 === 0) {
          this.glow(q.x, q.y, s * 0.26, '#eab8e63a');
          this.ellipse(q.x, q.y + s * 0.08, s * 0.036, s * 0.06, '#f2c4e9');
        }
      }
    }
    if (o.type === 'station') {
      const q = this.project(o.x, o.y, 2.35);
      this.ellipse(q.x, q.y, s * 0.32, s * 0.32, '#d7d0aa');
      this.ellipse(q.x, q.y, s * 0.27, s * 0.27, '#345260');
      c.strokeStyle = '#e6ddba';
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(q.x, q.y, s * 0.23, 0, TAU);
      c.stroke();
      this.line(q, { x: q.x + s * 0.13, y: q.y - s * 0.07 }, '#ffe5b9', 1.5);
      this.line(q, { x: q.x, y: q.y - s * 0.18 }, '#ffe5b9', 1.5);
      this.glow(q.x, q.y, s * 0.65, '#ffdeb433');
      // A low slatted bench and a weathered platform sign tell the station's story.
      for (let j = 0; j < 3; j++) {
        const a = this.project(o.x - 1.05, o.y + 1.4 + j * 0.11, 0.3);
        const b = this.project(o.x - 0.15, o.y + 1.4 + j * 0.11, 0.3);
        this.line(a, b, j === 0 ? '#b49f7b' : '#7e8f79', s * 0.065);
      }
      for (const dx of [-0.93, -0.25]) {
        this.line(
          this.project(o.x + dx, o.y + 1.5, 0.3),
          this.project(o.x + dx, o.y + 1.5, 0.04),
          '#465e60',
          s * 0.06,
        );
        this.line(
          this.project(o.x + dx, o.y + 1.4, 0.3),
          this.project(o.x + dx, o.y + 1.4, 0.65),
          '#6e8478',
          s * 0.05,
        );
      }
      this.line(
        this.project(o.x - 1.06, o.y + 1.4, 0.59),
        this.project(o.x - 0.13, o.y + 1.4, 0.59),
        '#b3a280',
        s * 0.1,
      );
      const sign = this.project(o.x + 0.65, o.y - 0.05, 1.3);
      this.path(
        [
          { x: sign.x - s * 0.25, y: sign.y - s * 0.15 },
          { x: sign.x + s * 0.25, y: sign.y - s * 0.15 },
          { x: sign.x + s * 0.25, y: sign.y + s * 0.1 },
          { x: sign.x - s * 0.25, y: sign.y + s * 0.1 },
        ],
        '#345963',
        '#adc4a077',
        1,
      );
      this.line(
        { x: sign.x - s * 0.13, y: sign.y - s * 0.025 },
        { x: sign.x + s * 0.12, y: sign.y - s * 0.025 },
        '#d7d1a8',
        1.2,
      );
    }
    if (o.type === 'hearttree') {
      c.save();
      c.translate(p.x, p.y);
      c.scale(1.55, 1.55);
      c.translate(-p.x, -p.y);
      // Gnarled exposed roots give this old tree a weight unlike the orchard saplings.
      for (let j = 0; j < 5; j++) {
        const angle = j * 1.5;
        const end = { x: p.x + Math.cos(angle) * s * 0.55, y: p.y + Math.sin(angle) * s * 0.2 };
        c.beginPath();
        c.moveTo(p.x, p.y - s * 0.7);
        c.bezierCurveTo(
          p.x + Math.cos(angle) * s * 0.13,
          p.y - s * 0.25,
          end.x * 0.3 + p.x * 0.7,
          end.y,
          end.x,
          end.y,
        );
        c.strokeStyle = j % 2 ? '#728d78' : '#486d62';
        c.lineWidth = s * (0.11 - j * 0.009);
        c.stroke();
      }
      this.tree({ ...o, type: 'tree' }, t);
      c.restore();
      if (this.finished) {
        const side = Math.max(s * 3, s * 1.35 + 68) + 3;
        const upper = Math.max(s * 6.25, s * 3.8 + 68) + 3;
        const lower = Math.max(-s * 0.25, -s * 2.7 + 68) + 3;
        this.cachedDetail('heart-crown', o.x, o.y, [-side, -upper, side * 2, upper + lower], () =>
          this.paintCrown(o),
        );
      }
    }
    if (o.type === 'bells') {
      for (let i = 0; i < 3; i++) {
        const q = this.project(o.x + i * 0.3, o.y + i * 0.18, 1.1 + i * 0.3),
          base = this.project(o.x + i * 0.3, o.y + i * 0.18);
        c.strokeStyle = '#84a477';
        c.lineWidth = s * 0.035;
        c.beginPath();
        c.moveTo(base.x, base.y);
        c.bezierCurveTo(base.x - s * 0.3, q.y - s * 0.3, q.x + s * 0.35, q.y - s * 0.15, q.x, q.y);
        c.stroke();
        this.path(
          [
            { x: q.x - s * 0.12, y: q.y - s * 0.15 },
            { x: q.x + s * 0.12, y: q.y - s * 0.15 },
            { x: q.x + s * 0.22, y: q.y + s * 0.12 },
            { x: q.x - s * 0.22, y: q.y + s * 0.12 },
          ],
          i === 1 ? '#ffe4a4' : '#eec17b',
        );
        this.neon(() => this.ellipse(q.x, q.y + s * 0.12, s * 0.22, s * 0.07, '#fff0b3'), gold, 16);
        this.glow(q.x, q.y, s * 0.75, '#ffce5e39');
      }
    }
    if (o.type === 'observatory') {
      const q = this.project(o.x, o.y, 1.65);
      this.pillar(o.x - 0.55, o.y, 0.8, '#708c91');
      this.pillar(o.x + 0.55, o.y, 0.8, '#708c91');
      c.save();
      c.translate(q.x, q.y);
      c.rotate(-0.23);
      c.strokeStyle = '#b1ba9a';
      c.lineWidth = s * 0.105;
      c.beginPath();
      c.ellipse(0, 0, s * 0.9, s * 1.12, 0, -0.25, Math.PI * 1.52);
      c.stroke();
      c.strokeStyle = '#e4d39b';
      c.lineWidth = s * 0.025;
      this.neon(
        () => {
          c.beginPath();
          c.ellipse(0, 0, s * 0.76, s * 0.98, 0, 0, TAU);
          c.stroke();
        },
        gold,
        10,
      );
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        this.line(
          { x: Math.cos(a) * s * 0.73, y: Math.sin(a) * s * 0.94 },
          { x: Math.cos(a) * s * 0.83, y: Math.sin(a) * s * 1.05 },
          '#e1d3a699',
          1,
        );
      }
      c.restore();
      this.glow(q.x, q.y, s * 1.3, '#b0c8ff28');
      this.neon(() => this.ellipse(q.x, q.y, s * 0.11, s * 0.11, '#dff9f0'), cyan, 25);
      this.line({ x: q.x - s * 0.42, y: q.y }, { x: q.x + s * 0.42, y: q.y }, '#b6d2c286', 1);
      this.line({ x: q.x, y: q.y - s * 0.4 }, { x: q.x, y: q.y + s * 0.4 }, '#b6d2c286', 1);
    }
    c.restore();
  }
  paintCrown(o) {
    const s = this.s;
    const crown = this.project(o.x, o.y, 3.25);
    this.glow(crown.x, crown.y, s * 3, '#ffebaa55');
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4,
        q = {
          x: crown.x + Math.cos(a) * s * (0.3 + hash(i, 1)),
          y: crown.y + Math.sin(a) * s * 0.55,
        };
      this.neon(() => this.ellipse(q.x, q.y, s * 0.055, s * 0.045, '#fff4c7'), gold, 18);
    }
  }
  flower(g, o, t) {
    const s = this.s,
      on = g.blooms.has(o.id);
    // Screen-blended pools depend on the ground beneath them and stay separate.
    if (on) this.lightPool(o.x, o.y, '#ffe5a4', 1, 0.25);
    const pad = 76 + s * 0.2;
    this.cachedDetail(
      `flower:${this.biome}:${on}`,
      o.x,
      o.y,
      [-pad, -pad - s * 0.65, pad * 2, pad * 2 + s * 0.65],
      () => this.paintFlower(g, o),
    );
  }
  paintFlower(g, o) {
    const c = this.ctx,
      s = this.s,
      on = g.blooms.has(o.id),
      p = this.project(o.x, o.y),
      top = this.project(o.x, o.y, on ? 0.65 : 0.37);
    this.ellipse(p.x, p.y, s * 0.27, s * 0.13, '#77a87955');
    this.line(p, top, '#a2c88a', s * 0.04);
    for (let i = 0; i < 3; i++) {
      const leaf = this.project(o.x + (i - 1) * 0.13, o.y, 0.12 + i * 0.055);
      this.ellipse(
        leaf.x + (i % 2 ? 1 : -1) * s * 0.12,
        leaf.y,
        s * 0.13,
        s * 0.047,
        i % 2 ? '#87bd91' : '#aad09a',
      );
    }
    if (on) {
      this.glow(top.x, top.y, s * 0.95, '#ffdd9859');
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        this.neon(
          () =>
            this.ellipse(
              top.x + Math.cos(a) * s * 0.12,
              top.y + Math.sin(a) * s * 0.09,
              s * 0.12,
              s * 0.078,
              ['#ffcfba', '#e5caff', '#ffe2a7', '#cdf4d7'][this.biome],
            ),
          gold,
          8,
        );
      }
      this.neon(() => this.ellipse(top.x, top.y, s * 0.062, s * 0.062, '#fff8d3'), gold, 18);
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4,
          q = this.project(o.x + Math.cos(a) * 0.32, o.y + Math.sin(a) * 0.32, 0.1);
        this.ellipse(q.x, q.y, s * 0.028, s * 0.021, '#f6e2af');
      }
    } else {
      this.path(
        [
          { x: top.x, y: top.y - s * 0.13 },
          { x: top.x + s * 0.09, y: top.y },
          { x: top.x, y: top.y + s * 0.085 },
          { x: top.x - s * 0.09, y: top.y },
        ],
        '#bdcad0',
        '#e8eee5',
        1,
      );
      if (g.player.carrying) this.glow(top.x, top.y, s * 0.55, '#ffe3ac35');
    }
  }
  keeperOutline(g, objects) {
    const p = g.player;
    const hidden = objects.some(
      (o) =>
        ['tree', 'shrub', 'arch', 'observatory', 'relay'].includes(o.type) &&
        Math.hypot(o.x - p.x, o.y - p.y) < 1.05 &&
        o.x + o.y > p.x + p.y,
    );
    if (!hidden) return;
    const c = this.ctx,
      s = Math.max(30, this.s),
      q = this.project(p.x, p.y);
    c.save();
    c.globalAlpha = 0.55;
    c.strokeStyle = '#ffe6b9';
    c.lineWidth = 1.3;
    this.neon(
      () => {
        c.beginPath();
        c.ellipse(q.x, q.y - s * 0.51, s * 0.175, s * 0.19, 0, 0, TAU);
        c.stroke();
      },
      gold,
      8,
    );
    c.restore();
  }
  chime(g, o, t) {
    const c = this.ctx,
      s = this.s,
      p = this.project(o.x, o.y),
      pair = g.level.pairs.find((p) => p.id === o.pair),
      on = g.chimes.has(o.id),
      all = pairActive(g, o.pair);
    this.ellipse(p.x, p.y, s * 0.29, s * 0.13, '#3e746477');
    this.line(
      { x: p.x - s * 0.21, y: p.y },
      { x: p.x - s * 0.21, y: p.y - s * 0.95 },
      '#a1b9a0',
      s * 0.06,
    );
    this.line(
      { x: p.x - s * 0.21, y: p.y - s * 0.95 },
      { x: p.x + s * 0.22, y: p.y - s * 0.95 },
      '#a1b9a0',
      s * 0.055,
    );
    const q = { x: p.x, y: p.y - s * 0.69 };
    this.line({ x: q.x, y: q.y - s * 0.26 }, q, '#cbd4b2', 1);
    this.neon(
      () =>
        this.path(
          [
            { x: q.x - s * 0.08, y: q.y - s * 0.1 },
            { x: q.x + s * 0.08, y: q.y - s * 0.1 },
            { x: q.x + s * 0.15, y: q.y + s * 0.15 },
            { x: q.x - s * 0.15, y: q.y + s * 0.15 },
          ],
          on ? pair.color : '#789994',
          on ? '#fff3ca' : '#a1b8ab',
          1,
        ),
      pair.color,
      on ? 17 : 0,
    );
    this.ellipse(q.x, q.y + s * 0.2, s * 0.04, s * 0.035, on ? '#fff1bd' : '#95b3ab');
    if (on) this.glow(q.x, q.y, s * 0.85, pair.color + '55');
    const sign = { x: p.x + s * 0.28, y: p.y - s * 0.82 };
    this.symbol(pair.symbol, sign.x, sign.y, s * 0.14, pair.color);
    for (let i = 0; i < 2; i++)
      this.ellipse(
        p.x + (i - 0.5) * s * 0.12,
        p.y - s * 0.1,
        s * 0.027,
        s * 0.027,
        i < g.level.chimes.filter((ch) => ch.pair === o.pair && g.chimes.has(ch.id)).length
          ? pair.color
          : '#5a7479',
      );
    if (all) this.lightPool(o.x, o.y, pair.color, 1.1, 0.3);
  }
  symbol(type, x, y, r, color) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = color;
    c.lineWidth = 1.4;
    if (type === 'leaf') {
      c.beginPath();
      c.moveTo(x - r, y + r);
      c.bezierCurveTo(x - r * 1.2, y - r, x + r, y - r * 1.2, x + r, y - r);
      c.bezierCurveTo(x + r * 1.1, y + r, x - r * 0.5, y + r * 1.1, x - r, y + r);
      c.stroke();
      this.line({ x: x - r, y: y + r }, { x: x + r, y: y - r }, color, 1);
    } else if (type === 'sun') {
      c.beginPath();
      c.arc(x, y, r * 0.55, 0, TAU);
      c.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        this.line(
          { x: x + Math.cos(a) * r * 0.8, y: y + Math.sin(a) * r * 0.8 },
          { x: x + Math.cos(a) * r * 1.2, y: y + Math.sin(a) * r * 1.2 },
          color,
          1,
        );
      }
    } else {
      c.beginPath();
      c.arc(x, y, r, -1.2, 1.8);
      c.arc(x + r * 0.38, y - r * 0.28, r * 0.8, 1.8, -1.2, true);
      c.stroke();
    }
    c.restore();
  }
  background(g, t) {
    const key = [g.index, this.width, this.height, this.dpr, this.quality].join(':');
    if (typeof document === 'undefined' || !document.createElement) {
      this.paintBackground(g, t);
      return;
    }
    if (this.backgroundKey !== key) {
      this.backgroundLayer = this.makeLayer(() => this.paintBackground(g, 0));
      this.backgroundKey = key;
    }
    this.ctx.drawImage(this.backgroundLayer, 0, 0, this.width, this.height);
  }
  terrain(g, sorted, set, t) {
    const paint = () => {
      this.underislands(sorted, set, 0);
      for (const [x, y] of sorted) this.tile(x, y, 'floor', 0, set);
      for (const [x, y] of sorted) this.groundlife(g, x, y, set, 0);
      this.gardenArchitecture(g, 0);
    };
    const key = [g.index, this.dpr, this.s, this.quality].join(':');
    if (typeof document === 'undefined' || !document.createElement) {
      paint();
      return;
    }
    if (this.terrainKey !== key) {
      const s = this.s,
        minX = Math.min(...sorted.map(([x, y]) => (x - y - 1) * s)) - 4,
        maxX = Math.max(...sorted.map(([x, y]) => (x - y + 1) * s)) + 4,
        minY = Math.min(...sorted.map(([x, y]) => (x + y) * s * 0.5 - s * 0.3)) - 4,
        maxY = Math.max(...sorted.map(([x, y]) => (x + y) * s * 0.5 + s * 3.6)) + 4;
      const width = maxX - minX,
        height = maxY - minY,
        canvas = document.createElement('canvas');
      canvas.width = Math.ceil(width * this.dpr);
      canvas.height = Math.ceil(height * this.dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const original = this.ctx,
        cx = this.cx,
        cy = this.cy;
      this.ctx = ctx;
      this.cx = -minX;
      this.cy = -minY;
      try {
        paint();
      } finally {
        this.ctx = original;
        this.cx = cx;
        this.cy = cy;
      }
      this.terrainLayer = { canvas, width, height, originX: -minX, originY: -minY };
      this.terrainKey = key;
    }
    const layer = this.terrainLayer;
    this.ctx.drawImage(
      layer.canvas,
      this.cx - layer.originX,
      this.cy - layer.originY,
      layer.width,
      layer.height,
    );
  }
  makeLayer(paint) {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const original = this.ctx;
    this.ctx = ctx;
    try {
      paint();
    } finally {
      this.ctx = original;
    }
    return canvas;
  }
  makePaths(level) {
    const cells = [...level.floor, ...level.bridges.flatMap((b) => b.cells)],
      allowed = new Set(cells.map((p) => p.join(','))),
      start = `${Math.floor(level.spawn[0])},${Math.floor(level.spawn[1])}`,
      paths = new Set([start]);
    for (const goal of [
      ...level.sources,
      ...level.relays,
      ...level.mirrors,
      ...(level.chimes || []),
      level.exit,
    ]) {
      const target = `${Math.floor(goal.x)},${Math.floor(goal.y)}`,
        queue = [start],
        came = new Map([[start, null]]);
      for (let head = 0; head < queue.length && !came.has(target); head++) {
        const k = queue[head],
          [x, y] = k.split(',').map(Number);
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ]) {
          const n = `${x + dx},${y + dy}`;
          if (allowed.has(n) && !came.has(n)) {
            came.set(n, k);
            queue.push(n);
          }
        }
      }
      if (came.has(target)) for (let at = target; at; at = came.get(at)) paths.add(at);
    }
    return paths;
  }
  paving(x, y) {
    const c = this.ctx,
      s = this.s,
      n = hash(x, y),
      inset = 0.025 + n * 0.025;
    // Broad, irregular flagstones share a route without repeating a checkerboard stamp.
    const points = [
      [inset + hash(x, y + 31) * 0.08, inset],
      [0.68 + hash(x, y + 32) * 0.24, inset + 0.015],
      [0.97, 0.12 + hash(x, y + 33) * 0.1],
      [0.94 + n * 0.025, 0.75 + hash(x, y + 34) * 0.14],
      [0.78 + n * 0.08, 0.98],
      [0.12 + hash(x, y + 35) * 0.08, 0.96],
      [0.025, 0.79 + n * 0.06],
      [0.035, 0.19 + hash(x, y + 36) * 0.18],
    ].map(([dx, dy]) => this.project(x + dx, y + dy, 0.016));
    const center = this.project(x + 0.5, y + 0.5, 0.016),
      warm = this.currentLevel.sources.some((o) => Math.hypot(o.x - x - 0.5, o.y - y - 0.5) < 1.8);
    const tones = [
      ['#607f78', '#829b88'],
      ['#687984', '#9ba8a3'],
      ['#6e8379', '#a4b395'],
      ['#737f7d', '#a8b5a3'],
    ][this.biome];
    const grad = c.createLinearGradient(
      center.x - s * 0.4,
      center.y - s * 0.25,
      center.x + s * 0.4,
      center.y + s * 0.25,
    );
    grad.addColorStop(0, warm ? '#a09b79' : tones[1]);
    grad.addColorStop(1, tones[0]);
    this.path(points, grad, warm ? '#c8bf8e55' : '#bec7b02e', 0.7);
    if (n > 0.62) {
      const a = this.project(x + 0.6, y + 0.03, 0.02),
        b = this.project(x + 0.43, y + 0.39, 0.02),
        end = this.project(x + 0.53, y + 0.63, 0.02);
      this.line(a, b, '#30473f66', 0.8);
      this.line(b, end, '#30473f55', 0.8);
      this.line(b, this.project(x + 0.26, y + 0.48, 0.02), '#30473f44', 0.65);
    }
    if (n < 0.4) {
      const moss = this.project(x + 0.08, y + 0.38, 0.023);
      this.ellipse(moss.x, moss.y, s * 0.12, s * 0.045, '#74907377');
    }
    const chip = this.project(x + 0.18, y + 0.76, 0.023);
    this.ellipse(chip.x, chip.y, s * 0.045, s * 0.019, '#c2ccae33');
  }
  restorationLight(g, t) {
    const c = this.ctx,
      s = this.s,
      a = this.reduced ? 1 : this.restoration;
    const nodes = g.level.relays.map((r) => this.project(r.x, r.y, 2.1));
    c.save();
    c.globalCompositeOperation = 'screen';
    c.globalAlpha = a * 0.7;
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i],
        r = g.level.relays[i],
        base = this.project(r.x, r.y, 0.8);
      const beam = c.createLinearGradient(p.x, p.y - s * 2, p.x, base.y);
      beam.addColorStop(0, '#b7ffe300');
      beam.addColorStop(0.75, '#b7ffe320');
      beam.addColorStop(1, '#f3ffdd77');
      c.fillStyle = beam;
      c.fillRect(p.x - s * 0.045, p.y - s * 2, s * 0.09, base.y - p.y + s * 2);
      this.glow(p.x, p.y, s * 0.8, gold + '33');
      this.neon(() => this.ellipse(p.x, p.y, 3, 3, '#ffefc7'), gold, 18);
      if (i > 0) this.neon(() => this.line(nodes[i - 1], p, gold + 'aa', 1), gold, 9);
    }
    if (nodes.length > 2) this.line(nodes.at(-1), nodes[0], gold + '66', 1);
    const exit = this.project(g.level.exit.x, g.level.exit.y, 1);
    this.glow(exit.x, exit.y, s * 3, gold + '23');
    c.restore();
  }
  occupied(g, x, y) {
    return [
      ...g.level.sources,
      ...g.level.relays,
      ...g.level.mirrors,
      ...g.level.buds,
      ...(g.level.chimes || []),
      g.level.exit,
    ].some((o) => Math.floor(o.x) === x && Math.floor(o.y) === y);
  }
  paintBackground(g, t) {
    const c = this.ctx,
      w = this.width,
      h = this.height;
    const bg = c.createLinearGradient(0, 0, w, h);
    const dawn = g.index === 2;
    bg.addColorStop(0, dawn ? '#363047' : '#10162e');
    bg.addColorStop(
      0.48,
      dawn ? '#665b61' : ['#19343d', '#252747', '#233340', '#27273e'][this.biome],
    );
    bg.addColorStop(1, dawn ? '#263f4c' : '#173d40');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    this.glow(w * 0.7, h * 0.4, w * 0.6, dawn ? '#f1c69b46' : '#778edc25');
    if (dawn) this.glow(w * 0.3, h * 0.52, w * 0.42, '#eab88c25');
    this.glow(w * 0.16, h * 0.75, w * 0.4, g.level.palette[0] + '13');
    this.aurora(t, g);
    for (const s of this.stars) {
      c.globalAlpha = 0.25 + (Math.sin(t * 0.45 + s.p) + 1) * 0.22;
      this.ellipse(s.x * w, s.y * h, s.r, s.r, '#cce9ff');
    }
    c.globalAlpha = 1;
    // The distant eclipsed moon and orbit lines establish the observatory's scale.
    const mx = w * 0.83,
      my = h * 0.22,
      mr = Math.min(w, h) * 0.1;
    this.glow(mx, my, mr * 2.5, '#ffdfb132');
    c.strokeStyle = '#dff3d860';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(mx, my, mr, 0, TAU);
    c.stroke();
    c.strokeStyle = '#fff5dcb0';
    c.beginPath();
    c.arc(mx, my, mr, -2.2, -0.6);
    c.stroke();
    const moon = c.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, 0, mx, my, mr);
    moon.addColorStop(0, dawn ? '#ffe6b977' : '#e9efd849');
    moon.addColorStop(1, '#789eac0c');
    this.ellipse(mx, my, mr, mr, moon);
    this.ellipse(
      mx + mr * 0.22,
      my - mr * 0.07,
      mr * 0.92,
      mr * 0.92,
      dawn ? '#545461dd' : '#193743d9',
    );
    c.save();
    c.translate(w * 0.48, h * 0.5);
    c.rotate(-0.18);
    c.strokeStyle = '#83b2dd0a';
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(0, 0, w * (0.38 + i * 0.08), h * (0.31 + i * 0.07), 0, 0, TAU);
      c.stroke();
    }
    c.restore();
    // Far islands drift slowly, well behind the traversable architecture.
    for (let i = 0; i < 6; i++) {
      const x = (hash(i, 44) * 1.2 - 0.1) * w,
        y = h * (0.25 + hash(i, 45) * 0.65);
      const size = 20 + hash(i, 46) * 40;
      const drift = this.reduced ? 0 : Math.sin(t * 0.12 + i) * 8;
      this.path(
        [
          { x: x - size, y: y + drift },
          { x, y: y - size * 0.35 + drift },
          { x: x + size, y: y + drift },
          { x: x + size * 0.25, y: y + size * 0.8 + drift },
        ],
        '#19294170',
      );
      this.line({ x: x - size, y: y + drift }, { x, y: y - size * 0.35 + drift }, '#6998ac18');
    }
  }
  tile(x, y, type, t, set) {
    const s = this.s,
      c = this.ctx,
      bridge = type === 'bridge' || type === 'living';
    const a = this.project(x, y),
      b = this.project(x + 1, y),
      d = this.project(x, y + 1),
      e = this.project(x + 1, y + 1);
    if (type === 'ghost') {
      c.save();
      c.setLineDash([3, 5]);
      this.path([a, b, e, d], '#60e9e509', '#88dbf03a', 1);
      c.restore();
      const p = this.project(x + 0.5, y + 0.5, -0.07);
      this.ellipse(p.x, p.y, 2, 1, '#8fdae450');
      return;
    }
    const depth = bridge ? 0.15 : 0.56 + hash(x, y) * 0.18;
    const down = (p) => ({ x: p.x, y: p.y + depth * s });
    if (bridge || !set.has(`${x + 1},${y}`))
      this.path([b, e, down(e), down(b)], bridge ? '#327f80' : '#233b49', '#192d46');
    if (bridge || !set.has(`${x},${y + 1}`))
      this.path([d, e, down(e), down(d)], bridge ? '#235e68' : '#172e3a', '#172a42');
    const shade = Math.floor(hash(x, y) * 11),
      base = [
        [26, 66, 62],
        [39, 58, 75],
        [49, 72, 59],
        [44, 60, 63],
      ][this.biome || 0];
    const fill = bridge
      ? type === 'living'
        ? '#487763'
        : '#509b93'
      : `rgb(${base[0] + shade},${base[1] + shade},${base[2] + shade})`;
    this.path([a, b, e, d], fill, bridge ? '#9dfff078' : '#97c29d08', 0.7);
    if (type === 'floor' && this.paths?.has(`${x},${y}`)) this.paving(x, y);
    const center = this.project(x + 0.5, y + 0.5);
    if (type === 'living') {
      this.ellipse(center.x, center.y, s * 0.56, s * 0.25, '#91b494');
      this.line(
        this.project(x + 0.17, y + 0.5, 0.025),
        this.project(x + 0.83, y + 0.5, 0.025),
        '#d5e3aa9a',
        1,
      );
      this.ellipse(center.x + s * 0.12, center.y - s * 0.05, s * 0.05, s * 0.03, '#ffe5b0');
      this.glow(center.x, center.y, s * 0.65, '#b8e6a22c');
    }
    if (bridge) {
      this.neon(
        () =>
          this.line(
            this.project(x + 0.2, y + 0.2, 0.015),
            this.project(x + 0.8, y + 0.8, 0.015),
            cyan + '88',
            1.5,
          ),
        cyan,
        5,
      );
    } else {
      if (hash(x, y) > 0.68) {
        const p = this.project(x + 0.13, y + 0.14);
        this.line(p, this.project(x + 0.36, y + 0.14), '#bfd2d224', 1);
        this.line(p, this.project(x + 0.13, y + 0.39), '#bfd2d224', 1);
      }
      if (!set.has(`${x},${y + 1}`)) {
        this.neon(() => this.line(d, e, '#69dec459', 1), cyan, 4);
        if (hash(x, y) > 0.67) {
          const p = this.project(x + 0.5, y + 1, -0.28);
          this.line({ x: p.x, y: p.y - 4 }, { x: p.x, y: p.y + s * 0.65 }, '#587a7866', 2);
          this.line({ x: p.x, y: p.y + s * 0.2 }, { x: p.x - 4, y: p.y + s * 0.3 }, '#80b49566', 2);
        }
      }
      if (!set.has(`${x + 1},${y}`)) this.line(b, e, '#9dc3db4b', 1);
    }
  }
  hazard(x, y, on, phase, t) {
    const c = this.ctx,
      s = this.s,
      points = [
        [0.12, 0.12],
        [0.88, 0.12],
        [0.88, 0.88],
        [0.12, 0.88],
      ].map(([dx, dy]) => this.project(x + dx, y + dy, 0.025));
    this.neon(
      () => this.path(points, on ? '#ff58794a' : '#8fffe509', on ? '#ff8eac' : '#8fb4bb69', 1.2),
      on ? coral : cyan,
      on ? 11 : 0,
    );
    const p = this.project(x + 0.5, y + 0.5, 0.03);
    if (on) {
      this.glow(p.x, p.y, s * 0.75, coral + '25');
      for (let i = 0; i < 3; i++) {
        const pos = this.project(x + 0.25 + i * 0.23, y + 0.5, 0.12 + Math.sin(t * 5 + i) * 0.04);
        this.line({ x: pos.x - 2, y: pos.y + 3 }, { x: pos.x + 2, y: pos.y - 3 }, '#ffc3d2', 1.4);
      }
    } else {
      c.strokeStyle = '#a6f2d77a';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(p.x, p.y, s * 0.15, s * 0.07, 0, 0, TAU);
      c.stroke();
    }
  }
  beam(g, m, t) {
    const c = this.ctx;
    const on = mirrorActive(g, m);
    const dirs = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ],
      v = dirs[g.mirrors[m.id]];
    const p = this.project(m.x, m.y, 0.68);
    const length = on ? Math.hypot(m.x - m.receiver[0], m.y - m.receiver[1]) : 1.6;
    const end = this.project(m.x + v[0] * length, m.y + v[1] * length, 0.68);
    const powered = !m.relay || g.relays.has(m.relay);
    if (powered) {
      this.neon(
        () => {
          this.line(p, end, on ? cyan + 'bb' : '#c8adff55', on ? 2 : 1);
          this.line(p, end, on ? '#f0ffed' : '#d4c3ff', 0.7);
        },
        on ? cyan : '#c8adff',
        on ? 18 : 7,
      );
      if (on && !this.reduced) {
        const k = (t * 0.6) % 1;
        this.ellipse(p.x + (end.x - p.x) * k, p.y + (end.y - p.y) * k, 2, 2, '#ffffff');
      }
    }
    const r = this.project(m.receiver[0], m.receiver[1], 0.68);
    this.line(this.project(m.receiver[0], m.receiver[1]), r, '#5f748b', 3);
    c.strokeStyle = on ? cyan : '#77879d';
    c.lineWidth = 2;
    this.neon(
      () => {
        c.beginPath();
        c.arc(r.x, r.y, this.s * 0.13, 0, TAU);
        c.stroke();
      },
      cyan,
      on ? 15 : 0,
    );
  }
  object(g, o, t) {
    const c = this.ctx;
    const pop =
      !this.reduced && this.pops[o.id]
        ? Math.sin(((0.55 - this.pops[o.id]) / 0.55) * Math.PI) * 0.13
        : 0;
    c.save();
    if (pop) c.translate(0, -pop * this.s);
    const s = o.type === 'player' ? Math.max(30, this.s) : this.s,
      p = this.project(o.x, o.y),
      bob = this.reduced ? 0 : Math.sin(t * 2.2 + o.x) * s * 0.035;
    this.ellipse(p.x, p.y + 2, s * 0.27, s * 0.11, '#0712227a');
    if (o.type === 'source') {
      this.glow(p.x, p.y - s * 0.35, s * 1.75, '#ffcd6655');
      this.glow(p.x, p.y - s * 0.4, s * 0.6, '#ffe3a170');
      this.ellipse(p.x, p.y, s * 0.3, s * 0.15, '#4e6572');
      this.ellipse(p.x, p.y - 4, s * 0.25, s * 0.12, '#172b45');
      this.neon(
        () => {
          this.ellipse(p.x, p.y - 5, s * 0.21, s * 0.09, gold + 'af');
          const tip = { x: p.x, y: p.y - s * 0.65 + bob };
          this.path(
            [
              tip,
              { x: p.x + s * 0.105, y: p.y - s * 0.36 + bob },
              { x: p.x, y: p.y - s * 0.18 + bob },
              { x: p.x - s * 0.105, y: p.y - s * 0.36 + bob },
            ],
            '#fff0b9',
            '#fffde7',
            1.2,
          );
        },
        gold,
        22,
      );
      for (let i = 0; i < 3; i++) {
        const a = t * 0.6 + (i * TAU) / 3;
        this.ellipse(
          p.x + Math.cos(a) * s * 0.32,
          p.y - s * 0.35 + Math.sin(a) * s * 0.14,
          1,
          1,
          gold,
        );
      }
    }
    if (o.type === 'relay') {
      const on = g.relays.has(o.id);
      const base = [
        [-0.28, -0.28],
        [0.28, -0.28],
        [0.28, 0.28],
        [-0.28, 0.28],
      ].map(([x, y]) => this.project(o.x + x, o.y + y, 0.035));
      this.path(base, '#355659', on ? '#a0ffe19c' : '#8ca8a477', 1.2);
      this.pillar(o.x, o.y, 0.7, on ? cyan : '#526f87');
      const top = this.project(o.x, o.y, 0.8);
      this.neon(
        () =>
          this.path(
            [
              { x: top.x, y: top.y - s * 0.16 },
              { x: top.x + s * 0.1, y: top.y },
              { x: top.x, y: top.y + s * 0.16 },
              { x: top.x - s * 0.1, y: top.y },
            ],
            on ? '#d9fff2' : '#243d53',
            on ? cyan : '#719ab1',
            1.3,
          ),
        cyan,
        on ? 22 : 0,
      );
      if (on) {
        this.glow(top.x, top.y, s * 1.5, cyan + '55');
        c.strokeStyle = cyan + '70';
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(top.x, top.y, s * 0.24, s * 0.1, 0, 0, TAU);
        c.stroke();
      }
    }
    if (o.type === 'mirror') {
      const on = mirrorActive(g, o);
      this.pillar(o.x, o.y, 0.48, '#657b99');
      const top = this.project(o.x, o.y, 0.7);
      this.neon(
        () =>
          this.path(
            [
              { x: top.x, y: top.y - s * 0.23 },
              { x: top.x + s * 0.2, y: top.y },
              { x: top.x, y: top.y + s * 0.15 },
              { x: top.x - s * 0.2, y: top.y },
            ],
            on ? '#b9fff4' : '#a98fda',
            '#eee9ff',
            1,
          ),
        on ? cyan : '#b39cff',
        on ? 20 : 9,
      );
      const dirs = [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ],
        d = dirs[g.mirrors[o.id]],
        from = this.project(o.x + d[0] * 0.24, o.y + d[1] * 0.24, 0.04),
        to = this.project(o.x + d[0] * 0.48, o.y + d[1] * 0.48, 0.04);
      this.line(from, to, gold, 2);
      this.ellipse(to.x, to.y, 2, 2, gold);
    }
    if (o.type === 'exit') {
      const ready = g.relays.size === g.level.relays.length;
      this.ellipse(p.x, p.y, s * 0.48, s * 0.24, '#436079');
      this.ellipse(p.x, p.y - 3, s * 0.4, s * 0.2, '#1c344f');
      const top = this.project(o.x, o.y, 1.25);
      this.line(
        { x: p.x - s * 0.28, y: p.y - 4 },
        { x: top.x - s * 0.28, y: top.y },
        '#778aa0',
        s * 0.065,
      );
      this.line(
        { x: p.x + s * 0.28, y: p.y - 4 },
        { x: top.x + s * 0.28, y: top.y },
        '#778aa0',
        s * 0.065,
      );
      c.save();
      c.strokeStyle = ready ? gold : '#99acc1';
      c.lineWidth = s * 0.07;
      this.neon(
        () => {
          c.beginPath();
          c.ellipse(top.x, top.y + s * 0.15, s * 0.3, s * 0.39, 0, Math.PI, TAU);
          c.stroke();
        },
        gold,
        ready ? 16 : 0,
      );
      c.restore();
      this.neon(
        () => {
          this.ellipse(
            top.x,
            top.y + s * 0.35 + bob,
            s * 0.095,
            s * 0.17,
            ready ? '#fff7dc' : '#597286',
          );
        },
        gold,
        ready ? 30 : 0,
      );
      if (ready) {
        this.glow(p.x, p.y - s * 0.65, s * 2, gold + '55');
        const gr = c.createLinearGradient(p.x, p.y - s * 4, p.x, p.y);
        gr.addColorStop(0, gold + '00');
        gr.addColorStop(1, gold + '22');
        c.fillStyle = gr;
        c.fillRect(p.x - s * 0.13, p.y - s * 4, s * 0.26, s * 4);
      }
    }
    if (o.type === 'chime') this.chime(g, o, t);
    if (o.type === 'bud') this.flower(g, o, t);
    if (o.type === 'wisp') {
      const pos = this.project(o.x, o.y, 0.43 + Math.sin(t * 1.7 + o.seed) * 0.09);
      this.glow(pos.x, pos.y, s * 0.6, '#c1a5ff50');
      this.neon(
        () => {
          this.ellipse(pos.x, pos.y, 3, 3, '#d4c4ff');
          this.line({ x: pos.x - 5, y: pos.y }, { x: pos.x + 5, y: pos.y }, '#d4c4ff90', 1);
          this.line({ x: pos.x, y: pos.y - 5 }, { x: pos.x, y: pos.y + 5 }, '#d4c4ff90', 1);
        },
        '#b9a8ff',
        15,
      );
    }
    if (o.type === 'player') {
      if (o.invincible > 0 && Math.sin(t * 22) > 0.5) c.globalAlpha = 0.5;
      const moving = !this.reduced && g.steps > 0 ? Math.sin(g.steps * 18) * s * 0.015 : 0;
      const q = { x: p.x, y: p.y - s * 0.24 + moving };
      c.save();
      c.translate(q.x, q.y);
      c.rotate(!this.reduced && o.walking ? (o.facingX - o.facingY) * 0.06 : 0);
      c.translate(-q.x, -q.y);
      if (o.dash > 0) {
        this.neon(
          () =>
            this.line(
              this.project(o.x - o.facingX * 0.7, o.y - o.facingY * 0.7, 0.35),
              q,
              gold + 'aa',
              s * 0.15,
            ),
          gold,
          18,
        );
      }
      this.glow(p.x, p.y - s * 0.3, s * 1.2, gold + '35');
      // A small porcelain keeper, with a gold face and coral wind scarf.
      this.path(
        [
          { x: q.x - s * 0.12, y: q.y - s * 0.18 },
          { x: q.x + s * 0.13, y: q.y - s * 0.18 },
          { x: q.x + s * 0.2, y: q.y + s * 0.17 },
          { x: q.x - s * 0.17, y: q.y + s * 0.17 },
        ],
        '#c6e0e1',
        '#f0fff1',
        0.7,
      );
      this.ellipse(q.x - s * 0.07, q.y + s * 0.17, s * 0.055, s * 0.04, '#70899a');
      this.ellipse(q.x + s * 0.07, q.y + s * 0.17, s * 0.055, s * 0.04, '#70899a');
      const scarf = this.project(o.x - o.facingX * 0.28, o.y - o.facingY * 0.28, 0.36);
      this.path(
        [
          { x: q.x, y: q.y - s * 0.15 },
          { x: scarf.x - s * 0.12, y: scarf.y + Math.sin(t * 6) * 2 },
          { x: scarf.x + s * 0.04, y: scarf.y + s * 0.11 },
          { x: q.x + s * 0.1, y: q.y - s * 0.08 },
        ],
        coral,
      );
      this.ellipse(q.x, q.y - s * 0.27, s * 0.175, s * 0.19, '#fff5d8');
      this.ellipse(q.x - s * 0.135, q.y - s * 0.4, s * 0.055, s * 0.06, '#fff5d8');
      this.ellipse(q.x + s * 0.135, q.y - s * 0.4, s * 0.055, s * 0.06, '#fff5d8');
      this.ellipse(q.x, q.y - s * 0.245, s * 0.12, s * 0.09, '#3a5050');
      this.neon(
        () => {
          this.ellipse(
            q.x - s * 0.034,
            q.y - s * 0.25,
            s * 0.015,
            s * (t % 5 > 4.82 ? 0.005 : 0.025),
            gold,
          );
          this.ellipse(
            q.x + s * 0.034,
            q.y - s * 0.25,
            s * 0.015,
            s * (t % 5 > 4.82 ? 0.005 : 0.025),
            gold,
          );
        },
        gold,
        6,
      );
      if (o.carrying) {
        const orb = this.project(o.x, o.y, 0.96 + Math.sin(t * 3) * 0.06);
        this.glow(orb.x, orb.y, s * 0.7, gold + '33');
        this.neon(() => this.ellipse(orb.x, orb.y, s * 0.07, s * 0.07, '#fff2be'), gold, 20);
        c.strokeStyle = gold + '55';
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(orb.x, orb.y, s * 0.18, s * 0.07, t, 0, TAU);
        c.stroke();
      }
      c.restore();
      c.globalAlpha = 1;
    }
    if (o.type === 'tree' || o.type === 'shrub') this.tree(o, t);
    if (['lotus', 'arch', 'bells', 'observatory', 'station', 'hearttree'].includes(o.type))
      this.landmark(o, t);
    if (o.type === 'plant') {
      for (let i = 0; i < 4; i++) {
        const height = 0.22 + i * 0.11;
        const tip = this.project(o.x + (i - 1) * 0.09, o.y, height);
        this.line(p, tip, '#6ba58f', 1.3);
        this.path(
          [
            tip,
            { x: tip.x + s * 0.12, y: tip.y + s * 0.08 },
            { x: tip.x, y: tip.y + s * 0.12 },
            { x: tip.x - s * 0.1, y: tip.y + s * 0.05 },
          ],
          i === 2 ? '#a5d995' : '#65b59b',
        );
      }
    }
    if (o.type === 'post') {
      this.pillar(o.x, o.y, 0.5, '#45647b');
      const top = this.project(o.x, o.y, 0.56);
      this.neon(() => this.ellipse(top.x, top.y, s * 0.038, s * 0.05, cyan), cyan, 8);
    }
    c.restore();
  }
  pillar(x, y, height, color) {
    const s = this.s;
    const a = this.project(x - 0.12, y - 0.12),
      b = this.project(x + 0.12, y - 0.12),
      d = this.project(x - 0.12, y + 0.12),
      e = this.project(x + 0.12, y + 0.12);
    const up = (p) => ({ x: p.x, y: p.y - height * s });
    this.path([b, e, up(e), up(b)], '#263e54');
    this.path([d, e, up(e), up(d)], color);
    this.path([up(a), up(b), up(e), up(d)], '#8499a5');
  }
}
