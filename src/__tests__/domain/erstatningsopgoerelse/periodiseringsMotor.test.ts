import { toISODateString, type ISODateString } from '../../../types/branded';
import {
  buildOffentligYdelsePeriodiseringsGrundlag,
  buildLoenArbejdsdageSet,
  buildSygedagpengeArbejdsdagePrKalenderuge,
  countOffentligYdelsePeriodiseringsdage,
  isOffentligYdelseDatoMedregnet,
  optaelArbejdsdage,
  optaelArbejdsdageBreakdown,
  optaelMaanederAfrundet,
  optaelMaanederPraecis,
  periodiserBeloebForArbejdsdage,
  periodiserBeloebForMaaneder,
  periodiserBeloebForOffentligYdelse,
  periodiserBeloebForOffentligYdelseMedGrundlag,
  sumMaanedsbroekForInterval,
} from '../../../domain/erstatningsopgoerelse/engines/periodiseringsMotor';

const iso = (value: string): ISODateString => toISODateString(value);
const d = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

describe('periodiseringsMotor', () => {
  it('periodiserBeloebForMaaneder periodiserer proportionalt på kalenderdage', () => {
    const result = periodiserBeloebForMaaneder({
      totalBeloeb: 310,
      interval: { start: d(toISODateString('2024-01-01')), end: d(toISODateString('2024-01-31')) },
      ranges: [{ fra: iso('2024-01-01'), til: iso('2024-01-10') }],
    });
    expect(result).toBe(100);
  });

  it('periodiserBeloebForArbejdsdage periodiserer proportionalt på arbejdsdage', () => {
    const arbejdsdageSet = new Set<ISODateString>([
      iso('2024-01-01'),
      iso('2024-01-02'),
      iso('2024-01-04'),
      iso('2024-01-05'),
    ]);
    const result = periodiserBeloebForArbejdsdage({
      totalBeloeb: 100,
      interval: { start: d(toISODateString('2024-01-01')), end: d(toISODateString('2024-01-05')) },
      ranges: [{ fra: iso('2024-01-03'), til: iso('2024-01-05') }],
      arbejdsdageSet,
    });
    expect(result).toBe(50);
  });

  it('periodiserBeloebForOffentligYdelse bruger ydelsesrækkens egen til-dato til sygedagpenge-cutoff', () => {
    const shDays = new Set<ISODateString>([iso('2012-06-05')]);
    const result = periodiserBeloebForOffentligYdelse({
      totalBeloeb: 100,
      interval: { start: d(toISODateString('2012-06-04')), end: d(toISODateString('2012-06-07')) },
      range: { fra: iso('2012-06-05'), til: iso('2024-01-01') },
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
      shDays,
    });
    expect(result).toBe(75);
  });

  it('periodiserBeloebForOffentligYdelse er fail-closed ved ugyldig range-dato', () => {
    const result = periodiserBeloebForOffentligYdelse({
      totalBeloeb: 100,
      interval: { start: d(toISODateString('2024-01-01')), end: d(toISODateString('2024-01-10')) },
      range: { fra: 'invalid' as unknown as ISODateString, til: iso('2024-01-10') },
      periodisering: 'kalenderdage',
      ydelsestypeKey: 'dagpenge',
      shDays: new Set<ISODateString>(),
    });
    expect(result).toBe(0);
  });

  it('countOffentligYdelsePeriodiseringsdage tæller kalenderdage inklusivt', () => {
    const result = countOffentligYdelsePeriodiseringsdage({
      fra: iso('2024-03-30'),
      til: iso('2024-04-02'),
      periodisering: 'kalenderdage',
      ydelsestypeKey: 'dagpenge',
    });
    expect(result).toBe(4);
  });

  it('countOffentligYdelsePeriodiseringsdage anvender sygedagpenge-cutoff centralt', () => {
    const foerCutoff = countOffentligYdelsePeriodiseringsdage({
      fra: iso('2012-04-01'),
      til: iso('2012-06-30'),
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
    });
    const efterCutoff = countOffentligYdelsePeriodiseringsdage({
      fra: iso('2013-05-13'),
      til: iso('2013-05-31'),
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
    });
    const efterCutoffSomAlmindelig = countOffentligYdelsePeriodiseringsdage({
      fra: iso('2013-05-13'),
      til: iso('2013-05-31'),
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'dagpenge',
    });

    expect(foerCutoff).toBeGreaterThan(0);
    expect(efterCutoff).toBe(efterCutoffSomAlmindelig);
  });

  it('countOffentligYdelsePeriodiseringsdage vurderer hele intervallet ud fra periodens slutdato ved cutoff', () => {
    const foerSyntetiskCutoff = countOffentligYdelsePeriodiseringsdage({
      fra: iso('2023-12-29'),
      til: iso('2024-01-03'),
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
      sygedagpengeShCutoff: iso('2024-01-04'),
    });
    const efterSyntetiskCutoff = countOffentligYdelsePeriodiseringsdage({
      fra: iso('2023-12-29'),
      til: iso('2024-01-03'),
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
      sygedagpengeShCutoff: iso('2024-01-02'),
    });

    expect(foerSyntetiskCutoff).toBe(4);
    expect(efterSyntetiskCutoff).toBe(3);
  });

  it('isOffentligYdelseDatoMedregnet bruger 2012-07-02 som reel sygedagpenge-cutover efter periodens slutdato', () => {
    const shDays = new Set<ISODateString>([iso('2012-06-05')]);
    const foerCutover = isOffentligYdelseDatoMedregnet({
      iso: iso('2012-06-05'),
      dateObj: d(toISODateString('2012-06-05')),
      shDays,
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
      rowTilISO: iso('2012-07-01'),
    });
    const paaCutover = isOffentligYdelseDatoMedregnet({
      iso: iso('2012-06-05'),
      dateObj: d(toISODateString('2012-06-05')),
      shDays,
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
      rowTilISO: iso('2012-07-02'),
    });

    expect(foerCutover).toBe(true);
    expect(paaCutover).toBe(false);
  });

  it('buildSygedagpengeArbejdsdagePrKalenderuge deler arbejdsdage pr. kalenderuge via central motor', () => {
    const result = buildSygedagpengeArbejdsdagePrKalenderuge(iso('2025-01-09'), iso('2025-01-14'));
    expect(result).toEqual([
      { ugeStart: iso('2025-01-06'), arbejdsdage: 2 },
      { ugeStart: iso('2025-01-13'), arbejdsdage: 2 },
    ]);
  });

  it('buildLoenArbejdsdageSet ekskluderer kun ferie- og SH-dage', () => {
    const arbejdsdage = buildLoenArbejdsdageSet(
      { fra: iso('2024-12-16'), til: iso('2024-12-20') },
      [{ id: 'f1', fra: iso('2024-12-17'), til: iso('2024-12-17') }]
    );
    expect(arbejdsdage.has(iso('2024-12-16'))).toBe(true);
    expect(arbejdsdage.has(iso('2024-12-17'))).toBe(false);
    expect(arbejdsdage.has(iso('2024-12-18'))).toBe(true);
    expect(arbejdsdage.has(iso('2024-12-19'))).toBe(true);
    expect(arbejdsdage.has(iso('2024-12-20'))).toBe(true);
  });

  it('optaelMaanederPraecis beregner kalenderdagsfraktioner og fradrag', () => {
    const value = optaelMaanederPraecis({
      fra: iso('2024-01-01'),
      til: iso('2024-01-31'),
      oevrigeFravaersdage: 1,
    });
    expect(value).toBe(0.952);
  });

  it('optaelMaanederAfrundet afrunder til 2 decimaler', () => {
    const value = optaelMaanederAfrundet({
      fra: iso('2024-04-01'),
      til: iso('2024-04-10'),
    });
    expect(value).toBe(0.33);
  });

  it('optaelArbejdsdageBreakdown beregner arbejdsdage med ferie/løse/fravær', () => {
    const breakdown = optaelArbejdsdageBreakdown({
      fra: iso('2024-01-01'),
      til: iso('2024-01-05'),
      ferieperioder: [{ id: 'f1', fra: iso('2024-01-02'), til: iso('2024-01-02') }],
      loseFeriedage: 1,
      context: { kind: 'beregningsgrundlag', oevrigeFravaersdage: 1 },
    });
    expect(breakdown).not.toBeNull();
    expect(breakdown?.arbejdsdageMinusSH).toBe(4);
    expect(breakdown?.feriedage).toBe(1);
    expect(breakdown?.loseFeriedage).toBe(1);
    expect(breakdown?.oevrigeFravaersdage).toBe(1);
    expect(breakdown?.tafDage).toBe(1);
  });

  it('optaelArbejdsdage returnerer antal tafDage', () => {
    const value = optaelArbejdsdage({
      fra: iso('2024-01-01'),
      til: iso('2024-01-05'),
      ferieperioder: [],
      loseFeriedage: 0,
      context: { kind: 'taf' },
    });
    expect(value).toBe(4);
  });

  it('isOffentligYdelseDatoMedregnet anvender sygedagpenge-særregel før cutoff', () => {
    const shDays = new Set<ISODateString>([iso('2012-06-05')]);
    const included = isOffentligYdelseDatoMedregnet({
      iso: iso('2012-06-05'),
      dateObj: d(toISODateString('2012-06-05')),
      shDays,
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
      rowTilISO: iso('2012-06-30'),
    });
    expect(included).toBe(true);
  });

  it('isOffentligYdelseDatoMedregnet: kalenderdage-periodisering inkluderer alle dage (inkl. SH og weekend)', () => {
    // Nytårsdag 2024 (mandag, SH-dag)
    const shDays = new Set<ISODateString>([iso('2024-01-01')]);
    const result = isOffentligYdelseDatoMedregnet({
      iso: iso('2024-01-01'),
      dateObj: d(toISODateString('2024-01-01')),
      shDays,
      periodisering: 'kalenderdage',
      ydelsestypeKey: 'sygedagpenge',
      rowTilISO: iso('2024-12-31'),
    });
    // Kalenderdage: SH-dage tæller MED
    expect(result).toBe(true);
  });

  it('isOffentligYdelseDatoMedregnet: arbejdsdage-periodisering ekskluderer weekend', () => {
    // Lørdag 6. januar 2024
    const emptyShDays = new Set<ISODateString>();
    const result = isOffentligYdelseDatoMedregnet({
      iso: iso('2024-01-06'),
      dateObj: d(toISODateString('2024-01-06')),
      shDays: emptyShDays,
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'dagpenge',
      rowTilISO: iso('2024-12-31'),
    });
    expect(result).toBe(false);
  });

  it('isOffentligYdelseDatoMedregnet: arbejdsdage-periodisering ekskluderer SH-dag (ikke-sygedagpenge)', () => {
    // Nytårsdag 2024 (mandag) — SH-dag
    const shDays = new Set<ISODateString>([iso('2024-01-01')]);
    const result = isOffentligYdelseDatoMedregnet({
      iso: iso('2024-01-01'),
      dateObj: d(toISODateString('2024-01-01')),
      shDays,
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'dagpenge',
      rowTilISO: iso('2024-12-31'),
    });
    expect(result).toBe(false);
  });

  it('isOffentligYdelseDatoMedregnet: sygedagpenge SH-dag EFTER cutoff ekskluderes', () => {
    // Cutoff er typisk 2012-01-01. En SH-dag i 2024 med sygedagpenge og rowTil > cutoff ekskluderes.
    const shDays = new Set<ISODateString>([iso('2024-01-01')]);
    const result = isOffentligYdelseDatoMedregnet({
      iso: iso('2024-01-01'),
      dateObj: d(toISODateString('2024-01-01')),
      shDays,
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
      rowTilISO: iso('2024-12-31'), // rowTil er efter cutoff → særregel gælder IKKE
    });
    expect(result).toBe(false);
  });

  it('periodiserBeloebForOffentligYdelse med kalenderdage-periodisering tæller alle dage', () => {
    // 5 kalenderdage inkl. SH-dag. Alle 5 tæller ved kalenderdage.
    const shDays = new Set<ISODateString>([iso('2024-01-01')]);
    const result = periodiserBeloebForOffentligYdelse({
      totalBeloeb: 500,
      interval: { start: d(toISODateString('2024-01-01')), end: d(toISODateString('2024-01-05')) },
      range: { fra: iso('2024-01-01'), til: iso('2024-12-31') },
      periodisering: 'kalenderdage',
      ydelsestypeKey: 'sygedagpenge',
      shDays,
    });
    // Alle 5 dage tæller → 500 * 5/5 = 500
    expect(result).toBe(500);
  });

  it('periodiserBeloebForOffentligYdelseMedGrundlag matcher direkte periodisering for flere ranges', () => {
    const interval = { start: d(toISODateString('2024-01-01')), end: d(toISODateString('2024-01-10')) };
    const shDays = new Set<ISODateString>([iso('2024-01-01')]);
    const ranges = [
      { fra: iso('2024-01-01'), til: iso('2024-01-03') },
      { fra: iso('2024-01-08'), til: iso('2024-01-10') },
    ];
    const grundlag = buildOffentligYdelsePeriodiseringsGrundlag({
      interval,
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'dagpenge',
      shDays,
    });

    expect(grundlag).not.toBeNull();
    if (!grundlag) throw new Error('Forventede gyldigt periodiseringsgrundlag');
    const direct = ranges.reduce((sum, range) => sum + periodiserBeloebForOffentligYdelse({
      totalBeloeb: 1000,
      interval,
      range,
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'dagpenge',
      shDays,
    }), 0);
    const prepared = ranges.reduce((sum, range) => sum + periodiserBeloebForOffentligYdelseMedGrundlag({
      totalBeloeb: 1000,
      range,
      grundlag,
    }), 0);

    expect(prepared).toBe(direct);
  });

  // Lås kalenderdage-hurtigstien: når periodisering = 'kalenderdage' medregnes hver dag, så
  // grundlaget springer dag-for-dag-iterationen over og bruger countInclusiveUtcDays. Skal være
  // byte-identisk med den direkte (iterende) periodisering.
  it('periodiserBeloebForOffentligYdelse(MedGrundlag) er identisk for kalenderdage (hurtigsti vs. direkte)', () => {
    const interval = { start: d(toISODateString('2024-03-01')), end: d(toISODateString('2024-03-31')) };
    const shDays = new Set<ISODateString>([iso('2024-03-28')]); // ignoreres ved kalenderdage
    const ranges = [
      { fra: iso('2024-03-01'), til: iso('2024-03-10') },
      { fra: iso('2024-03-20'), til: iso('2024-03-31') },
    ];
    const grundlag = buildOffentligYdelsePeriodiseringsGrundlag({
      interval,
      periodisering: 'kalenderdage',
      ydelsestypeKey: 'folkepension',
      shDays,
    });
    expect(grundlag).not.toBeNull();
    if (!grundlag) throw new Error('Forventede gyldigt periodiseringsgrundlag');
    expect(grundlag.periodiseringsDage).toBe(31);

    const direct = ranges.reduce((sum, range) => sum + periodiserBeloebForOffentligYdelse({
      totalBeloeb: 3100,
      interval,
      range,
      periodisering: 'kalenderdage',
      ydelsestypeKey: 'folkepension',
      shDays,
    }), 0);
    const prepared = ranges.reduce((sum, range) => sum + periodiserBeloebForOffentligYdelseMedGrundlag({
      totalBeloeb: 3100,
      range,
      grundlag,
    }), 0);

    expect(prepared).toBe(direct);
    // 10 + 12 kalenderdage af 31 → 3100 * 22/31
    expect(prepared).toBeCloseTo(3100 * (22 / 31), 9);
  });

  it('countOffentligYdelsePeriodiseringsdage(kalenderdage) = inklusiv dag-tælling', () => {
    expect(countOffentligYdelsePeriodiseringsdage({
      fra: iso('2024-03-01'),
      til: iso('2024-03-31'),
      periodisering: 'kalenderdage',
      ydelsestypeKey: 'folkepension',
    })).toBe(31);
  });

  it('optaelMaanederPraecis returnerer null ved undefined fra', () => {
    const value = optaelMaanederPraecis({ fra: undefined, til: iso('2024-01-31'), oevrigeFravaersdage: 0 });
    expect(value).toBeNull();
  });

  it('optaelMaanederPraecis returnerer null ved undefined til', () => {
    const value = optaelMaanederPraecis({ fra: iso('2024-01-01'), til: undefined, oevrigeFravaersdage: 0 });
    expect(value).toBeNull();
  });

  it('optaelMaanederAfrundet returnerer null ved undefined fra', () => {
    const value = optaelMaanederAfrundet({ fra: undefined, til: iso('2024-01-31') });
    expect(value).toBeNull();
  });
});

