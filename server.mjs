import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let p = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!p.startsWith(root + path.sep) && p !== root) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (p === root) p += '/index.html';
      const b = await fs.readFile(p);
      res.writeHead(200, {
        'Content-Type': types[path.extname(p)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(b);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  })
  .listen(4173, '127.0.0.1', () => console.log('LUMEN RELAY preview: http://127.0.0.1:4173'));
