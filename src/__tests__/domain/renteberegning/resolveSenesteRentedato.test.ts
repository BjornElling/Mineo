import { resolveSenesteRentedato } from '../../../domain/renteberegning/renteberegningReaderProjection';
import { resolveInsertTodayDisabledReason } from '../../../utils/insertTodayDate';
import { toISODateString } from '../../../types/branded';
import type { RentekravRow } from '../../../schemas/formSchemas';

const row = (id: string, renterFra: string | undefined, tillaegstid?: number): RentekravRow => ({
  id,
  belob: undefined,
  renterFra: renterFra === undefined ? undefined : toISODateString(renterFra),
  tillaegstid,
  enhed: 'maaneder',
});

/**
 * «Indsæt dags dato» i Renteberegning må ikke gøre en række rød: rækkens rentedato må højst være
 * beregningsdatoen, så den seneste rentedato er beregningsdatoens reelle nedre grænse.
 */
describe('resolveSenesteRentedato', () => {
  it('kalder en uforskudt dato for forfaldsdatoen', () => {
    expect(resolveSenesteRentedato([row('a', '2027-03-01')]))
      .toEqual({ date: '2027-03-01', labelBestemt: 'forfaldsdatoen' });
  });

  it('tæller tillægstiden med og vælger den seneste på tværs af rækker', () => {
    expect(resolveSenesteRentedato([row('a', '2027-03-01'), row('b', '2026-11-01', 3), row('c', undefined)]))
      .toEqual({ date: '2027-03-01', labelBestemt: 'den seneste forfaldsdato' });
    expect(resolveSenesteRentedato([row('a', '2026-10-01'), row('b', '2026-11-01', 3)]))
      .toEqual({ date: '2027-02-01', labelBestemt: 'den seneste rentedato' });
  });

  it('har ingen grænse uden forfaldsdatoer', () => {
    expect(resolveSenesteRentedato([row('a', undefined)])).toBeUndefined();
  });

  it('gør knappen inaktiv, når dags dato er før den seneste rentedato', () => {
    expect(resolveInsertTodayDisabledReason({
      today: toISODateString('2026-11-18'),
      max: toISODateString('2031-12-31'),
      lowerBounds: [resolveSenesteRentedato([row('a', '2027-03-01')])],
    })).toBe('Dags dato er før forfaldsdatoen (01-03-2027)');
  });
});