describe('sumMaanedsbroekForInterval', () => {
  it('hel kalendermåned → 1', () => {
    expect(sumMaanedsbroekForInterval(iso('2024-03-01'), iso('2024-03-31'))).toBeCloseTo(1, 10);
  });

  it('halv måned (15 af 31 dage i januar)', () => {
    expect(sumMaanedsbroekForInterval(iso('2024-01-01'), iso('2024-01-15'))).toBeCloseTo(15 / 31, 10);
  });

  it('ugyldigt interval (fra > til) → 0', () => {
    expect(sumMaanedsbroekForInterval(iso('2024-03-31'), iso('2024-03-01'))).toBe(0);
  });

  it('undefined grænse → 0', () => {
    expect(sumMaanedsbroekForInterval(undefined, iso('2024-03-31'))).toBe(0);
    expect(sumMaanedsbroekForInterval(iso('2024-03-01'), undefined)).toBe(0);
  });

  // Ækvivalens-lås: den kanoniske helper grupperer pr. måned og dividerer én gang (Σ count/x),
  // mens den tidligere indkomst-mellemregning summerede 1/x pr. dag (Σ 1/x). De to summer kan
  // afvige i sidste ULP pga. floating point, men SKAL være identiske efter den 2-decimal-afrunding
  // begge kaldere anvender. Denne test fanger drift hvis nogen ændrer grupperingsstrategien.
  it('matcher den tidligere "Σ 1/dage-i-måned"-formel efter 2-decimal-afrunding', () => {
    const daysInMonth = (year: number, month: number): number =>
      new Date(Date.UTC(year, month, 0)).getUTCDate();
    const prefixStart = d(iso('2018-01-01'));
    const prefixEnd = d(iso('2023-04-08'));
    const dayWeights: number[] = [0];
    for (let cur = new Date(prefixStart.getTime()); cur <= prefixEnd; cur.setUTCDate(cur.getUTCDate() + 1)) {
      dayWeights.push(dayWeights[dayWeights.length - 1]! + 1 / daysInMonth(cur.getUTCFullYear(), cur.getUTCMonth() + 1));
    }
    const inlineSum = (fra: ISODateString, til: ISODateString): number => {
      const fraIndex = Math.round((d(fra).getTime() - prefixStart.getTime()) / 86_400_000);
      const tilIndexInclusive = Math.round((d(til).getTime() - prefixStart.getTime()) / 86_400_000);
      return dayWeights[tilIndexInclusive + 1]! - dayWeights[fraIndex]!;
    };
    const round2 = (x: number): number => {
      const v = x * 100;
      return (Math.sign(v) * Math.round(Math.abs(v))) / 100;
    };
    const start = d(iso('2018-01-01'));
    const mismatches: Array<{ fra: ISODateString; til: ISODateString; actual: number; expected: number }> = [];
    for (let offset = 0; offset < 800; offset += 11) {
      for (let len = 0; len < 1100; len += 29) {
        const fraDate = new Date(start.getTime());
        fraDate.setUTCDate(fraDate.getUTCDate() + offset);
        const tilDate = new Date(fraDate.getTime());
        tilDate.setUTCDate(tilDate.getUTCDate() + len);
        const fra = toISODateString(fraDate.toISOString().slice(0, 10));
        const til = toISODateString(tilDate.toISOString().slice(0, 10));
        const actual = round2(sumMaanedsbroekForInterval(fra, til));
        const expected = round2(inlineSum(fra, til));
        if (actual !== expected) {
          mismatches.push({ fra, til, actual, expected });
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('enkelt dag → 1/dage-i-måned (skudårsfølsom)', () => {
    // Februar 2024 (skudår): 1/29. Februar 2023: 1/28.
    expect(sumMaanedsbroekForInterval(iso('2024-02-15'), iso('2024-02-15'))).toBeCloseTo(1 / 29, 10);
    expect(sumMaanedsbroekForInterval(iso('2023-02-15'), iso('2023-02-15'))).toBeCloseTo(1 / 28, 10);
  });

  it('hele februar i skudår → 1 (alle 29 dage)', () => {
    expect(sumMaanedsbroekForInterval(iso('2024-02-01'), iso('2024-02-29'))).toBeCloseTo(1, 10);
  });
});

describe('periodiseringsMotor — division-værn ved degenererede grundlag', () => {
  it('periodiserBeloebForMaaneder: tomt ranges-sæt → 0 (ingen overlap)', () => {
    const result = periodiserBeloebForMaaneder({
      totalBeloeb: 1000,
      interval: { start: d(iso('2024-01-01')), end: d(iso('2024-01-31')) },
      ranges: [],
    });
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });

  it('periodiserBeloebForMaaneder: én-dags interval bevarer endeligt resultat (ingen NaN ved totalDays=1)', () => {
    const result = periodiserBeloebForMaaneder({
      totalBeloeb: 1000,
      interval: { start: d(iso('2024-01-15')), end: d(iso('2024-01-15')) },
      ranges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });
    // Fuldt overlap på det ene døgn → hele beløbet.
    expect(result).toBe(1000);
  });

  it('periodiserBeloebForArbejdsdage: tomt arbejdsdage-sæt → 0 (totalArbejdsdage=0, ingen NaN)', () => {
    const result = periodiserBeloebForArbejdsdage({
      totalBeloeb: 1000,
      interval: { start: d(iso('2024-01-01')), end: d(iso('2024-01-31')) },
      ranges: [{ fra: iso('2024-01-01'), til: iso('2024-01-10') }],
      arbejdsdageSet: new Set<ISODateString>(),
    });
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });

  it('periodiserBeloebForArbejdsdage: ingen overlap mellem range og arbejdsdage → 0', () => {
    const result = periodiserBeloebForArbejdsdage({
      totalBeloeb: 1000,
      interval: { start: d(iso('2024-01-01')), end: d(iso('2024-01-31')) },
      ranges: [{ fra: iso('2024-01-20'), til: iso('2024-01-25') }],
      arbejdsdageSet: new Set<ISODateString>([iso('2024-01-02'), iso('2024-01-03')]),
    });
    expect(result).toBe(0);
  });
});
