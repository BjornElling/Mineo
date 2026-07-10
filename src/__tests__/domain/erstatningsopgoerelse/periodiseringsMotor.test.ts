import { toISODateString, type ISODateString } from '../../../types/branded';
import {
  buildFallbackAllocationDaysForInterval,
  buildOffentligYdelsePeriodiseringsGrundlag,
  buildLoenArbejdsdageSet,
  buildSygedagpengeArbejdsdagePrKalenderuge,
  buildSygedagpengeGrundlagPrKalenderuge,
  countOffentligYdelsePeriodiseringsdage,
  isOffentligYdelseDatoMedregnet,
  optaelArbejdsdage,
  optaelArbejdsdageBreakdown,
  optaelMaanederAfrundet,
  optaelMaanederPraecis,
  periodiserBeloebForOffentligYdelse,
  periodiserBeloebForOffentligYdelseMedGrundlag,
} from '../../../domain/erstatningsopgoerelse/engines/periodiseringsMotor';

const iso = (value: string): ISODateString => toISODateString(value);
const d = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

describe('periodiseringsMotor', () => {
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

  it('buildSygedagpengeGrundlagPrKalenderuge fordeler timer som 8/8/8/8/5 pr. uge', () => {
    const result = buildSygedagpengeGrundlagPrKalenderuge(iso('2025-01-09'), iso('2025-01-14'));
    expect(result).toEqual([
      { ugeStart: iso('2025-01-06'), arbejdsdage: 2, timer: 13 },
      { ugeStart: iso('2025-01-13'), arbejdsdage: 2, timer: 16 },
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

describe('buildFallbackAllocationDaysForInterval', () => {
  it('bruger periodens hverdage (man-fre) minus helligdage', () => {
    // Juli 2024: 23 hverdage, ingen helligdage.
    const days = buildFallbackAllocationDaysForInterval({ fra: iso('2024-07-01'), til: iso('2024-07-31') });
    expect(days.size).toBe(23);
    expect(days.has(iso('2024-07-01'))).toBe(true); // mandag
    expect(days.has(iso('2024-07-06'))).toBe(false); // lørdag
    expect(days.has(iso('2024-07-07'))).toBe(false); // søndag
  });

  it('udelader helligdage fra hverdags-sættet', () => {
    // 2. påskedag 2024 = mandag 1. april. Perioden 1.-5. april er ellers alle hverdage.
    const days = buildFallbackAllocationDaysForInterval({ fra: iso('2024-04-01'), til: iso('2024-04-05') });
    expect(days.has(iso('2024-04-01'))).toBe(false); // 2. påskedag (helligdag)
    expect(days.has(iso('2024-04-02'))).toBe(true);
    expect(days.size).toBe(4);
  });

  it('falder tilbage til kalenderdage når perioden ingen hverdage har (ren weekend)', () => {
    const days = buildFallbackAllocationDaysForInterval({ fra: iso('2024-07-06'), til: iso('2024-07-07') });
    expect(days.size).toBe(2); // lør + søn
    expect(days.has(iso('2024-07-06'))).toBe(true);
    expect(days.has(iso('2024-07-07'))).toBe(true);
  });

  it('returnerer tomt sæt ved ugyldigt interval', () => {
    expect(buildFallbackAllocationDaysForInterval({ fra: iso('2024-07-31'), til: iso('2024-07-01') }).size).toBe(0);
  });
});

describe('buildOffentligYdelsePeriodiseringsGrundlag — fald-tilbage for arbejdsdags-ydelse uden arbejdsdage', () => {
  it('bruger fald-tilbage-dage så en ren weekend-ydelse ikke forsvinder', () => {
    // Sygedagpenge (arbejdsdage) for lør+søn: ingen arbejdsdage → fald tilbage til kalenderdage.
    const grundlag = buildOffentligYdelsePeriodiseringsGrundlag({
      interval: { start: d('2024-07-06'), end: d('2024-07-07') },
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
      shDays: new Set<ISODateString>(),
    });
    expect(grundlag).not.toBeNull();
    expect(grundlag?.fallbackAllocationDays?.size).toBe(2);
    expect(grundlag?.periodiseringsDage).toBe(2);

    const beloeb = periodiserBeloebForOffentligYdelseMedGrundlag({
      totalBeloeb: 1000,
      range: { fra: iso('2024-07-06'), til: iso('2024-07-07') },
      grundlag: grundlag!,
    });
    expect(beloeb).toBeCloseTo(1000, 6); // hele beløbet fanges, intet forsvinder
  });
});
