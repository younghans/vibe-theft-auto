import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { config as loadDotenv } from 'dotenv';

const cliArgs = [];
for (let index = 2; index < process.argv.length; index += 1) {
  cliArgs.push(process.argv[index]);
}
const positionalArgs = [];
const flags = new Set();
for (const arg of cliArgs) {
  if (arg.startsWith('--')) {
    flags.add(arg);
  } else {
    positionalArgs.push(arg);
  }
}

const root = path.resolve(positionalArgs[0] ?? '.');
for (const envFile of ['.env.local', '.env']) {
  loadDotenv({ path: path.join(root, envFile), override: false, quiet: true });
}

const port = Number(process.env.PORT || positionalArgs[1] || 4173);
const configuredServerUrl = (
  process.env.VTA_SERVER_URL
  || process.env.VITE_VTA_SERVER_URL
  || process.env.STICKRPG_SERVER_URL
  || process.env.VITE_STICKRPG_SERVER_URL
  || positionalArgs[2]
  || ''
).trim();
const configuredSupabaseUrl = (
  process.env.VTA_SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.STICKRPG_SUPABASE_URL
  || process.env.SUPABASE_URL
  || ''
).trim();
const configuredSupabasePublishableKey = (
  process.env.VTA_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.STICKRPG_SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.VTA_SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.STICKRPG_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || ''
).trim();
const liveReloadEnabled = flags.has('--live-reload')
  || process.env.VTA_LIVE_RELOAD === '1'
  || process.env.STICKRPG_LIVE_RELOAD === '1';
const liveReloadClients = new Set();
const ignoredWatchPathSegments = new Set([
  '.codex',
  '.dist-staging',
  '.git',
  'animations',
  'assets',
  'dist',
  'node_modules',
  'test-results',
  'vendor'
]);
const ignoredWatchPathPrefixes = [
  path.join('server', 'data'),
  path.join('assets', 'mixamo', 'portraits')
];
const liveReloadEndpoint = '/__dev_reload';
const devWriteAssetEndpoint = '/__dev_write_asset';

let liveReloadTimer = null;

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
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.wav': 'audio/wav'
};
const compressibleExtensions = new Set(['.css', '.glb', '.html', '.js', '.json', '.svg', '.txt']);

function normalizeRelativePath(filePath = '') {
  const segments = String(filePath).split(/[\\/]+/u);
  let normalizedPath = '';
  for (const segment of segments) {
    if (!segment) {
      continue;
    }
    normalizedPath = normalizedPath ? `${normalizedPath}${path.sep}${segment}` : segment;
  }
  return normalizedPath;
}

function shouldIgnoreWatchedPath(filePath = '') {
  const normalizedPath = normalizeRelativePath(filePath);
  if (!normalizedPath) {
    return false;
  }

  const pathSegments = normalizedPath.split(path.sep);
  for (const segment of pathSegments) {
    if (ignoredWatchPathSegments.has(segment)) {
      return true;
    }
  }

  for (const prefix of ignoredWatchPathPrefixes) {
    if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}${path.sep}`)) {
      return true;
    }
  }

  return false;
}

function scheduleLiveReload(changedPath = '', { force = false } = {}) {
  if (!liveReloadEnabled || liveReloadClients.size === 0) {
    return;
  }
  if (!force && changedPath && shouldIgnoreWatchedPath(changedPath)) {
    return;
  }

  clearTimeout(liveReloadTimer);
  liveReloadTimer = setTimeout(() => {
    const payload = JSON.stringify({
      path: normalizeRelativePath(changedPath) || null,
      updatedAt: Date.now()
    });

    for (const response of liveReloadClients) {
      response.write(`event: reload\ndata: ${payload}\n\n`);
    }
  }, 75);
}

function injectHtml(html) {
  let nextHtml = html;
  const assignments = [];

  if (configuredServerUrl) {
    assignments.push(`globalThis.VTA_SERVER_URL = ${JSON.stringify(configuredServerUrl)};`);
    assignments.push(`globalThis.STICKRPG_SERVER_URL = ${JSON.stringify(configuredServerUrl)};`);
  }

  if (configuredSupabaseUrl && configuredSupabasePublishableKey) {
    assignments.push(`globalThis.VTA_SUPABASE_URL = ${JSON.stringify(configuredSupabaseUrl)};`);
    assignments.push(`globalThis.STICKRPG_SUPABASE_URL = ${JSON.stringify(configuredSupabaseUrl)};`);
    assignments.push(`globalThis.VTA_SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(configuredSupabasePublishableKey)};`);
    assignments.push(`globalThis.STICKRPG_SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(configuredSupabasePublishableKey)};`);
  }

  if (assignments.length > 0) {
    nextHtml = nextHtml.replace('</head>', `    <script>${assignments.join('')}</script>\n  </head>`);
  }

  if (liveReloadEnabled) {
    const liveReloadScript = [
      '    <script>',
      '      if ("EventSource" in window) {',
      `        const liveReloadSource = new EventSource(${JSON.stringify(liveReloadEndpoint)});`,
      "        liveReloadSource.addEventListener('reload', () => {",
      '          liveReloadSource.close();',
      '          window.location.reload();',
      '        });',
      '      }',
      '    </script>'
    ].join('\n');

    if (nextHtml.includes('</body>')) {
      nextHtml = nextHtml.replace('</body>', `${liveReloadScript}\n  </body>`);
    } else {
      nextHtml = nextHtml.replace('</head>', `${liveReloadScript}\n  </head>`);
    }
  }

  return nextHtml;
}

function getRequestPathname(requestUrl, host) {
  return new URL(requestUrl, `http://${host}`).pathname;
}

