import {
  resolveEgetAtpBidragPrKalenderuge,
  resolveKommunaltAtpBidragPrKalenderuge,
  resolveObligatoriskPensionProcent,
  sygedagpengeObligatoriskPensionSatser,
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
  assertSygedagpengeRangeFullyCovered,
  buildSygedagpengeRowsForRange,
  splitSygedagpengeRateSegments,
  SygedagpengeCoverageError,
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

  it('afrunder ATP og obligatorisk pension pr. kalenderuge og ikke pr. arbejdsdag', () => {
    const rows = buildSygedagpengeRowsForRange(toISODateString('2025-01-09'), toISODateString('2025-01-14'));

    expect(rows).toHaveLength(1);
    // To delvise uger med hver 2 arbejdsdage: eget ATP = round(2*53/5) = 21 pr. uge.
    // OP (1,8 pct.) på grundlag af sygedagpenge minus eget ATP: round(0,018*(2*973-21)) = 35 pr. uge.
    // De to identiske uge-led komprimeres til 2*(21*2+35).
    expect(rows[0]?.tillaeg).toEqual({
      kind: 'expression',
      expression: '2*(21*2+35)',
      value: 154,
    });
  });

  it('komprimerer gentagne identiske fulde uger til antal*(uge-led)', () => {
    // 8 fulde uger i 2023 (sats 910, eget 48, OP 1,2 %): hver uge giver leddet 48*2+54.
    // Perioden 2023-02-06 (mandag) til 2023-03-31 (fredag) rummer 8 hele arbejdsuger uden helligdage.
    const rows = buildSygedagpengeRowsForRange(toISODateString('2023-02-06'), toISODateString('2023-03-31'));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tillaeg).toEqual({
      kind: 'expression',
      expression: '8*(48*2+54)',
      value: 8 * (48 * 2 + 54),
    });
  });

  it('bevarer delvise uger for sig og komprimerer kun de identiske fulde uger imellem', () => {
    // Start midt i en uge (onsdag 2023-02-08) → første uge er delvis (3 dage), derefter 3 fulde uger.
    const rows = buildSygedagpengeRowsForRange(toISODateString('2023-02-08'), toISODateString('2023-03-03'));

    expect(rows).toHaveLength(1);
    // Delvis uge (3 dage): eget = round(3*48/5) = 29, OP = round(0,012*(3*910-29)) = 32 → 29*2+32.
    // Derefter tre fulde uger: 3*(48*2+54).
    expect(rows[0]?.tillaeg).toEqual({
      kind: 'expression',
      expression: '29*2+32+3*(48*2+54)',
      value: 29 * 2 + 32 + 3 * (48 * 2 + 54),
    });
  });

  it('komprimerer fulde uger uden OP (før 2020) som antal*led uden parentes', () => {
    // 8 fulde uger i 2019 (eget 44, ingen OP): hver uge er leddet 44*2. Uden et +-led er
    // multiplikation associativ, så komprimeringen skrives som 8*44*2 (ingen parentes).
    const rows = buildSygedagpengeRowsForRange(toISODateString('2019-02-04'), toISODateString('2019-03-29'));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tillaeg).toEqual({
      kind: 'expression',
      expression: '8*44*2',
      value: 8 * 44 * 2,
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

  it('tillægger ikke obligatorisk pension før ordningen trådte i kraft (6. januar 2020)', () => {
    // En uge i 2019: tillæg skal kun indeholde kommunalt ATP, intet OP-led.
    const rows = buildSygedagpengeRowsForRange(toISODateString('2019-01-07'), toISODateString('2019-01-11'));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tillaeg).toEqual({
      kind: 'expression',
      expression: '44*2',
      value: 88,
    });
  });

  it('resolver OP-procentsats pr. satssegment og returnerer 0 før ordningen fandtes', () => {
    // 2019-rate ligger helt før første OP-sats → 0 pct.
    const rate2019 = sygedagpengeRates.find((r) => r.fraDato === toISODateString('2019-01-07'))!;
    expect(resolveObligatoriskPensionProcent(rate2019)).toBe(0);
    // 2025-rate → 1,8 pct.
    const rate2025 = sygedagpengeRates.find((r) => r.fraDato === toISODateString('2025-01-06'))!;
    expect(resolveObligatoriskPensionProcent(rate2025)).toBe(1.8);
    // 2020-rate (første år med ordningen) → 0,3 pct.
    const rate2020 = sygedagpengeRates.find((r) => r.fraDato === toISODateString('2020-01-06'))!;
    expect(resolveObligatoriskPensionProcent(rate2020)).toBe(0.3);
  });

  it('OP-grænserne følger dagpenge-satsåret, så hvert rate-segment ligger inden for præcis én OP-periode', () => {
    // Hvis grænserne ikke aligner, ville resolveObligatoriskPensionProcent kaste for et segment der
    // krydser en OP-grænse. Vi verificerer derfor at alle rate-segmenter (fra 2020) resolver uden fejl.
    for (const rate of sygedagpengeRates) {
      if (rate.tilDato < sygedagpengeObligatoriskPensionSatser[0]!.fraDato) continue;
      expect(() => resolveObligatoriskPensionProcent(rate)).not.toThrow();
    }
  });

  it('alle ATP- og OP-grænser falder på en satsårs-grænse i sygedagpengeRates (de tre tabeller siler ikke fra hinanden)', () => {
    // De tre datakilder (sats / ATP / OP) ændrer sig i hver sin takt, men deler dagpenge-satsårets
    // uge-grænser. Denne test håndhæver at hver ATP- og OP-grænse er en faktisk satsårs-start/-slut i
    // sygedagpengeRates, så en fremtidig redaktør straks fanges hvis en dato skrives forkert.
    // OP-grænser uden for rate-tabellens dækning (2027-2030, hvor satserne endnu ikke kendes) er
    // bevidst undtaget — det er netop derfor OP er en selvstændig tabel.
    const satsaarStart = new Set(sygedagpengeRates.map((rate) => rate.fraDato));
    const satsaarSlut = new Set(sygedagpengeRates.map((rate) => rate.tilDato));

    for (const princip of sygedagpengeAtpPrincipper) {
      if (princip.fraDato >= SYGEDAGPENGE_RATE_MIN_DATE && princip.fraDato <= SYGEDAGPENGE_RATE_MAX_DATE) {
        expect(satsaarStart.has(princip.fraDato)).toBe(true);
      }
      if (princip.tilDato >= SYGEDAGPENGE_RATE_MIN_DATE && princip.tilDato <= SYGEDAGPENGE_RATE_MAX_DATE) {
        expect(satsaarSlut.has(princip.tilDato)).toBe(true);
      }
    }

    for (const sats of sygedagpengeObligatoriskPensionSatser) {
      if (sats.fraDato >= SYGEDAGPENGE_RATE_MIN_DATE && sats.fraDato <= SYGEDAGPENGE_RATE_MAX_DATE) {
        expect(satsaarStart.has(sats.fraDato)).toBe(true);
      }
      if (sats.tilDato >= SYGEDAGPENGE_RATE_MIN_DATE && sats.tilDato <= SYGEDAGPENGE_RATE_MAX_DATE) {
        expect(satsaarSlut.has(sats.tilDato)).toBe(true);
      }
    }
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

  it('kaster en dækningsfejl når hele perioden ligger uden for de definerede sygedagpengesatser', () => {
    expect(() =>
      buildSygedagpengeRowsForRange(toISODateString('2030-01-01'), toISODateString('2030-01-31'))
    ).toThrow(SygedagpengeCoverageError);
  });

  it('kaster en dækningsfejl når blot en del af perioden mangler sygedagpengesatser', () => {
    // Starter inden for dækningen men rækker ud over INSERT_MAX (2027-01-03) → hele indsættelsen afvises.
    expect(() =>
      buildSygedagpengeRowsForRange(toISODateString('2026-12-01'), toISODateString('2027-02-01'))
    ).toThrow(SygedagpengeCoverageError);

    // Starter før den tidligste sats (2005-01-03) → afvises ligeledes.
    expect(() =>
      buildSygedagpengeRowsForRange(toISODateString('2004-12-01'), toISODateString('2005-06-01'))
    ).toThrow(SygedagpengeCoverageError);
  });

  it('indsætter hele perioden uden fejl når den er fuldt dækket af satser', () => {
    expect(() =>
      buildSygedagpengeRowsForRange(toISODateString('2024-06-15'), toISODateString('2026-06-15'))
    ).not.toThrow();
  });

  it('assertSygedagpengeRangeFullyCovered accepterer dækkede perioder og afviser udækkede', () => {
    expect(() =>
      assertSygedagpengeRangeFullyCovered(toISODateString('2025-01-06'), toISODateString('2025-12-31'))
    ).not.toThrow();
    // Hele perioden ligger før OP-ordningen → kun sats/ATP-dækning kræves, ingen OP-fejl.
    expect(() =>
      assertSygedagpengeRangeFullyCovered(toISODateString('2018-01-01'), toISODateString('2019-12-31'))
    ).not.toThrow();
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
