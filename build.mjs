import { mkdir, copyFile, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const f of [
  'index.html',
  'style.css',
  'game.js',
  'core.js',
  'render.js',
  'audio.js',
  'storage.js',
  'icons.js',
])
  await copyFile(`src/${f}`, `dist/${f}`);
console.log('Built static game in dist/');
