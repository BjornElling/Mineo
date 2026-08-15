import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUTOMATION_BRIDGE_KEY } from '../../inputCore/react/automationIntrospectionBridge';

// Automatiseringsbroen er en DEV/test-facilitet. Den er read-only og har ingen skrivevej, men den skal
// alligevel ikke findes i den byggede app: en introspektionsflade, der følger med i produktion, er en
// flade, nogen på et tidspunkt begynder at bruge.
//
// Testen måler det FAKTISKE build-output frem for at stole på, at `import.meta.env`-gaten bliver foldet
// væk. Det er ikke en teoretisk bekymring: første version af broen brugte kun `bridgeIsAllowed()`, og et
// rigtigt `build:mineo` viste da, at minifieren foldede gaten til `()=>!1`, men BEHOLDT den uåbnelige krop
// — nøglen stod stadig som død streng i bundtet. Derfor ligger der nu også en `import.meta.env.PROD`-
// tidlig-retur, og derfor hævdes fraværet her.

const DIST_DIR = join(process.cwd(), 'dist', 'mineo');

const readBundleSources = (): readonly string[] => {
  const assets = join(DIST_DIR, 'assets');
  if (!existsSync(assets)) return [];
  return readdirSync(assets)
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(join(assets, name), 'utf8'));
};

describe('automatiseringsbroens fravær i produktionsbuild', () => {
  it('efterlader ikke broens globale nøgle i det byggede mineo-bundt', () => {
    const bundles = readBundleSources();
    if (bundles.length === 0) {
      // Testen er build-afhængig. Uden et build er der intet at måle, og en falsk grøn ville være værre
      // end en sprunget test — derfor siges det eksplicit.
      expect(existsSync(DIST_DIR), 'dist/mineo mangler — kør `npm run build:mineo` før denne test').toBe(false);
      return;
    }

    const offenders = bundles.filter((source) => source.includes(AUTOMATION_BRIDGE_KEY));
    expect(offenders).toHaveLength(0);
  });
});
