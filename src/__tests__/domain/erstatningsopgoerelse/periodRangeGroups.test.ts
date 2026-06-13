import type { ISODateString } from '../../../types/branded';
import {
  normalizeEoBilagIndkomstYdelserMode,
  buildPeriodRangeGroups,
  splitIsoRangeByCalendarYearsInclusive,
  EO_BILAG_MODE_ALLE,
  EO_BILAG_MODE_PERIODEN,
  type IsoRange,
} from '../../../domain/erstatningsopgoerelse/engines/periodRangeGroups';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

const range = (fra: string, til: string): IsoRange => ({
  fra: iso(fra),
  til: iso(til),
});

const makeEoValues = (overrides: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  ...overrides,
});

// ─── normalizeEoBilagIndkomstYdelserMode ──────────────────────────────────────

describe('normalizeEoBilagIndkomstYdelserMode', () => {
  it('"Alle" → EO_BILAG_MODE_ALLE', () => {
    expect(normalizeEoBilagIndkomstYdelserMode('Alle')).toBe(EO_BILAG_MODE_ALLE);
  });

  it('"Perioden" → EO_BILAG_MODE_PERIODEN', () => {
    expect(normalizeEoBilagIndkomstYdelserMode('Perioden')).toBe(EO_BILAG_MODE_PERIODEN);
  });
});

// ─── buildPeriodRangeGroups – mode "Alle" ─────────────────────────────────────

describe('buildPeriodRangeGroups – Alle', () => {
  const allRanges: readonly IsoRange[] = [
    range(toISODateString('2023-01-01'), toISODateString('2023-06-30')),
    range(toISODateString('2023-07-01'), toISODateString('2023-12-31')),
  ];

  it('returnerer én gruppe med label=null og alle ranges uændret', () => {
    const eoValues = makeEoValues();
    const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_ALLE, allRanges);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBeNull();
    expect(groups[0]!.ranges).toBe(allRanges);
  });

  it('returnerer tom gruppe (label=null) med tomme allRanges', () => {
    const eoValues = makeEoValues();
    const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_ALLE, []);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBeNull();
    expect(groups[0]!.ranges).toHaveLength(0);
  });

  it('allRanges passes igennem uforandret (reference-identitet)', () => {
    const eoValues = makeEoValues();
    const allRanges: readonly IsoRange[] = [range(toISODateString('2023-03-01'), toISODateString('2023-03-31'))];
    const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_ALLE, allRanges);
    expect(groups[0]!.ranges).toBe(allRanges);
  });
});

// ─── buildPeriodRangeGroups – mode "Perioden" ─────────────────────────────────

