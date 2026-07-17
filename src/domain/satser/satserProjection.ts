import { getSatserForYear } from '../../data/lovbestemteRates';
import { satserAargangField } from '../../inputCore/catalog/satserDescriptors';
import type { InputReader } from '../../inputCore/inputReader';
import { runProjection, type ProjectionResult } from '../../inputCore/projection';

// Greenfield Satser-projektion (§3.4/§3.9, Fase 3-slice). En ALMINDELIG ren funktion over den offentlige
// `InputReader`: den kræver satsårets felt og udleder satserne. Ingen legacy `InputBlocker`/`sectionScope`/
// `documentGateFromBlockers`-lag — dependency og blokering følger af det ene felt, funktionen faktisk læser.
//
// De tre legacy-tilstande kollapser her:
//  - out-of-bounds år: codecet gør værdien til rejected råtekst (`range`) → et rødt feltissue → `require`
//    returnerer `unavailable` → blocked (§1.6). Ingen separat range-gren.
//  - tomt år: `require` udleder en `missing`-consumerfejl → blocked (§1.7).
//  - gyldigt år: `ready` med { year, satser }.

const CONSUMER_ID = 'satser';

const satserAargangRef = satserAargangField.bind();

export type SatserProjectionValue = Readonly<{
  year: number;
  satser: ReturnType<typeof getSatserForYear>;
}>;

export const projectSatser = (reader: InputReader): ProjectionResult<SatserProjectionValue> =>
  runProjection(reader, CONSUMER_ID, (collector): SatserProjectionValue => {
    const year = collector.require(satserAargangRef);
    // Er året utilgængeligt (rejected range / tomt), har `require` allerede registreret det blokerende issue;
    // `runProjection` returnerer da `blocked` og ignorerer denne værdi. `getSatserForYear` kaldes derfor kun for
    // et gyldigt år, og et vilkårligt dækket år på den døde gren ville alligevel aldrig blive observeret.
    // `require` udelukker tomt (missing), men feltets type er `number | undefined`; NaN dækker den døde gren.
    const resolvedYear = year.status === 'usable' && year.value !== undefined ? year.value : Number.NaN;
    return { year: resolvedYear, satser: getSatserForYear(resolvedYear) };
  });
