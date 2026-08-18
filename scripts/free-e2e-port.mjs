import { setTimeout as delay } from 'node:timers/promises';
import process from 'node:process';

import { IDENTITY_PATH, SERVER_IDENTITY } from './e2e-server-identity.mjs';

/**
 * Rydder en efterladt E2E-buildserver væk, før Playwright starter en ny.
 *
 * Baggrunden er en konkret fælde: afbrydes en kørsel undervejs — et værktøjstimeout, Ctrl+C, en
 * lukket terminal — dør Playwright, men buildserveren bliver siddende på porten. Den NÆSTE kørsel
 * fejler så øjeblikkeligt med «http://127.0.0.1:4173 is already used», hvilket ligner et
 * konfigurationsproblem og ikke det, det er. Uden oprydning kan man ikke køre suiten igen uden
 * manuelt at finde og dræbe en proces.
 *
 * Oprydningen er bevidst snæver: kun en proces, der SELV svarer, at den er Mineos E2E-buildserver,
 * bliver lukket. Holder noget andet porten, stopper vi med en forklaring i stedet for at dræbe en
 * proces, vi ikke ejer.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';

// Kører suiten mod en server, brugeren selv har startet, er porten ikke vores at rydde op i.
if (process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1' || process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1') {
  process.exit(0);
}

const identify = async () => {
  let response;
  try {
    response = await fetch(new URL(IDENTITY_PATH, baseURL), { signal: AbortSignal.timeout(2_000) });
  } catch {
    // Ingen forbindelse: porten er fri. Også et timeout lander her — en port, der ikke svarer
    // inden for to sekunder, kan vi alligevel ikke identificere som vores egen.
    return { state: 'free' };
  }

  // Der ER noget på porten. Svarer det ikke med vores egen markør, er det ikke vores at lukke —
  // heller ikke selv om det svarer med en HTML-side, som en ældre udgave af serveren ville gøre.
  if (!response.ok) return { state: 'foreign' };
  try {
    const body = await response.json();
    return body?.server === SERVER_IDENTITY && Number.isInteger(body?.pid)
      ? { state: 'mineo', pid: body.pid }
      : { state: 'foreign' };
  } catch {
    return { state: 'foreign' };
  }
};

const waitUntilFree = async (deadlineMs) => {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    await delay(200);
    if ((await identify()).state === 'free') return true;
  }
  return false;
};

const identity = await identify();

if (identity.state === 'free') {
  process.exit(0);
}

if (identity.state === 'foreign') {
  console.error(
    `Porten i ${baseURL} er optaget af en proces, der ikke er Mineos E2E-buildserver.\n`
    + 'Luk den proces, eller peg kørslen et andet sted hen med PLAYWRIGHT_BASE_URL.',
  );
  process.exit(1);
}

console.log(`Lukker en efterladt E2E-buildserver (pid ${identity.pid}) på ${baseURL}.`);
try {
  process.kill(identity.pid, 'SIGTERM');
} catch (error) {
  console.error(`Kunne ikke lukke pid ${identity.pid}: ${error.message}`);
  process.exit(1);
}

if (!(await waitUntilFree(5_000))) {
  console.error(`Pid ${identity.pid} slap ikke porten inden for fem sekunder. Luk den manuelt.`);
  process.exit(1);
}
