#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

const SESSION_SCHEMA_VERSION = 1;
const STALE_LEASE_MS = 15 * 60 * 1000;
const CLOCK_GAP_MS = 5 * 60 * 1000;
const MAX_EVENTS = 100;

const command = process.argv[2];
const options = parseOptions(process.argv.slice(3));
const repoRoot = path.resolve(options.repo ?? process.cwd());
const sessionDirectory = path.join(repoRoot, 'test-results', 'runtime-input-audit');
const sessionPath = path.join(sessionDirectory, 'session.json');
const sessionBackupPath = `${sessionPath}.previous`;
const sessionTemporaryPath = `${sessionPath}.tmp`;

try {
  const result = await runCommand(command);
  printResult(result);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Audit-session fejlede: ${message}`);
  process.exitCode = 1;
}

async function runCommand(selectedCommand) {
  switch (selectedCommand) {
    case 'begin':
      return beginSession();
    case 'heartbeat':
      return updateHeartbeat();
    case 'complete':
      return completeWorkUnit();
    case 'recover':
      return markRecoveryRequired();
    case 'resume':
      return resumeSession();
    case 'status':
      return readStatus();
    case 'help':
    case undefined:
      return help();
    default:
      throw new Error(`Ukendt kommando '${selectedCommand}'. Brug 'help' for syntaks.`);
  }
}

async function beginSession() {
  const scenario = requireOption('scenario');
  const startState = requireOption('start-state');
  const existing = await loadSession();

  if (existing?.status === 'active') {
    const gapMs = getClockGapMs(existing);
    if (gapMs < STALE_LEASE_MS) {
      throw new Error(
        `Der findes allerede en aktiv arbejdsenhed '${existing.scenario}' `
        + `(sidst heartbeat ${formatDuration(gapMs)} siden). Genbrug ikke en ny arbejdsenhed.`,
      );
    }

    await saveSession({
      ...existing,
      status: 'recovery-required',
      updatedAt: nowIso(),
      events: addEvent(existing.events, {
        type: 'stale-lease-detected',
        at: nowIso(),
        clockGapMs: gapMs,
      }),
    });
    throw new Error(
      `Den tidligere arbejdsenhed '${existing.scenario}' har et ${formatDuration(gapMs)} `
      + 'gammelt heartbeat. Kør recover og resume, og gentag hele arbejdsenheden fra ren tilstand.',
    );
  }

  if (existing?.status === 'recovery-required') {
    throw new Error(
      `Arbejdsenheden '${existing.scenario}' kræver genoptagelse. Kør 'recover' og derefter 'resume'.`,
    );
  }

  if (existing?.status === 'ready' && existing.nextScenario !== scenario) {
    throw new Error(
      `Næste arbejdsenhed er '${existing.nextScenario}', men der blev bedt om '${scenario}'. `
      + 'Følg den faste rækkefølge i STATUS.md.',
    );
  }

  const startedAt = nowIso();
  const session = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    status: 'active',
    leaseId: randomUUID(),
    startedAt,
    updatedAt: startedAt,
    lastHeartbeatAt: startedAt,
    scenario,
    startState,
    browser: options.browser ?? 'ikke specificeret',
    viewport: options.viewport ?? 'ikke specificeret',
    stage: 'Arbejdsenhed startet',
    recoveryCount: existing?.recoveryCount ?? 0,
    nextScenario: null,
    nextStartState: null,
    events: addEvent(existing?.events, {
      type: 'begin',
      at: startedAt,
      scenario,
      startState,
    }),
  };

  await saveSession(session);
  return {
    message: `Arbejdsenhed startet: ${scenario}`,
    session,
  };
}

async function updateHeartbeat() {
  const session = await requireSession();
  if (session.status !== 'active') {
    throw new Error(`Heartbeat kan ikke skrives, når sessionen er '${session.status}'.`);
  }

  const heartbeatAt = nowIso();
  const updated = {
    ...session,
    updatedAt: heartbeatAt,
    lastHeartbeatAt: heartbeatAt,
    stage: options.stage ?? options.note ?? session.stage,
    events: addEvent(session.events, {
      type: 'heartbeat',
      at: heartbeatAt,
      stage: options.stage ?? options.note ?? session.stage,
    }),
  };

  await saveSession(updated);
  return {
    message: `Heartbeat: ${updated.stage}`,
    session: updated,
  };
}

async function completeWorkUnit() {
  const session = await requireSession();
  if (session.status !== 'active') {
    throw new Error(`Kun en aktiv arbejdsenhed kan afsluttes; status er '${session.status}'.`);
  }

  const nextScenario = requireOption('next-scenario');
  const nextStartState = requireOption('next-start-state');
  const completedAt = nowIso();
  const updated = {
    ...session,
    status: 'ready',
    updatedAt: completedAt,
    lastHeartbeatAt: completedAt,
    completedAt,
    completedScenario: session.scenario,
    nextScenario,
    nextStartState,
    stage: 'Arbejdsenhed afsluttet; næste arbejdsenhed er klar',
    events: addEvent(session.events, {
      type: 'complete',
      at: completedAt,
      completedScenario: session.scenario,
      nextScenario,
      nextStartState,
    }),
  };

  await saveSession(updated);
  return {
    message: `Arbejdsenhed afsluttet: ${session.scenario}`,
    session: updated,
  };
}

async function markRecoveryRequired() {
  const session = await requireSession();
  if (session.status === 'ready') {
    return {
      message: 'Ingen aktiv arbejdsenhed kræver recovery; næste arbejdsenhed er klar.',
      session,
    };
  }

  if (session.status === 'recovery-required') {
    return {
      message: `Recovery er allerede markeret for '${session.scenario}'.`,
      session,
    };
  }

  const gapMs = getClockGapMs(session);
  const recoveredAt = nowIso();
  const updated = {
    ...session,
    status: 'recovery-required',
    updatedAt: recoveredAt,
    recoveryReason: options.reason ?? inferRecoveryReason(gapMs),
    recoveryClockGapMs: gapMs,
    events: addEvent(session.events, {
      type: 'recovery-required',
      at: recoveredAt,
      reason: options.reason ?? inferRecoveryReason(gapMs),
      clockGapMs: gapMs,
    }),
  };

  await saveSession(updated);
  return {
    message: `Recovery markeret for '${session.scenario}' efter ${formatDuration(gapMs)} uden heartbeat.`,
    session: updated,
  };
}

async function resumeSession() {
  const session = await requireSession();
  const gapMs = getClockGapMs(session);

  if (session.status === 'active' && gapMs < STALE_LEASE_MS) {
    throw new Error(
      `Sessionen ser stadig aktiv ud (sidste heartbeat ${formatDuration(gapMs)} siden). `
      + 'Kør ikke resume oven på en muligvis levende arbejdsenhed.',
    );
  }

  if (session.status === 'ready') {
    throw new Error(
      `Der er ingen afbrudt arbejdsenhed at resume. Start næste scenarie '${session.nextScenario}'.`,
    );
  }

  const resumedAt = nowIso();
  const updated = {
    ...session,
    status: 'active',
    leaseId: randomUUID(),
    updatedAt: resumedAt,
    lastHeartbeatAt: resumedAt,
    recoveryCount: (session.recoveryCount ?? 0) + 1,
    stage: 'Arbejdsenhed genoptaget; gentages fra ren tilstand',
    events: addEvent(session.events, {
      type: 'resume',
      at: resumedAt,
      previousLeaseId: session.leaseId,
      previousClockGapMs: gapMs,
    }),
  };

  await saveSession(updated);
  return {
    message: `Arbejdsenhed genoptaget: ${session.scenario}`,
    session: updated,
  };
}

async function readStatus() {
  const session = await loadSession();
  if (!session) {
    return { message: 'Ingen audit-session er registreret.', session: null };
  }

  return {
    message: `Sessionstatus: ${session.status}; sidste heartbeat ${formatDuration(getClockGapMs(session))} siden.`,
    session: {
      ...session,
      currentClockGapMs: getClockGapMs(session),
      currentClockGap: formatDuration(getClockGapMs(session)),
    },
  };
}

function help() {
  return {
    message: [
      'Audit-session lease/checkpoint:',
      "  begin --repo . --scenario ID --start-state '...' [--browser chrome --viewport 1536x864]",
      "  heartbeat --repo . --stage '...'",
      "  complete --repo . --next-scenario ID --next-start-state '...'",
      "  recover --repo . --reason 'sleep, netværk eller tool-afbrydelse'",
      '  resume --repo .',
      '  status --repo .',
    ].join('\n'),
  };
}

async function requireSession() {
  const session = await loadSession();
  if (!session) {
    throw new Error("Ingen session fundet. Kør 'begin' for den første arbejdsenhed.");
  }
  return session;
}

async function loadSession() {
  const candidates = [sessionPath, sessionTemporaryPath, sessionBackupPath];
  for (const candidate of candidates) {
    try {
      const content = await readFile(candidate, 'utf8');
      const parsed = JSON.parse(content);
      validateSession(parsed, candidate);
      return parsed;
    } catch (error) {
      if (isMissingFile(error)) continue;
      if (error instanceof SyntaxError || error instanceof TypeError) continue;
      if (error instanceof Error && error.message.startsWith('Ugyldig audit-session')) continue;
      throw error;
    }
  }
  return null;
}

async function saveSession(session) {
  validateSession(session, 'ny session');
  await mkdir(sessionDirectory, { recursive: true });
  await writeFile(sessionTemporaryPath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');

  let previousMoved = false;
  try {
    await unlink(sessionBackupPath).catch(ignoreMissingFile);
    await rename(sessionPath, sessionBackupPath).then(() => { previousMoved = true; }).catch((error) => {
      if (!isMissingFile(error)) throw error;
    });
    await rename(sessionTemporaryPath, sessionPath);
    await unlink(sessionBackupPath).catch(ignoreMissingFile);
  } catch (error) {
    if (previousMoved) {
      await unlink(sessionPath).catch(ignoreMissingFile);
      await rename(sessionBackupPath, sessionPath).catch(() => undefined);
    }
    await unlink(sessionTemporaryPath).catch(ignoreMissingFile);
    throw error;
  }
}

function validateSession(session, source) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    throw new TypeError(`Ugyldig audit-session i ${source}.`);
  }
  if (session.schemaVersion !== SESSION_SCHEMA_VERSION) {
    throw new TypeError(`Ugyldig audit-session-version i ${source}.`);
  }
  if (!['active', 'ready', 'recovery-required'].includes(session.status)) {
    throw new TypeError(`Ugyldig audit-session-status i ${source}.`);
  }
  for (const key of ['leaseId', 'startedAt', 'updatedAt', 'lastHeartbeatAt']) {
    if (typeof session[key] !== 'string' || session[key].length === 0) {
      throw new TypeError(`Ugyldig audit-session-felt '${key}' i ${source}.`);
    }
  }
}

function parseOptions(argumentsList) {
  const parsed = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith('--')) {
      throw new Error(`Uventet argument '${argument}'.`);
    }

    const separatorIndex = argument.indexOf('=');
    if (separatorIndex !== -1) {
      parsed[argument.slice(2, separatorIndex)] = argument.slice(separatorIndex + 1);
      continue;
    }

    const key = argument.slice(2);
    const next = argumentsList[index + 1];
    if (next && !next.startsWith('--')) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function requireOption(name) {
  const value = options[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Påkrævet option mangler: --${name}.`);
  }
  return value.trim();
}

