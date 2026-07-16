import { getSatserForYear } from '../../data/lovbestemteRates';
import { satserAargangBinding } from '../../input/catalog/satserInputBindings';
import { ALLOW_SAVE_INPUT_ISSUE_POLICY, createFieldInputIssue } from '../../input/inputIssue';
import type { InputReader } from '../../input/inputReader';
import {
  createInputProjectionSpec,
  createInputProjectionValidator,
  evaluateInputProjection,
  inputProjectionFinding,
  requiredInput,
  type InputProjection,
} from '../../input/inputProjection';

/**
 * Satser-domænets læseprojektion bygget på den greenfield Fase-2 input-kerne (`src/input/`) — den
 * migrerede efterfølger til `buildSatserInputProjection` (hånd-rullet på `domain/inputIntegrity/`).
 *
 * Semantikken er bevaret 1:1 (bevist i `satserProjectionEquivalence.test.ts`):
 *  - afsluttet ugyldigt `aargang` (rejected input) → dependency uresolveret → `invalid`-blocker,
 *  - manglende `aargang` (canonical undefined) → `requiredInput`-guard fejler → `missing`-blocker,
 *  - `aargang` uden for [minYear, maxYear] → range-validator → `range`-blocker (parsebar men afvist),
 *  - ellers `ready` med det valgte år + satstabellen.
 *
 * `aargang`-intervallet er et afledt issue (validator), ikke en codec-regel, jf. §3.4 — codecet afgør
 * kun canonical parsebarhed. Ingen tidligere gyldig værdi kan nå `ready.data`, når feltet er ugyldigt.
 */
export type SatserProjectionData = Readonly<{
  year: number;
  satser: ReturnType<typeof getSatserForYear>;
}>;

const aargangRef = satserAargangBinding.createRef();

const isPresentYear = (value: number | undefined): value is number => value !== undefined;

// Manglende satsår blokerer dokumentet (severity error) men ikke `.eo`-save (samme som i dag: den
// hånd-rullede inputIntegrity-blocker driver kun dokument-gaten, ikke save-gaten).
const aargangDependency = requiredInput(aargangRef, isPresentYear, {
  missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
});

const createSatserProjectionSpec = (minYear: number, maxYear: number) =>
  createInputProjectionSpec({
    dependencies: { aargang: aargangDependency },
    validators: [
      createInputProjectionValidator({
        dependencies: { aargang: aargangDependency },
        validate: ({ aargang }) =>
          aargang < minYear || aargang > maxYear
            ? [
                inputProjectionFinding(
                  createFieldInputIssue({
                    field: aargangRef,
                    reason: 'range',
                    severity: 'error',
                    code: 'satser.aargang.range',
                    message: `Årstallet skal være mellem ${minYear} og ${maxYear}`,
                    policy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
                  }),
                  { blocksProjection: true }
                ),
              ]
            : [],
      }),
    ],
    build: ({ aargang }): SatserProjectionData => ({ year: aargang, satser: getSatserForYear(aargang) }),
  });

export const evaluateSatserProjection = (
  reader: InputReader,
  bounds: Readonly<{ minYear: number; maxYear: number }>
): InputProjection<SatserProjectionData> =>
  evaluateInputProjection(reader, createSatserProjectionSpec(bounds.minYear, bounds.maxYear));
