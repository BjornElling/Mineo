import {
  resolveEgetAtpBidragPrKalenderuge,
  resolveKommunaltAtpBidragPrKalenderuge,
  SYGEDAGPENGE_ATP_MAX_DATE,
  SYGEDAGPENGE_ATP_MIN_DATE,
  SYGEDAGPENGE_INSERT_MAX_DATE,
  SYGEDAGPENGE_INSERT_MIN_DATE,
  SYGEDAGPENGE_RATE_MAX_DATE,
  SYGEDAGPENGE_RATE_MIN_DATE,
  sygedagpengeAtpPrincipper,
  sygedagpengeRates,
} from '../../../data/sygedagpengeRates';
import {
  buildSygedagpengeRowsForRange,
  splitSygedagpengeRateSegments,
} from '../../../domain/erstatningsopgoerelse/helpers/sygedagpengeInsertRows';

describe('sygedagpengeInsertRows', () => {
  it('splitter brugerperioden efter satsperioder og trimmer første/sidste række til brugerens datoer', () => {
    const segments = splitSygedagpengeRateSegments('2024-06-15', '2026-06-15');

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({
      fraDato: '2024-06-15',
      tilDato: '2025-01-05',
    });
    expect(segments[1]).toMatchObject({
      fraDato: '2025-01-06',
      tilDato: '2026-01-04',
    });
    expect(segments[2]).toMatchObject({
      fraDato: '2026-01-05',
      tilDato: '2026-06-15',
    });
  });

  it('opretter offentlige ydelsesrækker som udtryk med sygedagpenge og kun kommunalt ATP-bidrag', () => {
    const rows = buildSygedagpengeRowsForRange('2025-01-06', '2025-01-10');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fraDato: '2025-01-06',
      tilDato: '2025-01-10',
      ydelsestype: 'sygedagpenge',
    });
    expect(rows[0]?.ydelse).toEqual({
      kind: 'expression',
      expression: '5*973',
      value: 4865,
    });
    expect(rows[0]?.tillaeg).toEqual({
      kind: 'expression',
      expression: '53*2',
      value: 106,
    });
  });

  it('afrunder ATP pr. kalenderuge og ikke pr. arbejdsdag', () => {
    const rows = buildSygedagpengeRowsForRange('2025-01-09', '2025-01-14');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tillaeg).toEqual({
      kind: 'expression',
      expression: '21*2+21*2',
      value: 84,
    });
  });

  it('forudsætter at kommunalt ATP-bidrag i rate-tabellen er dobbelt af eget ugentlige bidrag', () => {
    for (const rate of sygedagpengeRates) {
      expect(rate.kommunaltAtpPrKalenderuge).toBe(rate.egetAtpPrKalenderuge * 2);
    }
  });

  it('eksponerer ATP-principperne for fuld kalenderuge i den samlede sygedagpenge-datakilde', () => {
    expect(sygedagpengeAtpPrincipper).toEqual([
      { fraDato: '2005-01-03', tilDato: '2008-01-06', egetAtpPrKalenderuge: 38, kommunaltAtpPrKalenderuge: 76 },
      { fraDato: '2008-01-07', tilDato: '2020-01-05', egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
      { fraDato: '2020-01-06', tilDato: '2023-12-31', egetAtpPrKalenderuge: 48, kommunaltAtpPrKalenderuge: 96 },
      { fraDato: '2024-01-01', tilDato: '2027-01-03', egetAtpPrKalenderuge: 53, kommunaltAtpPrKalenderuge: 106 },
    ]);
    expect(resolveEgetAtpBidragPrKalenderuge(sygedagpengeRates[20]!)).toBe(53);
    expect(resolveKommunaltAtpBidragPrKalenderuge(sygedagpengeRates[20]!)).toBe(106);
  });

  it('medregner SH-dage før 2. juli 2012 men ikke fra og med 2. juli 2012', () => {
    const rowsFoerCutoff = buildSygedagpengeRowsForRange('2012-05-28', '2012-05-28');
    const rowsEfterCutoff = buildSygedagpengeRowsForRange('2013-05-20', '2013-05-20');

    expect(rowsFoerCutoff[0]?.ydelse).toEqual({
      kind: 'expression',
      expression: '1*768',
      value: 768,
    });
    expect(rowsEfterCutoff).toHaveLength(0);
  });

  it('eksponerer dynamiske min/max-datoer fra første og sidste satsrække', () => {
    expect(SYGEDAGPENGE_RATE_MIN_DATE).toBe('2005-01-03');
    expect(SYGEDAGPENGE_RATE_MAX_DATE).toBe('2027-01-03');
    expect(SYGEDAGPENGE_ATP_MIN_DATE).toBe('2005-01-03');
    expect(SYGEDAGPENGE_ATP_MAX_DATE).toBe('2027-01-03');
    expect(SYGEDAGPENGE_INSERT_MIN_DATE).toBe('2005-01-03');
    expect(SYGEDAGPENGE_INSERT_MAX_DATE).toBe('2027-01-03');
  });

  it('returnerer ingen rækker når hele perioden ligger uden for satsperioden', () => {
    expect(buildSygedagpengeRowsForRange('2030-01-01', '2030-01-31')).toEqual([]);
  });

  it('trimmer delvist overlap til den del af perioden hvor der findes satser', () => {
    const segments = splitSygedagpengeRateSegments('2026-12-29', '2027-01-10');

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      fraDato: '2026-12-29',
      tilDato: '2027-01-03',
    });
  });
});
