import { getSatserForYear } from '../../data/lovbestemteRates';
import { satserAargangField } from '../../inputCore/catalog/satserDescriptors';
import type { InputReader } from '../../inputCore/inputReader';
import { runProjection, type ProjectionResult } from '../../inputCore/projection';

// Satser-projektionen (§3.4/§3.9, Fase 3-slice). En ALMINDELIG ren funktion over den offentlige
// `InputReader`: den kræver satsårets felt og udleder satserne. Ingen legacy `InputBlocker`/`sectionScope`/
// `documentGateFromBlockers`-lag — dependency og blokering følger af det ene felt, funktionen faktisk læser.
//
// De tre legacy-tilstande kollapser her:
//  - out-of-bounds år: værdien committes canonical, men en bounds-feltvalidator giver et rødt feltissue, som
//    readeren skjuler → `require` returnerer `unavailable` → blocked (§1.6). Værdien kan stadig gemmes i `.eo`.
//  - tomt år: `require` udleder en `missing`-consumerfejl → blocked (§1.7).
//  - gyldigt år: `ready` med { year, satser }.

const CONSUMER_ID = 'satser';

const satserAargangRef = satserAargangField.bind();

export type SatserProjectionValue = Readonly<{
  year: number;
  satser: ReturnType<typeof getSatserForYear>;
}>;

export const projectSatser = (reader: InputReader): ProjectionResult<SatserProjectionValue> => {
  const result = runProjection<SatserProjectionValue | null>(reader, CONSUMER_ID, (collector) => {
    const year = collector.require(satserAargangRef);
    if (year.status !== 'usable' || year.value === undefined) return null;
    return { year: year.value, satser: getSatserForYear(year.value) };
  });
  if (result.status === 'blocked') return result;
  if (result.value === null) {
    throw new Error('Satser-projektionen blev ready uden et anvendeligt satsår.');
  }
  return Object.freeze({ ...result, value: result.value });
};