describe('buildPeriodRangeGroups – Perioden', () => {
  const someRanges: readonly IsoRange[] = [range(toISODateString('2023-01-01'), toISODateString('2023-12-31'))];

  describe('eoNummer = undefined (første opgørelse)', () => {
    it('med beregningsperiode og ingen TAF → én "Beregningsperiode"-gruppe', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: iso('2023-01-01'),
        tafBeregningsperiodeTil: iso('2023-12-31'),
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, someRanges);

      expect(groups).toHaveLength(1);
      const beregningsGruppe = groups.find((g) => g.label === 'Beregningsperiode');
      expect(beregningsGruppe).toBeDefined();
      expect(beregningsGruppe!.ranges).toHaveLength(1);
      expect(beregningsGruppe!.ranges[0]!.fra).toBe(iso('2023-01-01'));
      expect(beregningsGruppe!.ranges[0]!.til).toBe(iso('2023-12-31'));
    });

    it('med TAF-periode og ingen beregningsperiode → én "TAF-periode"-gruppe', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Angivet månedsløn',
        tafBeregningsperiodeFra: undefined,
        tafBeregningsperiodeTil: undefined,
        vedroererPeriodeFra: iso('2022-01-01'),
        vedroererPeriodeTil: iso('2024-12-31'),
        tafPerioder: [
          { id: 'r1', fra: iso('2023-03-01'), til: iso('2023-05-31'), loseFeriedage: 0 },
        ],
      });

      const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, someRanges);

      expect(groups).toHaveLength(1);
      const tafGruppe = groups.find((g) => g.label === 'TAF-periode');
      expect(tafGruppe).toBeDefined();
      expect(tafGruppe!.ranges.length).toBeGreaterThan(0);
    });

    it('med beregningsperiode OG TAF → to grupper', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: iso('2023-01-01'),
        tafBeregningsperiodeTil: iso('2023-12-31'),
        vedroererPeriodeFra: iso('2022-01-01'),
        vedroererPeriodeTil: iso('2024-12-31'),
        tafPerioder: [
          { id: 'r1', fra: iso('2023-01-01'), til: iso('2023-06-30'), loseFeriedage: 0 },
        ],
      });

      const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, someRanges);

      expect(groups).toHaveLength(2);
      const labels = groups.map((g) => g.label);
      expect(labels).toContain('Beregningsperiode');
      expect(labels).toContain('TAF-periode');
    });

    it('uden beregningsperiode og uden TAF → tomme grupper', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: undefined,
        tafBeregningsperiodeTil: undefined,
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, someRanges);

      expect(groups).toHaveLength(0);
    });
  });

  describe('eoNummer = "2" (ikke første opgørelse)', () => {
    it('beregningsperiode-gruppe tilføjes IKKE for anden opgørelse', () => {
      const eoValues = makeEoValues({
        eoNummer: '2',
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: iso('2023-01-01'),
        tafBeregningsperiodeTil: iso('2023-12-31'),
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, someRanges);

      const beregningsGruppe = groups.find((g) => g.label === 'Beregningsperiode');
      expect(beregningsGruppe).toBeUndefined();
    });

    it('TAF-gruppe tilføjes stadig for anden opgørelse', () => {
      const eoValues = makeEoValues({
        eoNummer: '2',
        beregnesUdFra: 'Angivet månedsløn',
        vedroererPeriodeFra: iso('2022-01-01'),
        vedroererPeriodeTil: iso('2024-12-31'),
        tafPerioder: [
          { id: 'r1', fra: iso('2023-03-01'), til: iso('2023-05-31'), loseFeriedage: 0 },
        ],
      });

      const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, someRanges);

      const tafGruppe = groups.find((g) => g.label === 'TAF-periode');
      expect(tafGruppe).toBeDefined();
    });
  });

  describe('eoNummer = "1" (første opgørelse)', () => {
    it('beregningsperiode-gruppe tilføjes for "1"', () => {
      const eoValues = makeEoValues({
        eoNummer: '1',
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: iso('2023-01-01'),
        tafBeregningsperiodeTil: iso('2023-12-31'),
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, someRanges);

      const beregningsGruppe = groups.find((g) => g.label === 'Beregningsperiode');
      expect(beregningsGruppe).toBeDefined();
    });
  });

  describe('beregnesUdFra = "TAF" → ingen beregningsperiode-gruppe', () => {
    it('selv for første opgørelse: ingen "Beregningsperiode"-gruppe når beregnesUdFra = "TAF"', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Angivet månedsløn',
        tafBeregningsperiodeFra: iso('2023-01-01'),
        tafBeregningsperiodeTil: iso('2023-12-31'),
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, someRanges);

      const beregningsGruppe = groups.find((g) => g.label === 'Beregningsperiode');
      expect(beregningsGruppe).toBeUndefined();
    });
  });

  describe('allRanges ignoreres i Perioden-mode', () => {
    it('allRanges bruges ikke — output afhænger af eoValues alene', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: iso('2023-01-01'),
        tafBeregningsperiodeTil: iso('2023-06-30'),
        tafPerioder: [],
      });

      const groups1 = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, []);
      const groups2 = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, [
        range(toISODateString('2020-01-01'), toISODateString('2020-12-31')),
        range(toISODateString('2021-01-01'), toISODateString('2021-12-31')),
      ]);

      // Output skal være identisk uanset allRanges
      expect(groups1).toEqual(groups2);
    });
  });

  describe('rækkefølge: Beregningsperiode før TAF', () => {
    it('Beregningsperiode-gruppe er første, TAF-gruppe er anden', () => {
      const eoValues = makeEoValues({
        eoNummer: '1',
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: iso('2023-01-01'),
        tafBeregningsperiodeTil: iso('2023-12-31'),
        vedroererPeriodeFra: iso('2022-01-01'),
        vedroererPeriodeTil: iso('2024-12-31'),
        tafPerioder: [
          { id: 'r1', fra: iso('2023-01-01'), til: iso('2023-06-30'), loseFeriedage: 0 },
        ],
      });

      const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, someRanges);

      expect(groups[0]!.label).toBe('Beregningsperiode');
      expect(groups[1]!.label).toBe('TAF-periode');
    });
  });

  describe('PeriodRangeGroup-struktur', () => {
    it('hver gruppe er Readonly med label og ranges', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: iso('2023-01-01'),
        tafBeregningsperiodeTil: iso('2023-12-31'),
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, EO_BILAG_MODE_PERIODEN, someRanges);

      for (const group of groups) {
        expect(typeof group.label === 'string' || group.label === null).toBe(true);
        expect(Array.isArray(group.ranges)).toBe(true);
      }
    });
  });
});

