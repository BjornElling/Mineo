/**
 * Registret over de fejl, Vite har meldt som en manglende lazy chunk.
 *
 * Findes, fordi en manglende chunk og en ægte programfejl ser ens ud på kaldestedet: begge kommer
 * ud af et `await import(...)` som en almindelig `Error`. Uden en skelnen bliver en deploy-betinget,
 * brugerrettelig tilstand rapporteret som systemfejl – præcis dét, `app-shell-contract.md`
 * §Kendte Undtagelser 4 siger, at `vite:preloadError`-linjen skal forhindre.
 *
 * Skelnen sker på IDENTITET, ikke på fejltekst. Vite videregiver den samme `Error`-instans til
 * `vite:preloadError`-eventet, som den bagefter kaster, så et opslag i dette register er præcist –
 * modsat en match på browserspecifikke strenge ("Failed to fetch dynamically imported module",
 * "Importing a module script failed", …), som ikke er del af nogen spec.
 *
 * Modulet ligger i `src/utils`, fordi begge ender er uden for hinandens lag: `apps/shared` markerer,
 * og den app-uafhængige dokument-livscyklus spørger. En fælles, neutral placering er den eneste, der
 * ikke tvinger dokumentkernen til at kende en app-bootstrap.
 */

/**
 * `WeakSet` frem for en liste: registret må aldrig holde liv i en fejl (med dens stack og closure)
 * længere end kaldestedet selv gør.
 */
const lazyChunkFailures = new WeakSet<Error>();

/** Kaldes af `vite:preloadError`-lytteren, umiddelbart før Vite kaster fejlen videre. */
export const markLazyChunkFailure = (error: Error): void => {
  lazyChunkFailures.add(error);
};

/**
 * Er denne fejl en manglende lazy chunk? `false` for alt andet – inklusive en fejl med samme
 * ordlyd, som ikke kom fra Vites egen lazy-load.
 */
export const isLazyChunkFailure = (error: unknown): boolean =>
  error instanceof Error && lazyChunkFailures.has(error);