function normalizeRoutePath(routePath = '') {
  const normalized = String(routePath || '/').replace(/\\/gu, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function setupLiveReloadWatcher() {
  if (!liveReloadEnabled) {
    return null;
  }

  try {
    const watcher = fs.watch(root, { recursive: true }, (_eventType, filename) => {
      if (!filename || shouldIgnoreWatchedPath(filename)) {
        return;
      }

      scheduleLiveReload(filename);
    });

    watcher.on('error', (error) => {
      console.warn('[dev-server] Live reload watcher stopped.', error);
    });

    return watcher;
  } catch (error) {
    console.warn('[dev-server] Live reload is unavailable in this environment.', error);
    return null;
  }
}

function normalizeRequestPath(requestUrl, host) {
  const requestPath = getRequestPathname(requestUrl, host);
  return path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, '');
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => {
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function resolveWritableAssetPath(relativePath = '') {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const allowedPrefix = normalizeRelativePath(path.join('assets', 'mixamo', 'portraits'));
  const extension = path.extname(normalizedRelativePath).toLowerCase();
  if (
    !normalizedRelativePath
    || !normalizedRelativePath.startsWith(allowedPrefix)
    || (extension !== '.png' && extension !== '.json')
  ) {
    return null;
  }

  const targetPath = path.resolve(root, normalizedRelativePath);
  const allowedRoot = path.resolve(root, allowedPrefix);
  if (!targetPath.startsWith(`${allowedRoot}${path.sep}`) && targetPath !== allowedRoot) {
    return null;
  }

  return targetPath;
}

function isFingerprinted(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.mp3' || extension === '.wav') {
    return false;
  }

  return /-[a-z0-9]{8,}\./iu.test(path.basename(filePath));
}

function getCacheControl(filePath) {
  if (liveReloadEnabled) {
    return 'no-store, max-age=0';
  }

  if (path.basename(filePath).toLowerCase() === 'version.json') {
    return 'no-store, max-age=0';
  }

  const normalizedPath = String(filePath ?? '').split(path.sep).join('/');
  if (/\/assets\/generated\/world-map\.(?:json|webp)$/iu.test(normalizedPath)) {
    return 'no-store, max-age=0';
  }

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
    if (await fsp.stat(brotliPath).catch(() => null)) {
      return { path: brotliPath, encoding: 'br' };
    }
  }

  if (wantsGzip) {
    const gzipPath = `${filePath}.gz`;
    if (await fsp.stat(gzipPath).catch(() => null)) {
      return { path: gzipPath, encoding: 'gzip' };
    }
  }

  return { path: filePath, encoding: null };
}

function parseRangeHeader(rangeHeader = '', fileSize = 0) {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(String(rangeHeader).trim());
  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) {
    return null;
  }

  let start = rawStart ? Number(rawStart) : 0;
  let end = rawEnd ? Number(rawEnd) : fileSize - 1;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  }

  if (
    !Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end < start
    || start >= fileSize
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1)
  };
}

