import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.argv[2] ?? '.');
const port = Number(process.env.PORT || process.argv[3] || 4173);
const configuredServerUrl = (process.env.STICKRPG_SERVER_URL || process.argv[4] || '').trim();

const mimeTypes = {
  '.bin': 'application/octet-stream',
  '.br': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.fbx': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.gz': 'application/octet-stream',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav'
};
const compressibleExtensions = new Set(['.css', '.html', '.js', '.json', '.svg', '.txt']);

function normalizeRequestPath(requestUrl, host) {
  const requestPath = new URL(requestUrl, `http://${host}`).pathname;
  return path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, '');
}

function isFingerprinted(filePath) {
  return /-[a-z0-9]{8,}\./iu.test(path.basename(filePath));
}

function getCacheControl(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') {
    return 'no-cache';
  }

  if (isFingerprinted(filePath)) {
    return 'public, max-age=31536000, immutable';
  }

  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    return 'public, max-age=86400';
  }

  return 'public, max-age=3600';
}

async function pickEncodingVariant(filePath, acceptEncoding = '', injectHtml = false) {
  const extension = path.extname(filePath).toLowerCase();
  if (injectHtml || !compressibleExtensions.has(extension)) {
    return { path: filePath, encoding: null };
  }

  const wantsBrotli = /\bbr\b/u.test(acceptEncoding);
  const wantsGzip = /\bgzip\b/u.test(acceptEncoding);

  if (wantsBrotli) {
    const brotliPath = `${filePath}.br`;
    if (await fs.stat(brotliPath).catch(() => null)) {
      return { path: brotliPath, encoding: 'br' };
    }
  }

  if (wantsGzip) {
    const gzipPath = `${filePath}.gz`;
    if (await fs.stat(gzipPath).catch(() => null)) {
      return { path: gzipPath, encoding: 'gzip' };
    }
  }

  return { path: filePath, encoding: null };
}

const server = http.createServer(async (request, response) => {
  try {
    const safePath = normalizeRequestPath(request.url, request.headers.host);
    let filePath = path.join(root, safePath);

    const stats = await fs.stat(filePath).catch(() => null);
    if (stats?.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const baseStats = await fs.stat(filePath).catch(() => null);
    if (!baseStats?.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const injectHtml = Boolean(configuredServerUrl && extension === '.html');
    const variant = await pickEncodingVariant(filePath, request.headers['accept-encoding'] ?? '', injectHtml);
    let body = await fs.readFile(variant.path);

    if (injectHtml) {
      const html = body.toString('utf8');
      const injectedHtml = html.replace(
        '</head>',
        `    <script>globalThis.STICKRPG_SERVER_URL = ${JSON.stringify(configuredServerUrl)};</script>\n  </head>`
      );
      body = Buffer.from(injectedHtml, 'utf8');
    }

    const headers = {
      'Cache-Control': getCacheControl(filePath),
      'Content-Type': mimeTypes[extension] ?? 'application/octet-stream',
      Vary: 'Accept-Encoding'
    };

    if (variant.encoding) {
      headers['Content-Encoding'] = variant.encoding;
    }

    response.writeHead(200, headers);
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
