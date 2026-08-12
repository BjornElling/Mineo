import { VERSION } from '../../config/buildInfo';
import { getBootReloadVersionStorageKey } from '../../config/storageManifest';
import { awaitDurablePendingPwaFileOpenHandoff } from '../../utils/pwaLaunchQueue';
import {
  readOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../../utils/safeSessionStorage';

/**
 * ÉT invariant styrer hele opdateringsmodellen:
 *
 *   «En ny session starter altid på den nyeste version, der kan klargøres KOMPLET.
 *    En åben session skifter aldrig version.»
 *
 * Derfor findes der hverken opdateringslinje, periodiske tjek eller nogen brugerhandling: en
 * opdatering er enten helt gennemført før render, eller den er slet ikke sket. Brugeren tager aldrig
 * stilling til en version, og en igangværende sag kan aldrig blive afbrudt af en ny build.
 *
 * To ting i service-worker-livscyklussen gør det muligt — og de trækker hver sin vej:
 *
 * - `SKIP_WAITING` er NØDVENDIG. En ventende worker aktiverer kun, når den gamle kontrollerer NUL
 *   klienter, og en almindelig genindlæsning når aldrig nul: det gamle dokument lever, indtil
 *   svarets headere er modtaget, så der er altid overlap. Uden `skipWaiting()` ville en installeret
 *   PWA, brugeren sjældent lukker helt, i praksis ALDRIG opdatere.
 * - `clients.claim()` er FORBUDT (fjernet i workeren). Med claim ville en nyaktiveret worker kunne
 *   overtage et ANDET fanebladss levende dokument og bryde invariantets anden halvdel.
 *
 * Sikkerheden ligger altså ikke i, om workeren kan aktiveres, men i HVORNÅR klienten beder om det:
 * udelukkende før render (`isBootPhase`), hvor der pr. definition ikke findes brugerarbejde, og
 * altid efterfulgt af en genindlæsning, så dokument og worker er samme build.
 *
 * Fail-safe, ikke fail-fast: kan den nye version ikke klargøres komplet (offline, netværksfejl,
 * mislykket precache, timeout), startes den NUVÆRENDE version uændret. En halv opdatering er værre
 * end en kendt, hel og lidt ældre version.
 */

/**
 * Loft over ventetiden på en ny builds precache. Det er et VÆRN mod at hænge, ikke en normal-vej:
 * ved uændret version ventes der slet ikke, og ved en reel opdatering afgør `installed`-tilstanden
 * — ikke uret — hvornår der genindlæses.
 */
const UPDATE_INSTALL_TIMEOUT_MS = 15000;
const ASSET_MANIFEST_PATH = '/pwa-assets.json';

let isBootPhase = true;

/**
 * Den udrullede builds version, læst uden om enhver cache.
 *
 * Fail-open: kan versionen ikke opløses, returneres `null`, og programmet kører videre uændret.
 * Et usikkert svar må aldrig udløse en genindlæsning — det ville påstå noget, vi ikke ved.
 */
const probeDeployedVersion = async (): Promise<string | null> => {
  try {
    const response = await fetch(ASSET_MANIFEST_PATH, { cache: 'no-store' });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const version = (payload as { version?: unknown } | null)?.version;
    return typeof version === 'string' && version.trim() !== '' ? version.trim() : null;
  } catch {
    return null;
  }
};

/**
 * Genindlæser til den udrullede version — præcis én gang pr. observeret version.
 *
 * Uden løkkeværnet ville en flappende eller fejlagtig versionsangivelse (fx to instanser bag en
 * load balancer midt i en deploy) sende programmet i en uendelig genindlæsningsløkke. Kan markøren
 * ikke skrives, genindlæses der derfor HELLER IKKE: et uspærret reload er værre end den lidt ældre
 * kode, det skulle rette. `writeOptionalSessionStorageValue` læser skrivningen tilbage, så et
 * tavst no-op-lager ikke kan forveksles med en succes.
 */
const reloadOnceForDeployedVersion = (deployedVersion: string): void => {
  const key = getBootReloadVersionStorageKey();

  /*
   * Markøren holder ALLE mål, der er forsøgt fra DENNE kildeversion — ikke blot «sidst sete version».
   *
   * En markør med kun ét mål ville blive overskrevet ved flappende svar bag en delvis udrullet CDN
   * (V1 ser V2 → reload → HTML stadig V1, ser V3 → reload → ser V2 igen …). Hvert svar ville se nyt
   * ud, og programmet ville reloade i ring. Med hele forsøgsmængden pr. kildeversion forsøges hvert
   * spring præcis én gang, og en flappende origin bringer os til ro på den nuværende version.
   *
   * Lykkes skiftet, er den nye kildeversion en anden, og dens egen forsøgsmængde er tom — så en
   * ægte efterfølgende deploy er aldrig blokeret af historik fra en tidligere version.
   */
  const stored = readOptionalSessionStorageValue(key);
  const attempted = stored === null ? [] : stored.split('|');
  const [storedSource, ...attemptedTargets] = attempted;

  const targets = storedSource === VERSION ? attemptedTargets : [];
  if (targets.includes(deployedVersion)) return;

  const nextMarker = [VERSION, ...targets, deployedVersion].join('|');
  if (!writeOptionalSessionStorageValue(key, nextMarker)) return;
  window.location.reload();
};

/**
 * Venter til den nye builds worker har en KOMPLET precache — dvs. har nået `installed`.
 *
 * Workeren installeres kun, når hele dens assetmanifest ligger i cache (`install`-handleren i
 * `sw/mineoServiceWorker.js`), så `installed` er præcis det signal, «komplet klargjort» betyder.
 * `redundant` betyder, at installationen mislykkedes — da må der ikke genindlæses.
 */
const waitForWorkerState = (
  worker: ServiceWorker,
  isDone: (state: ServiceWorker['state']) => boolean,
  remainingMs: number,
): Promise<boolean> => {
  if (isDone(worker.state)) return Promise.resolve(true);
  if (worker.state === 'redundant') return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timeoutId = 0;

    const settle = (value: boolean): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      worker.removeEventListener('statechange', onStateChange);
      resolve(value);
    };

    const onStateChange = (): void => {
      if (isDone(worker.state)) settle(true);
      // `redundant` betyder, at installationen eller aktiveringen mislykkedes — aldrig reload.
      else if (worker.state === 'redundant') settle(false);
    };

    timeoutId = window.setTimeout(() => settle(false), remainingMs);
    worker.addEventListener('statechange', onStateChange);
  });
};

