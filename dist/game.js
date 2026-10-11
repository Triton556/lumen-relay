import {
  LEVELS,
  createGame,
  update,
  interact,
  startDash,
  recall,
  objective,
  interactionText,
  interactionAvailable,
  interactable,
  snapshot,
  beginExploration,
} from './core.js';
import { icon } from './icons.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import { freshSave, readSave, writeSave, packGame, restoreGame } from './storage.js';
const $ = (id) => document.getElementById(id),
  renderer = new Renderer($('world')),
  sound = new Sound();
let storage;
try {
  storage = localStorage;
} catch {
  storage = {
    getItem() {
      return null;
    },
    setItem() {
      throw Error('Storage unavailable');
    },
  };
}
let save = readSave(storage);
if (
  !save.current &&
  Object.keys(save.best).length === 0 &&
  matchMedia('(prefers-reduced-motion: reduce)').matches
)
  save.settings.reduced = true;
let game = createGame(0),
  mode = 'title',
  settingsReturn = 'title',
  keys = new Set(),
  stick = { x: 0, y: 0 },
  last = performance.now(),
  time = 0,
  toastTimer = 0,
  saveTimer = 0,
  storageWarned = false,
  previousFocus = null,
  pointerId = null;
let photoRequest = 0;
const photoUrls = new Set();
const diagnostics = {
  fps: 0,
  renderMs: 0,
  frames: 0,
  seconds: 0,
  cost: 0,
  syncCost: 0,
  hudCost: 0,
  lastHits: 0,
  lastMisses: 0,
};
const screens = {
  title: 'title-screen',
  pause: 'pause-screen',
  settings: 'settings-screen',
  levels: 'levels-screen',
  complete: 'complete-screen',
  photo: 'photo-screen',
};
function syncTouchControls() {
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
  $('touch-controls').classList.toggle('hidden', mode !== 'playing' || !mobile);
  $('camera-btn').classList.toggle('hidden', mode !== 'playing' || !mobile);
  $('camera-btn').textContent = renderer.overview ? 'За хранителем' : 'Весь сад';
  $('camera-btn').setAttribute('aria-pressed', String(!!renderer.overview));
}
function clearInput() {
  if (pointerId !== null) {
    const id = pointerId;
    pointerId = null;
    try {
      if ($('joystick').hasPointerCapture?.(id)) $('joystick').releasePointerCapture(id);
    } catch {}
  }
  keys.clear();
  stick = { x: 0, y: 0 };
  $('stick-thumb').style.transform = '';
}
function persist() {
  const failed = !writeSave(storage, save);
  if (failed && !storageWarned && mode === 'playing')
    notify('Браузер не разрешает сохранение. Можно играть, пока открыта вкладка.', 7);
  storageWarned = failed;
  for (const screen of ['title', 'settings', 'pause', 'complete'])
    $(screen + '-storage-warning').classList.toggle('hidden', !failed);
  $('settings-save-note').classList.toggle('hidden', failed);
}