function addEvent(events, event) {
  return [...(Array.isArray(events) ? events : []), event].slice(-MAX_EVENTS);
}

function getClockGapMs(session) {
  const timestamp = Date.parse(session.lastHeartbeatAt);
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - timestamp);
}

function inferRecoveryReason(gapMs) {
  return gapMs >= CLOCK_GAP_MS
    ? 'wall-clock-gap; kontrollér Windows sleep/wake og netværk'
    : 'forbindelses- eller tool-afbrydelse';
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return 'ukendt tid';
  const totalSeconds = Math.floor(milliseconds / 1000);
  if (totalSeconds < 60) return `${totalSeconds} sekunder`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} minutter`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} timer` : `${hours} timer og ${minutes} minutter`;
}

function nowIso() {
  return new Date().toISOString();
}

function isMissingFile(error) {
  return error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
}

function ignoreMissingFile(error) {
  if (!isMissingFile(error)) throw error;
}

function printResult(result) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(result.message);
  if (result.session) {
    console.log(`  scenarie: ${result.session.scenario ?? result.session.nextScenario ?? '—'}`);
    console.log(`  status: ${result.session.status}`);
    console.log(`  lease: ${result.session.leaseId}`);
    if (result.session.currentClockGap) console.log(`  siden heartbeat: ${result.session.currentClockGap}`);
  }
}
