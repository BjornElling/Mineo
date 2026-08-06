// @vitest-environment jsdom
import { getCurrentYear } from '../../../config/dateRanges';
import { satserAngivAarYearBounds } from '../../../data/lovbestemteRates';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { initializeInputRuntime } from '../../../inputCore/runtime/initializeInputRuntime';
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import { resolveSatserDefaultAargang } from '../../../domain/policies/satserCalculations';
import { seedSatserNewCase } from '../../../domain/satser/satserNewCaseSeed';

// §1.12/brugerbeslutning: en frisk sag seedes med default-satsåret som ægte committed input (ikke skygge-visning).
//
// Efter R5-F02 leverer seeden kun sin SEKTIONSVÆRDI; `initializeInputRuntime` ejer konstruktionen af
// aggregatet og re-validerer gennem kataloget. Testen går derfor gennem den ægte bootstrap-vej frem for at
// kalde seeden med en rå `SettledInput` — det er samtidig stærkere evidens: den beviser, at værdien faktisk
// LANDER i den hydrerede baseline, hvor den gamle udgave kun beviste, at seeden byggede et gyldigt objekt.

const catalog = getProductionInputCatalog();
const { minYear, maxYear } = satserAngivAarYearBounds;

const hydrateFreshCase = () => {
  sessionStorage.clear();
  const store = __createSlimInputTestStore();
  const startup = initializeInputRuntime(store, catalog, { seedNewCase: seedSatserNewCase });
  return { store, startup };
};

describe('seedSatserNewCase (§1.12)', () => {
  it('leverer default-satsåret som en sektionsværdi', () => {
    const expected = resolveSatserDefaultAargang(getCurrentYear(), minYear, maxYear);
    expect(seedSatserNewCase()).toEqual({ satser: { aargang: expected } });
  });

  it('lander i den hydrerede baseline og validerer gennem kataloget', () => {
    const { store, startup } = hydrateFreshCase();
    const expected = resolveSatserDefaultAargang(getCurrentYear(), minYear, maxYear);

    expect(startup.notice).toBeNull();
    expect(store.getState().input.sections.satser).toEqual({ aargang: expected });
    // Seeden er inden for satsintervallet, så den giver ingen rejected rå tekst.
    expect(store.getState().input.rejectedInputs).toEqual({});
  });

  it('det seedede år er inden for satsintervallet (ingen bounds-fejl på start)', () => {
    const { store } = hydrateFreshCase();
    const year = store.getState().input.sections.satser?.aargang;

    expect(year).toBeDefined();
    if (year !== undefined) {
      expect(year).toBeGreaterThanOrEqual(minYear);
      expect(year).toBeLessThanOrEqual(maxYear);
    }
  });

  it('lader de øvrige sektioner urørte — seeden kan ikke bygge aggregatet selv (R5-F02)', () => {
    const { store } = hydrateFreshCase();
    const sections = store.getState().input.sections;

    for (const [key, value] of Object.entries(sections)) {
      if (key === 'satser') continue;
      expect(value, `${key} skal fortsat være tom i en frisk sag`).toBeNull();
    }
  });
});
