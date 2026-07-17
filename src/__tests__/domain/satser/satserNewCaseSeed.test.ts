import { CURRENT_YEAR } from '../../../config/dateRanges';
import { satserAngivAarYearBounds } from '../../../data/lovbestemteRates';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createEmptySettledInput } from '../../../inputCore/settledInput';
import { resolveSatserDefaultAargang } from '../../../domain/policies/satserCalculations';
import { seedSatserNewCase } from '../../../domain/satser/satserNewCaseSeed';

// §1.12/brugerbeslutning: en frisk sag seedes med default-satsåret som ægte committed input (ikke skygge-visning).
// Seeden skal give en envelope, der validerer gennem det ene produkt-katalog, så bootstrap-hydreringen holder.

const catalog = getProductionInputCatalog();
const { minYear, maxYear } = satserAngivAarYearBounds;

describe('seedSatserNewCase (§1.12)', () => {
  it('seeder default-satsåret som committed og validerer gennem kataloget', () => {
    const seeded = seedSatserNewCase(createEmptySettledInput());
    const expected = resolveSatserDefaultAargang(CURRENT_YEAR, minYear, maxYear);
    expect(seeded.sections.satser).toEqual({ aargang: expected });
    expect(() => catalog.validateSettledInput(seeded)).not.toThrow();
    // Seeden er inden for satsintervallet, så den giver ingen rejected rå tekst.
    expect(seeded.rejectedInputs).toEqual({});
  });

  it('det seedede år er inden for satsintervallet (ingen bounds-fejl på start)', () => {
    const seeded = seedSatserNewCase(createEmptySettledInput());
    const year = seeded.sections.satser?.aargang;
    expect(year).toBeDefined();
    if (year !== undefined) {
      expect(year).toBeGreaterThanOrEqual(minYear);
      expect(year).toBeLessThanOrEqual(maxYear);
    }
  });
});
