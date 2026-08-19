import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTENT_BOX_WIDTH_PX } from '../../utils/uiScale';

/**
 * Værn mod at arbejdsfladens pladsregnskab og den faktiske indholdsbredde falder fra hinanden.
 *
 * `.content-box` er det bredeste element på hver eneste side, og `CONTENT_UI_SCALE_POLICY` afgør
 * ud fra netop den bredde, hvor meget arbejdsfladen skal skaleres for at kunne være i vinduet.
 * Bredden bor i CSS (den visuelle regel) og spejles i TypeScript (regnestykket). Ændres den ene
 * uden den anden, vil skaleringen enten klippe indholdet eller efterlade unødigt tom plads –
 * begge dele uden at nogen anden test bliver rød.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const layoutCssPath = join(repoRoot, 'src', 'styles', 'layout.css');

describe('contentBoxWidthSingleSource', () => {
  it('holder --content-box-max-width og CONTENT_BOX_WIDTH_PX i sync', () => {
    const layoutCss = readFileSync(layoutCssPath, 'utf8');
    const declaration = /--content-box-max-width:\s*(\d+(?:\.\d+)?)px;/.exec(layoutCss);

    expect(declaration).not.toBeNull();
    expect(Number(declaration?.[1])).toBe(CONTENT_BOX_WIDTH_PX);
  });

  it('bruger variablen som indholdsboksens faktiske bredde', () => {
    const layoutCss = readFileSync(layoutCssPath, 'utf8');

    expect(layoutCss).toContain('width: var(--content-box-max-width);');
  });
});
