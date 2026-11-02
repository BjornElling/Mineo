/**
 * Kører fra HTML før appens modultræ hentes. En tidligere versionscache og fravær af den nye
 * builds precache viser, at dette er en opdatering, ikke et førstegangsbesøg eller en normal opstart.
 * Cache Storage aflæses kun; workerens cache- og filforløb ændres ikke.
 */
export const createStartupUpdateScreenScript = (version: string): string => `
(function () {
  var screen = document.getElementById('mineo-startup-update');
  if (!screen || !('caches' in window)) return;
  caches.keys().then(function (names) {
    var prefix = 'mineo-build-assets:';
    if (!names.some(function (name) { return name.indexOf(prefix) === 0; })) return;
    var current = prefix + ${JSON.stringify(version)};
    function show() {
      if (screen.dataset.closed || !screen.hidden) return;
      screen.dataset.shownAt = String(performance.now());
      screen.hidden = false;
    }
    if (names.indexOf(current) === -1) { show(); return; }
    // Cachen oprettes før addAll. Dens navn alene beviser ikke, at installationen lykkedes.
    // addAll skriver atomisk, så den hash-navngivne entry er bevis for den komplette precache.
    var entry = document.querySelector('script[type="module"][src]');
    if (!entry) return;
    return caches.match(entry.src, { cacheName: current }).then(function (cached) {
      if (!cached && names.some(function (name) { return name.indexOf(prefix) === 0 && name !== current; })) show();
    });
  }).catch(function () {});
})();`;

/** Visningen ejer hverken worker-aktivering, genindlæsning eller brugerens fil. */
export const createStartupUpdateScreen = (): Readonly<{
  show: () => void;
  waitForMinimumDisplay: () => Promise<void>;
  close: () => void;
}> => {
  let closed = false;

  const getScreen = (): HTMLElement | null => document.getElementById('mineo-startup-update');

  return {
    show: () => {
      const screen = getScreen();
      if (closed || !screen || !screen.hidden) return;
      screen.dataset.shownAt = String(performance.now());
      screen.hidden = false;
    },
    waitForMinimumDisplay: async () => {
      const screen = getScreen();
      if (!screen || screen.hidden) return;
      const shownAt = Number(screen.dataset.shownAt);
      if (!Number.isFinite(shownAt)) return;
      const remaining = 1000 - (performance.now() - shownAt);
      if (remaining > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, Math.ceil(remaining)));
    },
    // Et sent worker-svar må ikke lægge venteskærmen oven på en allerede startet session.
    // React erstatter selve skærmen ved sit første render, også på opstartens fejlsti.
    close: () => {
      closed = true;
      const screen = getScreen();
      if (screen) screen.dataset.closed = 'true';
    },
  };
};
