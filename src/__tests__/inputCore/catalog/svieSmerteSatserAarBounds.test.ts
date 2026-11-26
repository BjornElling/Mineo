import { eoSvieSmerteSatserAarField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { findLatestSvieSmerteSatsAarAtOrBefore } from '../../../domain/erstatningsopgoerelse/helpers/svieSmerteSatsAar';
import type { CanonicalView } from '../../../inputCore/fieldDescriptor';

const view = { readCanonical: () => undefined } as unknown as CanonicalView;

const boundsIssue = (year: number) =>
  (eoSvieSmerteSatserAarField.validators ?? [])
    .map((validator) => validator(year, eoSvieSmerteSatserAarField.bind(), view))
    .find((issue) => issue !== undefined);

/**
 * «Indsæt årstal» vælger satsåret én måned efter opgørelsesdatoen. I december med næste års satser indlagt
 * må feltet derfor ikke afvise næste år (bevidst valg).
 */
describe('eoSvieSmerteSatserAarField – loft', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepterer det seneste satsår, også når det ligger efter indeværende år', () => {
    const latest = findLatestSvieSmerteSatsAarAtOrBefore(Number.POSITIVE_INFINITY);
    if (latest === undefined) throw new Error('ingen svie/smerte-satser');
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${latest - 1}-12-15T12:00:00`));

    expect(boundsIssue(latest)).toBeUndefined();
    expect(boundsIssue(latest + 1)).toBeDefined();
  });
});