/**
 * Bringer den nye build helt frem til AKTIV worker — ikke blot installeret.
 *
 * `installed` er IKKE en tilstrækkelig barriere for en genindlæsning. En installeret worker står i
 * `waiting`, og et dokument beholder sin controller hele sin levetid: genindlæser vi her, hentes den
 * nye HTML, men dokumentet kontrolleres fortsat af den GAMLE worker. Det nye dokument ville så se
 * `deployed === VERSION`, returnere med det samme — og den nye worker kunne blive stående waiting
 * i det uendelige.
 *
 * Rækkefølgen skal derfor være: komplet install → aktivér præcis denne worker → bekræft `activated`
 * → først dér genindlæs.
 */
const activateNewBuildWorker = async (registration: ServiceWorkerRegistration): Promise<boolean> => {
  const deadline = Date.now() + UPDATE_INSTALL_TIMEOUT_MS;
  const remaining = (): number => Math.max(0, deadline - Date.now());

  // Den konkrete worker fra dette forløb. `waiting` alene er ikke et versionsbevis, men
  // `activated`-bekræftelsen nedenfor gør, at kun en faktisk aktiv ny build kan udløse reload.
  const pending = registration.installing ?? registration.waiting;
  if (!pending) return false;

  // Trin 1: komplet precache. Workeren installeres kun, når HELE dens assetmanifest ligger i cache.
  if (!(await waitForWorkerState(pending, (state) => state === 'installed' || state === 'activated', remaining()))) {
    return false;
  }

  // Trin 2: aktivér. Uden dette forbliver workeren waiting, indtil ALLE klienter er lukket — hvilket
  // en almindelig genindlæsning aldrig opnår.
  if (pending.state !== 'activated') {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }

  // Trin 3: bekræft, at den nye worker faktisk ER aktiv, før dokumentet rives ned.
  return waitForWorkerState(pending, (state) => state === 'activated', remaining());
};