function sendFileStream({
  request,
  response,
  filePath,
  headers,
  fileSize,
  statusCode = 200,
  range = null
}) {
  const responseHeaders = {
    ...headers,
    'Accept-Ranges': 'bytes',
    'Content-Length': range ? range.end - range.start + 1 : fileSize
  };

  if (range) {
    responseHeaders['Content-Range'] = `bytes ${range.start}-${range.end}/${fileSize}`;
  }

  response.writeHead(statusCode, responseHeaders);
  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  fs.createReadStream(filePath, range ?? {})
    .on('error', () => {
      if (!response.headersSent) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      response.end();
    })
    .pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const requestPathname = normalizeRoutePath(getRequestPathname(request.url, request.headers.host));

    if (request.method === 'POST' && requestPathname === devWriteAssetEndpoint) {
      const payload = await readJsonBody(request);
      const targetPath = resolveWritableAssetPath(payload?.relativePath);
      const dataUrl = String(payload?.dataUrl ?? '');
      const textContents = typeof payload?.textContents === 'string'
        ? payload.textContents
        : '';
      const extension = path.extname(targetPath ?? '').toLowerCase();
      const matches = dataUrl.match(/^data:image\/png;base64,(.+)$/u);

      if (!targetPath) {
        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: 'Invalid portrait save request.' }));
        return;
      }

      await fsp.mkdir(path.dirname(targetPath), { recursive: true });

      if (extension === '.png') {
        if (!matches?.[1]) {
          response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify({ ok: false, error: 'Invalid PNG payload.' }));
          return;
        }
        await fsp.writeFile(targetPath, Buffer.from(matches[1], 'base64'));
      } else if (extension === '.json') {
        await fsp.writeFile(targetPath, textContents, 'utf8');
      } else {
        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: 'Unsupported asset type.' }));
        return;
      }

      scheduleLiveReload(path.relative(root, targetPath), { force: true });

      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, relativePath: normalizeRelativePath(path.relative(root, targetPath)) }));
      return;
    }

    if (liveReloadEnabled && requestPathname === liveReloadEndpoint) {
      response.writeHead(200, {
        'Cache-Control': 'no-store, max-age=0',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8'
      });
      response.write('retry: 250\n\n');
      liveReloadClients.add(response);
      request.on('close', () => {
        liveReloadClients.delete(response);
      });
      return;
    }

    const safePath = normalizeRequestPath(request.url, request.headers.host);
    let filePath = path.join(root, safePath);

    const stats = await fsp.stat(filePath).catch(() => null);
    if (stats?.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const baseStats = await fsp.stat(filePath).catch(() => null);
    if (!baseStats?.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const injectHtmlDocument = extension === '.html' && (configuredServerUrl || liveReloadEnabled);
    const variant = await pickEncodingVariant(
      filePath,
      request.headers['accept-encoding'] ?? '',
      injectHtmlDocument
    );
    const headers = {
      'Cache-Control': getCacheControl(filePath),
      'Content-Type': mimeTypes[extension] ?? 'application/octet-stream',
      Vary: 'Accept-Encoding'
    };

    if (variant.encoding) {
      headers['Content-Encoding'] = variant.encoding;
    }

    if (!injectHtmlDocument) {
      const variantStats = await fsp.stat(variant.path);
      const rangeHeader = request.headers.range;
      if (rangeHeader && !variant.encoding) {
        const range = parseRangeHeader(rangeHeader, variantStats.size);
        if (!range) {
          response.writeHead(416, {
            ...headers,
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes */${variantStats.size}`
          });
          response.end();
          return;
        }

        sendFileStream({
          request,
          response,
          filePath: variant.path,
          headers,
          fileSize: variantStats.size,
          statusCode: 206,
          range
        });
        return;
      }

      sendFileStream({
        request,
        response,
        filePath: variant.path,
        headers,
        fileSize: variantStats.size
      });
      return;
    }

    let body = await fsp.readFile(variant.path);
    body = Buffer.from(injectHtml(body.toString('utf8')), 'utf8');
    headers['Content-Length'] = body.length;
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

const liveReloadWatcher = setupLiveReloadWatcher();

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
  if (configuredServerUrl) {
    console.log(`Using multiplayer server ${configuredServerUrl}`);
  }
  if (liveReloadEnabled) {
    console.log('Live reload enabled.');
  }
});

server.on('close', () => {
  liveReloadWatcher?.close();
  clearTimeout(liveReloadTimer);
});