// ─── splitIsoRangeByCalendarYearsInclusive ────────────────────────────────────

describe('splitIsoRangeByCalendarYearsInclusive', () => {
  it('interval inden for ét kalenderår → ét segment med uændrede grænser', () => {
    const segments = splitIsoRangeByCalendarYearsInclusive(iso('2023-03-15'), iso('2023-09-20'));
    expect(segments).toEqual([
      { fra: iso('2023-03-15'), til: iso('2023-09-20'), year: 2023 },
    ]);
  });

  it('interval på én dag → ét segment', () => {
    const segments = splitIsoRangeByCalendarYearsInclusive(iso('2024-06-15'), iso('2024-06-15'));
    expect(segments).toEqual([
      { fra: iso('2024-06-15'), til: iso('2024-06-15'), year: 2024 },
    ]);
  });

  it('interval over to kalenderår → split ved årsskifte med klampede grænser', () => {
    const segments = splitIsoRangeByCalendarYearsInclusive(iso('2023-11-01'), iso('2024-02-29'));
    expect(segments).toEqual([
      { fra: iso('2023-11-01'), til: iso('2023-12-31'), year: 2023 },
      { fra: iso('2024-01-01'), til: iso('2024-02-29'), year: 2024 },
    ]);
  });

  it('interval over tre kalenderår → mellemste segment dækker hele året', () => {
    const segments = splitIsoRangeByCalendarYearsInclusive(iso('2022-06-01'), iso('2024-04-10'));
    expect(segments).toEqual([
      { fra: iso('2022-06-01'), til: iso('2022-12-31'), year: 2022 },
      { fra: iso('2023-01-01'), til: iso('2023-12-31'), year: 2023 },
      { fra: iso('2024-01-01'), til: iso('2024-04-10'), year: 2024 },
    ]);
  });

  it('segmenterne er sammenhængende og dækker hele intervallet uden huller eller overlap', () => {
    const fra = iso('2020-08-20');
    const til = iso('2023-05-09');
    const segments = splitIsoRangeByCalendarYearsInclusive(fra, til);
    // Første segment starter på fra; sidste slutter på til.
    expect(segments[0]!.fra).toBe(fra);
    expect(segments[segments.length - 1]!.til).toBe(til);
    // Hvert segment fortsætter dagen efter det forrige (ingen huller, intet overlap).
    for (let i = 1; i < segments.length; i += 1) {
      const prevTil = segments[i - 1]!.til;
      const curFra = segments[i]!.fra;
      // Forrige slutter på 12-31, nuværende starter på 01-01 i næste år.
      expect(prevTil.endsWith('-12-31')).toBe(true);
      expect(curFra.endsWith('-01-01')).toBe(true);
      expect(Number.parseInt(curFra.slice(0, 4), 10)).toBe(Number.parseInt(prevTil.slice(0, 4), 10) + 1);
    }
  });

  it('kaster ved omvendt interval (fra > til) — fail-closed', () => {
    expect(() => splitIsoRangeByCalendarYearsInclusive(iso('2024-12-31'), iso('2024-01-01'))).toThrow();
  });
});

// ─── Konstanter ───────────────────────────────────────────────────────────────

describe('EO_BILAG_MODE-konstanter', () => {
  it('EO_BILAG_MODE_ALLE = "Alle"', () => {
    expect(EO_BILAG_MODE_ALLE).toBe('Alle');
  });

  it('EO_BILAG_MODE_PERIODEN = "Perioden"', () => {
    expect(EO_BILAG_MODE_PERIODEN).toBe('Perioden');
  });
});
