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
import { toISODateString } from '../../../types/branded';
import {
  buildSygedagpengeRowsForRange,
  splitSygedagpengeRateSegments,
} from '../../../domain/erstatningsopgoerelse/helpers/sygedagpengeInsertRows';

describe('sygedagpengeInsertRows', () => {
  it('splitter brugerperioden efter satsperioder og trimmer første/sidste række til brugerens datoer', () => {
    const segments = splitSygedagpengeRateSegments(toISODateString('2024-06-15'), toISODateString('2026-06-15'));

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({
      fraDato: toISODateString('2024-06-15'),
      tilDato: toISODateString('2025-01-05'),
    });
    expect(segments[1]).toMatchObject({
      fraDato: toISODateString('2025-01-06'),
      tilDato: toISODateString('2026-01-04'),
    });
    expect(segments[2]).toMatchObject({
      fraDato: toISODateString('2026-01-05'),
      tilDato: toISODateString('2026-06-15'),
    });
  });

  it('opretter offentlige ydelsesrækker som udtryk med sygedagpenge, kommunalt ATP-bidrag og obligatorisk pension', () => {
    const rows = buildSygedagpengeRowsForRange(toISODateString('2025-01-06'), toISODateString('2025-01-10'));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fraDato: toISODateString('2025-01-06'),
      tilDato: toISODateString('2025-01-10'),
      ydelsestype: 'sygedagpenge',
    });
    expect(rows[0]?.ydelse).toEqual({
      kind: 'expression',
      expression: '5*973',
      value: 4865,
    });
    // Tillæg = kommunalt ATP (53*2) + obligatorisk pension for ugen.
    // OP (1,8 pct. i 2025) på grundlag af sygedagpenge minus eget ATP: round(0,018*(4865-53)) = 87.
    expect(rows[0]?.tillaeg).toEqual({
      kind: 'expression',
      expression: '53*2+87',
      value: 193,
    });
  });

  it('genererer altid unikke row-id på tværs af alle satssegmenter (ingen duplikat-id ved indsættelse)', () => {
    // En lang periode der splittes i flere satssegmenter → flere rækker. Hver skal have unikt id,
    // ellers kolliderer de ved indsættelse i tabellen (React duplicate-key + datakorruption).
    const rows = buildSygedagpengeRowsForRange(toISODateString('2008-01-01'), toISODateString('2025-12-31'));
    expect(rows.length).toBeGreaterThan(1);
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Id'erne er random (ikke seed-baserede) → indeholder aldrig '_empty_'-segmentet.
    expect(ids.every((id) => !id.includes('_empty_'))).toBe(true);
  });

  it('afrunder ATP pr. kalenderuge og ikke pr. arbejdsdag', () => {
    const rows = buildSygedagpengeRowsForRange(toISODateString('2025-01-09'), toISODateString('2025-01-14'));

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
      { fraDato: toISODateString('2005-01-03'), tilDato: toISODateString('2008-01-06'), egetAtpPrKalenderuge: 38, kommunaltAtpPrKalenderuge: 76 },
      { fraDato: toISODateString('2008-01-07'), tilDato: toISODateString('2020-01-05'), egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
      { fraDato: toISODateString('2020-01-06'), tilDato: toISODateString('2023-12-31'), egetAtpPrKalenderuge: 48, kommunaltAtpPrKalenderuge: 96 },
      { fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2027-01-03'), egetAtpPrKalenderuge: 53, kommunaltAtpPrKalenderuge: 106 },
    ]);
    expect(resolveEgetAtpBidragPrKalenderuge(sygedagpengeRates[20]!)).toBe(53);
    expect(resolveKommunaltAtpBidragPrKalenderuge(sygedagpengeRates[20]!)).toBe(106);
  });

  it('medregner SH-dage før 2. juli 2012 men ikke fra og med 2. juli 2012', () => {
    const rowsFoerCutoff = buildSygedagpengeRowsForRange(toISODateString('2012-05-28'), toISODateString('2012-05-28'));
    const rowsEfterCutoff = buildSygedagpengeRowsForRange(toISODateString('2013-05-20'), toISODateString('2013-05-20'));

    expect(rowsFoerCutoff[0]?.ydelse).toEqual({
      kind: 'expression',
      expression: '1*768',
      value: 768,
    });
    expect(rowsEfterCutoff).toHaveLength(0);
  });

  it('eksponerer dynamiske min/max-datoer fra første og sidste satsrække', () => {
    expect(SYGEDAGPENGE_RATE_MIN_DATE).toBe(toISODateString('2005-01-03'));
    expect(SYGEDAGPENGE_RATE_MAX_DATE).toBe(toISODateString('2027-01-03'));
    expect(SYGEDAGPENGE_ATP_MIN_DATE).toBe(toISODateString('2005-01-03'));
    expect(SYGEDAGPENGE_ATP_MAX_DATE).toBe(toISODateString('2027-01-03'));
    expect(SYGEDAGPENGE_INSERT_MIN_DATE).toBe(toISODateString('2005-01-03'));
    expect(SYGEDAGPENGE_INSERT_MAX_DATE).toBe(toISODateString('2027-01-03'));
  });

  it('returnerer ingen rækker når hele perioden ligger uden for satsperioden', () => {
    expect(buildSygedagpengeRowsForRange(toISODateString('2030-01-01'), toISODateString('2030-01-31'))).toEqual([]);
  });

  it('trimmer delvist overlap til den del af perioden hvor der findes satser', () => {
    const segments = splitSygedagpengeRateSegments(toISODateString('2026-12-29'), toISODateString('2027-01-10'));

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      fraDato: toISODateString('2026-12-29'),
      tilDato: toISODateString('2027-01-03'),
    });
  });
});
