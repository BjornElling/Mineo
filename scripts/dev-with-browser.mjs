import { mkdtemp, rm } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const viteBin = path.resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const browserLaunchTimeoutMs = 30_000;

let browserProcess = null;
let browserProfileDir = null;
let shuttingDown = false;
let browserLaunchStarted = false;
let browserLaunchTimeout = null;

const viteProcess = spawn(process.execPath, [viteBin], {
  cwd: projectRoot,
  env: {
    ...process.env,
    BROWSER: 'none',
  },
  stdio: ['inherit', 'pipe', 'pipe'],
});

viteProcess.stdout.setEncoding('utf8');
viteProcess.stderr.setEncoding('utf8');

viteProcess.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  maybeLaunchBrowser(chunk);
});

viteProcess.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
  maybeLaunchBrowser(chunk);
});

viteProcess.on('exit', async (code, signal) => {
  await shutdownBrowser();
  clearLaunchTimeout();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

viteProcess.on('error', async (error) => {
  console.error('[dev] Kunne ikke starte Vite:', error);
  await shutdownBrowser();
  clearLaunchTimeout();
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    clearLaunchTimeout();
    viteProcess.kill(signal);

    // Fallback hvis child-processen ikke når at afslutte selv.
    setTimeout(async () => {
      if (viteProcess.exitCode !== null) {
        return;
      }

      viteProcess.kill('SIGKILL');
      await shutdownBrowser();
      process.exit(1);
    }, 2_000).unref();
  });
}

function maybeLaunchBrowser(outputChunk) {
  if (browserLaunchStarted) {
    return;
  }

  const url = extractLocalUrl(outputChunk);

  if (!url) {
    return;
  }

  browserLaunchStarted = true;
  browserLaunchTimeout = setTimeout(() => {
    browserLaunchTimeout = null;
  }, browserLaunchTimeoutMs);
  void launchBrowser(url);
}

function extractLocalUrl(outputChunk) {
  const urlMatch = outputChunk.match(/https?:\/\/[^\s]+/);
  return urlMatch?.[0] ?? null;
}

async function launchBrowser(url) {
  const browserExecutable = await findBrowserExecutable();

  if (!browserExecutable) {
    console.warn('[dev] Ingen understøttet browser blev fundet. Åbn appen manuelt:', url);
    clearLaunchTimeout();
    return;
  }

  browserProfileDir = await mkdtemp(path.join(os.tmpdir(), 'mineo-dev-browser-'));

  const browserArgs = getBrowserArgs(browserExecutable, url, browserProfileDir);
  browserProcess = spawn(browserExecutable, browserArgs, {
    cwd: projectRoot,
    detached: false,
    stdio: 'ignore',
    windowsHide: false,
  });

  browserProcess.on('exit', () => {
    browserProcess = null;
  });

  browserProcess.on('error', (error) => {
    console.warn('[dev] Browser-vinduet kunne ikke startes automatisk:', error);
  });

  clearLaunchTimeout();
}

async function findBrowserExecutable() {
  const candidates = getBrowserCandidates();

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getBrowserCandidates() {
  if (process.platform === 'win32') {
    return [
      path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.ProgramFiles ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.ProgramFiles ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
  }

  if (process.platform === 'darwin') {
    return [
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];
  }

  return [
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
}

function getBrowserArgs(browserExecutable, url, profileDir) {
  const executableName = path.basename(browserExecutable).toLowerCase();

  if (executableName.includes('edge') || executableName.includes('chrome') || executableName.includes('chromium')) {
    return [
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--new-window',
      `--app=${url}`,
    ];
  }

  return [url];
}

async function fileExists(targetPath) {
  if (!targetPath) {
    return false;
  }

  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function shutdownBrowser() {
  if (browserProcess?.pid) {
    await terminateBrowserProcess(browserProcess.pid);
  }

  browserProcess = null;

  if (browserProfileDir) {
    try {
      await rm(browserProfileDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('[dev] Midlertidig browserprofil kunne ikke ryddes op:', error);
    }

    browserProfileDir = null;
  }
}

function clearLaunchTimeout() {
  if (browserLaunchTimeout) {
    clearTimeout(browserLaunchTimeout);
    browserLaunchTimeout = null;
  }
}

async function terminateBrowserProcess(pid) {
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });

      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
    });
    return;
  }

  browserProcess?.kill('SIGTERM');

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      browserProcess?.kill('SIGKILL');
      resolve();
    }, 2_000);

    browserProcess?.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