const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  // Query'en er cache-buster, ikke versionskilde: workerens egen version er indbagt i dens bytes,
  // så `registration.update()` kan opdage en deploy på den SAMME URL.
  const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(VERSION)}`;

  try {
    const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: '/',
      updateViaCache: 'none',
    });
    await registration.update();
    return registration;
  } catch (error) {
    console.warn('Service worker registrering/opdatering fejlede.', error);
    return null;
  }
};

const runBootUpdatePass = async (): Promise<void> => {
  // Gaten på opstartsfasen ligger HER, i det ene forløb: efter render må en ny worker aldrig
  // aktiveres, og en gate spredt ud over kaldsstederne ville før eller siden blive glemt ét af dem.
  if (!isBootPhase) return;

  const hadControllerAtBoot = navigator.serviceWorker.controller !== null;
  const registration = await registerServiceWorker();
  const deployedVersion = await probeDeployedVersion();

  // Uopløselig version (offline/fejl) eller uændret version: den normale, hurtige vej. Ingen
  // ventetid, ingen genindlæsning.
  if (deployedVersion === null || deployedVersion === VERSION) return;
  if (!registration) return;

  // Uden en controller ved opstart er der ingen GAMMEL worker, en ny kan vente på. Dokumentet kører
  // allerede den HTML, origin lige leverede, og dets assets hentes fra netværket. Et reload ville
  // hverken skifte kode eller vinde en versionscache for netop dette dokument — kun koste brugeren
  // en ekstra opstart. Cachen er på plads fra næste opstart.
  if (!hadControllerAtBoot) return;

  // Der ER en ny version. Den må først tages i brug, når den er komplet precachet OG faktisk aktiv —
  // ellers har vi byttet «brugeren skal klikke» ud med «brugeren kan lande i en halv version» eller
  // i et nyt dokument under den gamle worker.
  if (!(await activateNewBuildWorker(registration))) return;

  // Sidste tjek før dokumentet rives ned: en `.eo`-fil, browseren afleverede få millisekunder
  // forinden, kan stadig være undervejs til IndexedDB. Kan den durable handoff ikke bekræftes, må
  // der ikke genindlæses — brugerens fil vejer tungere end at komme på nyeste version med det samme.
  // Opdateringen sker så ved næste opstart.
  if (!(await awaitDurablePendingPwaFileOpenHandoff())) return;

  reloadOnceForDeployedVersion(deployedVersion);
};

/**
 * Opstartens ene opdateringsbarriere. Kaldes før render, så en opdatering enten er helt gennemført
 * eller slet ikke sket, når brugeren ser programmet.
 */
export const ensureLatestVersionBeforeRender = async (): Promise<void> => {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  try {
    await runBootUpdatePass();
  } catch {
    // Fail-safe: enhver uventet fejl i opdateringsforløbet må aldrig forhindre programmet i at
    // starte på den version, der allerede er hentet.
  } finally {
    isBootPhase = false;
  }
};

/** Kun testinfrastruktur må nulstille den modulglobale opstartstilstand. */
export const __resetServiceWorkerBootstrapForTests = (): void => {
  isBootPhase = true;
};
