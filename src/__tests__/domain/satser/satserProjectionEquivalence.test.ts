import type { PersistedSectionMap } from '../../../config/persistenceRegistry';
import { satserAngivAarYearBounds } from '../../../data/lovbestemteRates';
import { documentGateFromBlockers } from '../../../domain/inputIntegrity/inputBlockerGate';
import { buildSatserInputProjection } from '../../../domain/satser/satserInputProjection';
import { evaluateSatserProjection } from '../../../domain/satser/satserKernelProjection';
import { documentGateFromInputProjection } from '../../../document/layout/inputProjectionDocumentGate';
import { getProductionInputCatalog } from '../../../input/catalog/productionInputCatalog';
import { satserAargangBinding } from '../../../input/catalog/satserInputBindings';
import { serializeFieldAddress } from '../../../input/fieldAddress';
import { createInputReader, createInputRevision } from '../../../input/inputReader';
import {
  createEmptyPersistedInputSections,
  createPersistedInputStateSchema,
} from '../../../input/inputState';

/**
 * Beviser at den kerne-baserede `evaluateSatserProjection` (src/input) er OBSERVATIONELT IDENTISK med
 * den hånd-rullede `buildSatserInputProjection` (domain/inputIntegrity): samme download-gate
 * (canDownload + code + message) og samme ready-data ({year, satser}) for hele input-matricen. Det er
 * parity-garantien bag Satser-læsesidens fase-5-cutover — swap'et er sikkert så længe denne + den fulde
 * DOM-integrationstest (`Satser.downloadGate.integration.test.tsx`) forbliver grønne.
 */
const { minYear, maxYear } = satserAngivAarYearBounds;
const midYear = Math.floor((minYear + maxYear) / 2);

type SatserValues = PersistedSectionMap['satser'] | null;

const AARGANG_ADDRESS = serializeFieldAddress(satserAargangBinding.createRef().address);

const buildReader = (satser: SatserValues, invalidRaw: string | undefined) => {
  const catalog = getProductionInputCatalog();
  const input = createPersistedInputStateSchema(catalog).parse({
    sections: { ...createEmptyPersistedInputSections(), satser },
    rejectedInputs: invalidRaw === undefined ? {} : { [AARGANG_ADDRESS]: { raw: invalidRaw } },
  });
  return createInputReader({ input, revision: createInputRevision(1), catalog });
};

type Case = Readonly<{ name: string; satser: SatserValues; invalidRaw: string | undefined }>;

const cases: readonly Case[] = [
  { name: 'gyldigt år (minYear)', satser: { aargang: minYear }, invalidRaw: undefined },
  { name: 'gyldigt år (midt)', satser: { aargang: midYear }, invalidRaw: undefined },
  { name: 'gyldigt år (maxYear)', satser: { aargang: maxYear }, invalidRaw: undefined },
  { name: 'manglende (tom sektion)', satser: {}, invalidRaw: undefined },
  { name: 'manglende (null-sektion)', satser: null, invalidRaw: undefined },
  { name: 'uden for interval (under)', satser: { aargang: minYear - 1 }, invalidRaw: undefined },
  { name: 'uden for interval (over)', satser: { aargang: maxYear + 1 }, invalidRaw: undefined },
  { name: 'ugyldig draft (maskerer gyldig)', satser: { aargang: midYear }, invalidRaw: '12..20' },
  { name: 'ugyldig draft (maskerer manglende)', satser: {}, invalidRaw: 'abc' },
];

describe('Satser-projektion: kerne == inputIntegrity (parity)', () => {
  it.each(cases)('$name — identisk gate og ready-data', ({ satser, invalidRaw }) => {
    const oldProjection = buildSatserInputProjection({
      values: satser,
      aargangInvalidDraft: invalidRaw,
      minYear,
      maxYear,
      revision: 1,
    });
    const oldGate = oldProjection.status === 'ready'
      ? documentGateFromBlockers([], 'satser')
      : documentGateFromBlockers(oldProjection.blockers, 'satser');

    const newProjection = evaluateSatserProjection(buildReader(satser, invalidRaw), { minYear, maxYear });
    const newGate = documentGateFromInputProjection(newProjection, 'satser');

    expect(newGate).toEqual(oldGate);
    expect(newProjection.status).toBe(oldProjection.status);
    if (oldProjection.status === 'ready' && newProjection.status === 'ready') {
      expect(newProjection.data).toEqual(oldProjection.data);
    }
  });
});