function saveCurrent() {
  if (!game.complete || game.exploring) {
    save.current = packGame(game);
    persist();
  }
}
function show(next) {
  if (mode === 'photo' && next !== 'photo') {
    photoRequest++;
    $('photo-export').disabled = false;
  }
  mode = next;
  $('diagnostics').classList.toggle('hidden', next === 'photo' || !save.settings.diagnostics);
  if (next === 'title')
    $('scene-caption-text').textContent =
      `${String(game.index + 1).padStart(2, '0')} / ${game.level.subtitle.toUpperCase()}`;
  clearInput();
  for (const [name, id] of Object.entries(screens)) $(id).classList.toggle('hidden', name !== mode);
  const active = mode === 'playing';
  $('hud').classList.toggle('hidden', !active);
  $('game-bottom').classList.toggle('hidden', !active);
  syncTouchControls();
  if (!active) {
    $('toast').classList.add('hidden');
    sound.suspend();
    const first = $(screens[mode])?.querySelector('button:not(:disabled), input');
    if (first)
      setTimeout(() => {
        if (mode === next) first.focus({ preventScroll: true });
      }, 50);
  } else {
    sound.unlock();
    document.activeElement?.blur();
  }
  document.body.dataset.mode = mode;
}
function notify(text, seconds = 4) {
  $('toast').textContent = text;
  toastTimer = seconds;
  if (mode === 'playing') $('toast').classList.remove('hidden');
}
function refreshTitle() {
  $('play-btn').innerHTML =
    (save.current
      ? 'Продолжить путь'
      : LEVELS.every((_, i) => save.best[i])
        ? 'Путешествовать снова'
        : save.unlocked > 0
          ? 'Продолжить путешествие'
          : 'Начать путешествие') +
    ' ' +
    icon('diagonal');
}
function applySettings() {
  renderer.quality = save.settings.quality;
  renderer.reduced = save.settings.reduced;
  sound.setEnabled(save.settings.sound);
  if (mode === 'playing' && save.settings.sound) sound.unlock();
  else sound.suspend();
  $('sound-setting').checked = save.settings.sound;
  $('motion-setting').checked = save.settings.reduced;
  $('quality-setting').value = save.settings.quality;
  $('diagnostics-setting').checked = save.settings.diagnostics === true;
  $('diagnostics').classList.toggle('hidden', mode === 'photo' || !save.settings.diagnostics);
  $('sound-btn').innerHTML = icon(save.settings.sound ? 'sound' : 'mute');
  $('sound-btn').setAttribute(
    'aria-label',
    save.settings.sound ? 'Выключить звук' : 'Включить звук',
  );
  $('sound-btn').setAttribute('aria-pressed', String(save.settings.sound));
}
function startLevel(index, restored = null) {
  game = restored || createGame(index);
  renderer.overview = false;
  renderer.cameraReset = true;
  sound.setBiome?.(index);
  renderer.particles = [];
  if (game.complete && !game.exploring) {
    populateCompletion();
    show('complete');
  } else {
    show('playing');
    notify(
      game.exploring ? 'Сад помнит твой свет. Можно просто погулять.' : LEVELS[index].description,
      game.exploring ? 4 : 9,
    );
  }
  saveCurrent();
}
function pause() {
  if (mode !== 'playing') return;
  $('pause-objective').textContent = objective(game);
  $('pause-tip').textContent =
    game.level.description +
    ' Спящие цветы тоже любят свет: подойди к ним с искрой и поделись теплом. Искра останется с тобой.';
  $('pause-collection').textContent =
    `Цветы: ${game.blooms.size}/${game.level.buds.length} · Огоньки памяти: ${game.wisps.size}/${game.level.wisps.length}`;
  $('results-btn').classList.toggle('hidden', !game.exploring);
  $('resume-btn').innerHTML =
    (game.exploring ? 'Продолжить прогулку ' : 'Продолжить ') + icon('arrow');
  if (game.complete && !game.exploring) {
    populateCompletion();
    show('complete');
    return;
  }
  saveCurrent();
  show('pause');
}
// Photo mode is transient UI state. The paused checkpoint remains the normal save.
function openPhoto() {
  if (mode !== 'pause') return;
  $('photo-status').textContent = 'Мгновение остановлено. PNG сохранится на этом устройстве.';
  $('photo-export').disabled = false;
  show('photo');
  renderer.frame(game, time, 0, 'photo');
}
function exportPhoto() {
  if (mode !== 'photo' || $('photo-export').disabled) return;
  const request = ++photoRequest;
  $('photo-export').disabled = true;
  $('photo-status').textContent = 'Готовим снимок…';
  const failed = () => {
    if (request !== photoRequest || mode !== 'photo') return;
    $('photo-export').disabled = false;
    $('photo-status').textContent =
      'Не удалось сохранить PNG. Попробуй ещё раз или сделай снимок экрана.';
  };
  try {
    // Paint immediately so even a click before the next RAF gets a clean scene.
    renderer.frame(game, time, 0, 'photo');
    $('world').toBlob((blob) => {
      if (request !== photoRequest || mode !== 'photo') return;
      if (!blob) return failed();
      let url;
      let link;
      try {
        url = URL.createObjectURL(blob);
        photoUrls.add(url);
        link = document.createElement('a');
        link.href = url;
        link.download = `lumen-relay-garden-${String(game.index + 1).padStart(2, '0')}.png`;
        link.hidden = true;
        document.body.append(link);
        link.click();
        $('photo-status').textContent =
          'PNG передан браузеру. Если загрузка не появилась, попробуй ещё раз.';
        $('photo-export').disabled = false;
      } catch {
        failed();
      } finally {
        link?.remove();
        // Give the browser time to consume the download before releasing its backing data.
        if (url)
          setTimeout(() => {
            URL.revokeObjectURL(url);
            photoUrls.delete(url);
          }, 60000);
      }
    }, 'image/png');
  } catch {
    failed();
  }
}
function openSettings() {
  settingsReturn = mode;
  show('settings');
}
function openLevels() {
  const list = $('level-list');
  const current = restoreGame(save.current);
  $('levels-continue').classList.toggle('hidden', !current);
  $('levels-continue').disabled = !current;
  if (current)
    $('levels-continue').textContent =
      `Продолжить: ${current.level.name}${current.exploring ? ' · прогулка' : ''}`;
  $('levels-replay-note').textContent = current
    ? 'Выбор сада начнёт новый путь вместо текущего. Лучшие огоньки и цветы сохранятся.'
    : 'Выбранный сад начнётся заново. Лучшие огоньки и цветы сохранятся.';
  list.replaceChildren();
  LEVELS.forEach((level, i) => {
    const b = document.createElement('button');
    b.className = 'level-choice';
    b.disabled = i > save.unlocked;
    const best = save.best[i];
    b.innerHTML = `<span class="level-number">0${i + 1}</span><span><strong>${level.name}</strong><small>${i > save.unlocked ? 'Откроется после предыдущего сада' : level.subtitle}</small>${best ? `<small class="level-records">Лучшее: огоньки ${best.wisps}/${level.wisps.length} · цветы ${best.blooms}/${level.buds.length}</small>` : ''}</span><span class="level-result">${i > save.unlocked ? icon('lock') : best ? icon('sparkle') : icon('arrow')}</span>`;
    b.onclick = () => startLevel(i);
    list.append(b);
  });
  show('levels');
}
function recordBest() {
  const old = save.best[game.index];
  save.best[game.index] = {
    time: old ? Math.min(old.time, game.elapsed) : game.elapsed,
    wisps: Math.max(old?.wisps || 0, game.wisps.size),
    blooms: Math.max(old?.blooms || 0, game.blooms.size),
    falls: game.falls,
  };
}
function populateCompletion() {
  $('stay-btn').textContent = game.exploring ? 'Вернуться в сад' : 'Остаться в саду';
  $('complete-kicker').textContent =
    game.index === LEVELS.length - 1 ? 'Все сады пробудились' : 'Сад снова дышит';
  $('complete-heading').textContent =
    game.index === LEVELS.length - 1 ? 'Ты вернул созвездие' : 'Свет вернулся';
  $('complete-note').textContent = game.level.note;
  const tended =
    game.wisps.size === game.level.wisps.length && game.blooms.size === game.level.buds.length;
  $('complete-invitation').textContent = tended
    ? 'Все огоньки найдены, все цветы проснулись. Можно остаться и просто погулять. Время результата больше не меняется.'
    : 'Можно остаться, найти огоньки и пробудить оставшиеся цветы. Время результата больше не меняется.';
  $('stat-wisps').textContent = game.wisps.size + ' / ' + game.level.wisps.length;
  $('stat-blooms').textContent = game.blooms.size + ' / ' + game.level.buds.length;
  $('stat-time').textContent = formatTime(game.elapsed);
  $('next-btn').innerHTML =
    game.index === LEVELS.length - 1
      ? 'Ещё одно путешествие ' + icon('diagonal')
      : 'Следующий сад ' + icon('arrow');
}
function complete() {
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length - 1, game.index + 1));
  recordBest();
  save.current = null;
  persist();
  populateCompletion();
  const completedGame = game;
  setTimeout(
    () => {
      if (game === completedGame && game.complete && !game.exploring && mode === 'playing')
        show('complete');
    },
    game.index === LEVELS.length - 1 ? 2600 : 1300,
  );
}
function formatTime(s) {
  return (
    String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0')
  );
}
function act() {
  if (mode !== 'playing') return;
  sound.unlock();
  interact(game);
}
function dash() {
  if (mode !== 'playing') return;
  sound.unlock();
  startDash(game);
}
$('camera-btn').onclick = () => {
  renderer.overview = !renderer.overview;
  renderer.cameraReset = true;
  syncTouchControls();
};
$('play-btn').onclick = () => {
  sound.unlock();
  const restored = restoreGame(save.current);
  startLevel(
    restored ? restored.index : LEVELS.every((_, i) => save.best[i]) ? 0 : save.unlocked,
    restored,
  );
};
$('levels-btn').onclick = openLevels;
$('levels-continue').onclick = () => {
  const current = restoreGame(save.current);
  if (current) startLevel(current.index, current);
};
$('levels-back').onclick = () => {
  refreshTitle();
  show('title');
};
$('title-settings').onclick = openSettings;
$('pause-settings').onclick = openSettings;
$('photo-btn').onclick = openPhoto;
$('photo-export').onclick = exportPhoto;
$('photo-back').onclick = () => show('pause');
$('settings-back').onclick = () => show(settingsReturn);
$('pause-btn').onclick = pause;
$('resume-btn').onclick = () => show('playing');
$('recall-btn').onclick = () => {
  recall(game);
  show('playing');
  notify('Ты снова у последнего огня. Прогресс сохранён.', 3);
};
$('restart-btn').onclick = () => startLevel(game.index);
$('menu-btn').onclick = () => {
  saveCurrent();
  refreshTitle();
  show('title');
};
$('next-btn').onclick = () => startLevel(game.index === LEVELS.length - 1 ? 0 : game.index + 1);
$('complete-menu').onclick = openLevels;
$('stay-btn').onclick = () => {
  if (!beginExploration(game)) return;
  show('playing');
  saveCurrent();
  notify('Свет останется с тобой. Собери огоньки, пробуди цветы или просто погуляй.', 6);
};
$('results-btn').onclick = () => {
  saveCurrent();
  populateCompletion();
  show('complete');
};
$('interact-prompt').onclick = act;
$('sound-btn').onclick = () => {
  save.settings.sound = !save.settings.sound;
  applySettings();
  persist();
};
$('sound-setting').onchange = (e) => {
  save.settings.sound = e.target.checked;
  applySettings();
  persist();
};
$('motion-setting').onchange = (e) => {
  save.settings.reduced = e.target.checked;
  applySettings();
  persist();
};
$('quality-setting').onchange = (e) => {
  save.settings.quality = e.target.value;
  applySettings();
  persist();
};
$('diagnostics-setting').onchange = (e) => {
  save.settings.diagnostics = e.target.checked;
  applySettings();
  persist();
};
window.addEventListener('keydown', (e) => {
  // Preserve browser/OS shortcuts while accepting physical gameplay keys in any layout.
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'F3') {
    e.preventDefault();
    save.settings.diagnostics = !save.settings.diagnostics;
    applySettings();
    persist();
    return;
  }
  if (e.code === 'Escape') {
    e.preventDefault();
    if (mode === 'playing') pause();
    else if (mode === 'pause') show('playing');
    else if (mode === 'photo') show('pause');
    else if (mode === 'settings') show(settingsReturn);
    else if (mode === 'levels') {
      refreshTitle();
      show('title');
    }
    return;
  }
  if (mode !== 'playing') {
    if (e.code === 'Tab') {
      const parent = $(screens[mode]);
      const items = [...parent.querySelectorAll('button:not(:disabled),input,select')];
      if (items.length) {
        if (e.shiftKey && document.activeElement === items[0]) {
          items.at(-1).focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          items[0].focus();
          e.preventDefault();
        }
      }
    }
    return;
  }
  if (
    [
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Space',
      'KeyE',
      'KeyR',
    ].includes(e.code)
  ) {
    e.preventDefault();
    keys.add(e.code);
    if (!e.repeat) {
      if (e.code === 'KeyE') act();
      if (e.code === 'Space') dash();
      if (e.code === 'KeyR') {
        recall(game);
        notify('Ты снова у последнего огня.', 2);
      }
    }
  }
});
window.addEventListener('resize', () => {
  clearInput();
  syncTouchControls();
});
const pointerMedia = matchMedia('(pointer: coarse)');
pointerMedia.addEventListener?.('change', () => {
  clearInput();
  syncTouchControls();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  clearInput();
  if (mode === 'playing') pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') pause();
});
window.addEventListener('pagehide', () => {
  photoRequest++;
  for (const url of photoUrls) URL.revokeObjectURL(url);
  photoUrls.clear();
  if (mode === 'playing' || mode === 'pause') saveCurrent();
});
const joy = $('joystick');
function setStick(e) {
  const b = joy.getBoundingClientRect(),
    dx = e.clientX - b.left - b.width / 2,
    dy = e.clientY - b.top - b.height / 2,
    l = Math.hypot(dx, dy),
    r = 39;
  stick = { x: dx / Math.max(r, l), y: dy / Math.max(r, l) };
  $('stick-thumb').style.transform = `translate(${stick.x * r}px,${stick.y * r}px)`;
}
joy.addEventListener('pointerdown', (e) => {
  if (mode !== 'playing') return;
  e.preventDefault();
  pointerId = e.pointerId;
  joy.setPointerCapture(pointerId);
  setStick(e);
  sound.unlock();
});
joy.addEventListener('pointermove', (e) => {
  if (mode === 'playing' && e.pointerId === pointerId) setStick(e);
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
  joy.addEventListener(name, (e) => {
    if (e.pointerId === pointerId) {
      pointerId = null;
      stick = { x: 0, y: 0 };
      $('stick-thumb').style.transform = '';
    }
  });
$('touch-interact').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  act();
});
$('touch-dash').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  dash();
});
$('touch-interact').addEventListener('click', (e) => {
  if (e.detail === 0) act();
});
$('touch-dash').addEventListener('click', (e) => {
  if (e.detail === 0) dash();
});
function drawHud() {
  $('chapter').textContent =
    `САД ${String(game.index + 1).padStart(2, '0')} / ${String(LEVELS.length).padStart(2, '0')}`;
  $('level-name').textContent = game.level.name;
  $('objective').textContent = objective(game);
  $('wisp-count').textContent = game.wisps.size + ' / ' + game.level.wisps.length;
  const target = interactable(game),
    prompt = $('interact-prompt');
  prompt.classList.toggle('hidden', !target || (game.complete && !game.exploring));
  const available = interactionAvailable(game, target);
  prompt.classList.toggle('informational', !available);
  prompt.disabled = !available;
  if (target) prompt.querySelector('span').textContent = interactionText(game, target);
  $('carry-state').classList.toggle('has-light', game.player.carrying);
  $('carry-state').querySelector('span:last-child').textContent = game.exploring
    ? game.player.carrying
      ? 'Искра с тобой · поделись теплом с цветами'
      : 'Сад восстановлен · источники всё ещё дарят искры'
    : game.player.carrying
      ? 'Искра с тобой · отнеси её к незажжённому реле'
      : game.relays.size === game.level.relays.length
        ? 'Все реле зажжены · маяк ждёт тебя'
        : 'Источники дарят искры · реле открывают путь';
  $('dash-fill').style.width = (1 - game.player.cooldown / 1.05) * 100 + '%';
  $('touch-dash').style.opacity = game.player.cooldown > 0 ? '.45' : '1';
}
function frame(now) {
  const syncStart = performance.now();
  let hudCost = 0;
  const frameDelta = Math.max(0, (now - last) / 1000),
    dt = Math.min(frameDelta, 0.15);
  last = now;
  if (mode !== 'photo') time += dt;
  if (mode === 'playing') {
    if (!game.complete || game.exploring) {
      let sx =
          (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
          (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) +
          stick.x,
        sy =
          (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
          (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) +
          stick.y;
      for (let remaining = dt; remaining > 1e-6; remaining -= 0.025)
        update(game, Math.min(0.025, remaining), {
          x: (sx + sy) * Math.SQRT1_2,
          y: (sy - sx) * Math.SQRT1_2,
        });
    }
    for (const e of game.events.splice(0)) {
      sound.play(e.type);
      if (['relay', 'bloom', 'chime', 'duet'].includes(e.type) && e.id)
        (renderer.pops ??= {})[e.id] = 0.55;
      if (e.type === 'recall' || e.type === 'hurt') renderer.cameraReset = true;
      if (
        ['relay', 'wisp', 'pickup', 'aligned', 'complete', 'bloom', 'chime', 'duet'].includes(
          e.type,
        )
      )
        renderer.burst(
          e.x ?? game.player.x,
          e.y ?? game.player.y,
          e.type === 'wisp' ? '#c7afff' : e.type === 'relay' ? '#83ffe8' : '#ffdd9f',
          e.type === 'complete' ? 90 : 26,
        );
      if (e.type === 'relay')
        notify(
          game.relays.size === game.level.relays.length
            ? 'Все реле зажжены. Пробуди маяк!'
            : 'Реле зажжено. Сад наполняется светом.',
          4,
        );
      if (e.type === 'chime')
        notify('Первый голос проснулся. Найди парный колокольчик с таким же знаком.', 5);
      if (e.type === 'duet') notify('Созвучие собрано! Живой мост вырос и останется с тобой.', 5);
      if (e.type === 'bloom') notify('Цветок проснулся. Твоя искра всё ещё с тобой.', 4);
      if (e.type === 'aligned') notify('Луч пойман. Световой мост открыт.', 3);
      if (e.type === 'hurt') {
        renderer.shake = 4;
        notify('Это только вспышка. Искра и зажжённые реле сохранены.', 4);
      }
      if (e.type === 'hint') notify(e.text, 4);
      if (e.type === 'complete') complete();
      if (game.exploring && ['wisp', 'bloom'].includes(e.type)) recordBest();
      if (['relay', 'pickup', 'aligned', 'wisp', 'bloom', 'chime', 'duet'].includes(e.type))
        saveCurrent();
    }
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.add('hidden');
    saveTimer += dt;
    if (saveTimer > 6) {
      saveTimer = 0;
      saveCurrent();
    }
    const hudStart = performance.now();
    drawHud();
    hudCost = performance.now() - hudStart;
  }
  const paintStart = performance.now();
  renderer.frame(game, time, mode === 'photo' ? 0 : dt, mode);
  const cost = performance.now() - paintStart;
  diagnostics.frames++;
  diagnostics.seconds += frameDelta;
  diagnostics.cost += cost;
  diagnostics.syncCost += performance.now() - syncStart;
  diagnostics.hudCost += hudCost;
  if (diagnostics.seconds >= 0.5) {
    diagnostics.fps = Math.round(diagnostics.frames / diagnostics.seconds);
    diagnostics.renderMs = diagnostics.cost / diagnostics.frames;
    const cache = renderer.neonStats || { hits: 0, misses: 0 };
    if (save.settings.diagnostics)
      $('diagnostics').textContent =
        `${diagnostics.fps} FPS · canvas ${diagnostics.renderMs.toFixed(1)} мс · JS ${(diagnostics.syncCost / diagnostics.frames).toFixed(1)} мс · HUD ${(diagnostics.hudCost / diagnostics.frames).toFixed(2)} мс
` +
        `кэш H/M: ${cache.hits - diagnostics.lastHits}/${cache.misses - diagnostics.lastMisses} · ${renderer.neonCache?.size || 0} шт · ${((renderer.neonPixels || 0) / 1e6).toFixed(2)} Мпкс · DPR ${renderer.dpr || 1} · ${renderer.quality === 'high' ? 'полное' : 'лёгкое'}`;
    diagnostics.lastHits = cache.hits;
    diagnostics.lastMisses = cache.misses;
    diagnostics.syncCost = 0;
    diagnostics.hudCost = 0;
    diagnostics.frames = 0;
    diagnostics.seconds = 0;
    diagnostics.cost = 0;
  }
  requestAnimationFrame(frame);
}
window.render_game_to_text = () =>
  JSON.stringify({
    ...snapshot(game),
    mode,
    unlocked: save.unlocked,
    settings: { ...save.settings },
    coordinateSystem: 'Isometric world x/y. Keyboard arrows move in screen directions.',
  });
$('garden-count').textContent = LEVELS.length + ' созданных вручную садов';
$('edition-count').textContent = '01 — ' + String(LEVELS.length).padStart(2, '0');
applySettings();
refreshTitle();
show('title');
requestAnimationFrame(frame);
