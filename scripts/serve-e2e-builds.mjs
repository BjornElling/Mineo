import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';

import { IDENTITY_PATH, SERVER_IDENTITY } from './e2e-server-identity.mjs';

const portArgument = process.argv.indexOf('--port');
const port = Number(portArgument >= 0 ? process.argv[portArgument + 1] : undefined);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('Brug: node scripts/serve-e2e-builds.mjs --port <1-65535>');
}

const mineoRoot = path.resolve('dist/mineo');
const minprocesrenteRoot = path.resolve('dist/minprocesrente');
for (const root of [mineoRoot, minprocesrenteRoot]) {
  if (!existsSync(root)) throw new Error(`E2E-previewet mangler buildmappen ${root}.`);
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);

const serveOriginBoundPwaManifest = (response, host) => {
  const manifest = JSON.parse(readFileSync(path.join(mineoRoot, 'manifest.json'), 'utf8'));
  const origin = `http://${host}`;
  const appId = new URL(manifest.start_url, origin).href;
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify({
    ...manifest,
    id: appId,
    related_applications: [{
      platform: 'webapp',
      url: new URL('/manifest.json', origin).href,
      id: appId,
    }],
  }));
};

const resolveSafeFile = (root, pathname) => {
  const decoded = decodeURIComponent(pathname);
  const candidate = path.resolve(root, `.${decoded}`);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  return candidate;
};

const serveFile = (response, filePath) => {
  response.statusCode = 200;
  response.setHeader('Content-Type', contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream');
  // E2E dokumenterer nybygget kode; cache må aldrig få en forudgående test til at ligne denne.
  response.setHeader('Cache-Control', 'no-store');
  createReadStream(filePath).pipe(response);
};

createServer((request, response) => {
  const requestUrl = request.url;
  if (requestUrl === undefined) {
    response.statusCode = 400;
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = new URL(requestUrl, 'http://127.0.0.1').pathname;
  } catch {
    response.statusCode = 400;
    response.end();
    return;
  }

  // Identitetssvar. Serveren overlever, hvis en Playwright-kørsel afbrydes midt i (fx et
  // værktøjstimeout), og så fejler ENHVER senere kørsel med «port already used» – uden at det
  // fremgår, at det er vores egen efterladte proces. `scripts/free-e2e-port.mjs` spørger her, så
  // den kan skelne en efterladt Mineo-server fra en fremmed proces og kun rydde sin egen op.
  if (pathname === IDENTITY_PATH) {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify({ server: SERVER_IDENTITY, pid: process.pid }));
    return;
  }

  if (pathname === '/manifest.json') {
    serveOriginBoundPwaManifest(response, request.headers.host ?? `127.0.0.1:${port}`);
    return;
  }

  const isMinprocesrente = pathname === '/minprocesrente.html' || pathname.startsWith('/minprocesrente/');
  const root = isMinprocesrente ? minprocesrenteRoot : mineoRoot;
  const relativePath = pathname === '/minprocesrente.html'
    ? '/minprocesrente.html'
    : isMinprocesrente
      ? pathname.slice('/minprocesrente'.length) || '/minprocesrente.html'
      : pathname;
  const requestedFile = resolveSafeFile(root, relativePath);
  const fallbackFile = isMinprocesrente ? null : path.join(mineoRoot, 'index.html');
  const filePath = requestedFile !== null && existsSync(requestedFile) && statSync(requestedFile).isFile()
    ? requestedFile
    : fallbackFile;

  if (filePath === null) {
    response.statusCode = 404;
    response.end();
    return;
  }
  serveFile(response, filePath);
}).listen(port, '127.0.0.1', () => {
  console.log(`Mineos E2E-buildserver lytter på http://127.0.0.1:${port}/`);
});
