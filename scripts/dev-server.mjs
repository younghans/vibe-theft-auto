import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.argv[2] ?? '.');
const port = Number(process.env.PORT || process.argv[3] || 4173);
const configuredServerUrl = (process.env.STICKRPG_SERVER_URL || process.argv[4] || '').trim();

const mimeTypes = {
  '.bin': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

const server = http.createServer(async (request, response) => {
  try {
    const requestPath = new URL(request.url, `http://${request.headers.host}`).pathname;
    const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(root, safePath);

    const stats = await fs.stat(filePath).catch(() => null);
    if (stats?.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const contents = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    let body = contents;

    if (configuredServerUrl && extension === '.html') {
      const html = contents.toString('utf8');
      const injectedHtml = html.replace(
        '</head>',
        `    <script>globalThis.STICKRPG_SERVER_URL = ${JSON.stringify(configuredServerUrl)};</script>\n  </head>`
      );
      body = Buffer.from(injectedHtml, 'utf8');
    }

    response.writeHead(200, { 'Content-Type': mimeTypes[extension] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
  if (configuredServerUrl) {
    console.log(`Using multiplayer server ${configuredServerUrl}`);
  }
});
