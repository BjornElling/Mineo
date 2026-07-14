import { getSatserForYear } from '../../data/lovbestemteRates';
import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import {
  blockedInputProjection,
  readyInputProjection,
  sectionScope,
  type InputBlocker,
  type InputProjection,
} from '../inputIntegrity/inputBlocker';
import { resolveSatserEffectiveAargang } from '../policies/satserCalculations';

export type SatserProjectionData = Readonly<{
  year: number;
  satser: ReturnType<typeof getSatserForYear>;
}>;

export const buildSatserInputProjection = (args: Readonly<{
  values: PersistedSectionMap['satser'] | null;
  aargangInvalidDraft: string | undefined;
  minYear: number;
  maxYear: number;
  revision: number;
}>): InputProjection<SatserProjectionData> => {
  const { values, aargangInvalidDraft, minYear, maxYear, revision } = args;
  let blocker: InputBlocker | null = null;
  if (aargangInvalidDraft !== undefined) {
    blocker = {
      fieldId: 'aargang',
      fieldLabel: 'Satsår',
      reason: 'invalid',
      scope: sectionScope(),
      controlKind: 'text',
    };
  } else if (values?.aargang === undefined) {
    blocker = {
      fieldId: 'aargang',
      fieldLabel: 'Satsår',
      reason: 'missing',
      scope: sectionScope(),
      controlKind: 'text',
    };
  } else if (values.aargang < minYear || values.aargang > maxYear) {
    blocker = {
      fieldId: 'aargang',
      fieldLabel: 'Satsår',
      reason: 'range',
      scope: sectionScope(),
      controlKind: 'text',
      detail: `Årstallet skal være mellem ${minYear} og ${maxYear}`,
    };
  }

  if (blocker !== null) return blockedInputProjection([blocker], revision);

  const year = resolveSatserEffectiveAargang(values, minYear, maxYear);
  if (year === undefined) {
    throw new Error('Satser-projektion: ready-grenen kræver en gyldig årgang');
  }
  return readyInputProjection({ year, satser: getSatserForYear(year) }, revision);
};
