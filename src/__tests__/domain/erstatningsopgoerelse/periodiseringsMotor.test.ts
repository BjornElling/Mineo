import { describe, expect, it } from 'vitest';
import { toISODateString, type ISODateString } from '../../../types/branded';
import {
  buildLoenArbejdsdageSet,
  isOffentligYdelseDatoMedregnet,
  optaelArbejdsdage,
  optaelArbejdsdageBreakdown,
  optaelMaanederAfrundet,
  optaelMaanederPraecis,
  periodiserBeloebForArbejdsdage,
  periodiserBeloebForMaaneder,
  periodiserBeloebForOffentligYdelse,
} from '../../../domain/erstatningsopgoerelse/periodiseringsMotor';

const iso = (value: string): ISODateString => toISODateString(value);
const d = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

describe('periodiseringsMotor', () => {
  it('periodiserBeloebForMaaneder periodiserer proportionalt på kalenderdage', () => {
    const result = periodiserBeloebForMaaneder({
      totalBeloeb: 310,
      interval: { start: d('2024-01-01'), end: d('2024-01-31') },
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
      interval: { start: d('2024-01-01'), end: d('2024-01-05') },
      ranges: [{ fra: iso('2024-01-03'), til: iso('2024-01-05') }],
      arbejdsdageSet,
    });
    expect(result).toBe(50);
  });

  it('periodiserBeloebForOffentligYdelse bruger ydelsesrækkens egen til-dato til sygedagpenge-cutoff', () => {
    const shDays = new Set<ISODateString>([iso('2012-06-05')]);
    const result = periodiserBeloebForOffentligYdelse({
      totalBeloeb: 100,
      interval: { start: d('2012-06-04'), end: d('2012-06-07') },
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
      interval: { start: d('2024-01-01'), end: d('2024-01-10') },
      range: { fra: 'invalid' as unknown as ISODateString, til: iso('2024-01-10') },
      periodisering: 'kalenderdage',
      ydelsestypeKey: 'dagpenge',
      shDays: new Set<ISODateString>(),
    });
    expect(result).toBe(0);
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
      dateObj: d('2012-06-05'),
      shDays,
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
      rowTilISO: iso('2012-06-30'),
    });
    expect(included).toBe(true);
  });
});
