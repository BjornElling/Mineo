import type { ISODateString } from '../../../types/branded';
import {
  normalizeBilagIndkomstYdelserMode,
  buildPeriodRangeGroups,
  BILAG_MODE_ALLE,
  BILAG_MODE_PERIODEN,
  type IsoRange,
} from '../../../domain/erstatningsopgoerelse/periodRangeGroups';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

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

// ─── normalizeBilagIndkomstYdelserMode ────────────────────────────────────────

describe('normalizeBilagIndkomstYdelserMode', () => {
  it('"Alle" → BILAG_MODE_ALLE', () => {
    expect(normalizeBilagIndkomstYdelserMode('Alle')).toBe(BILAG_MODE_ALLE);
  });

  it('"Perioden" → BILAG_MODE_PERIODEN', () => {
    expect(normalizeBilagIndkomstYdelserMode('Perioden')).toBe(BILAG_MODE_PERIODEN);
  });
});

// ─── buildPeriodRangeGroups – mode "Alle" ─────────────────────────────────────

describe('buildPeriodRangeGroups – Alle', () => {
  const allRanges: readonly IsoRange[] = [
    range('2023-01-01', '2023-06-30'),
    range('2023-07-01', '2023-12-31'),
  ];

  it('returnerer én gruppe med label=null og alle ranges uændret', () => {
    const eoValues = makeEoValues();
    const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_ALLE, allRanges);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBeNull();
    expect(groups[0]!.ranges).toBe(allRanges);
  });

  it('returnerer tom gruppe (label=null) med tomme allRanges', () => {
    const eoValues = makeEoValues();
    const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_ALLE, []);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBeNull();
    expect(groups[0]!.ranges).toHaveLength(0);
  });

  it('allRanges passes igennem uforandret (reference-identitet)', () => {
    const eoValues = makeEoValues();
    const allRanges: readonly IsoRange[] = [range('2023-03-01', '2023-03-31')];
    const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_ALLE, allRanges);
    expect(groups[0]!.ranges).toBe(allRanges);
  });
});

// ─── buildPeriodRangeGroups – mode "Perioden" ─────────────────────────────────

describe('buildPeriodRangeGroups – Perioden', () => {
  const someRanges: readonly IsoRange[] = [range('2023-01-01', '2023-12-31')];

  describe('eoNummer = undefined (første opgørelse)', () => {
    it('med beregningsperiode og ingen TAF → én "Beregningsperiode"-gruppe', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Beregningsperiode',
        periodeTilBeregningFra: iso('2023-01-01'),
        periodeTilBeregningTil: iso('2023-12-31'),
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, someRanges);

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
        beregnesUdFra: 'TAF',
        periodeTilBeregningFra: undefined,
        periodeTilBeregningTil: undefined,
        vedroererPeriodeFra: iso('2022-01-01'),
        vedroererPeriodeTil: iso('2024-12-31'),
        tafPerioder: [
          { id: 'r1', fra: iso('2023-03-01'), til: iso('2023-05-31'), loseFeriedage: 0 },
        ],
      });

      const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, someRanges);

      expect(groups).toHaveLength(1);
      const tafGruppe = groups.find((g) => g.label === 'TAF-periode');
      expect(tafGruppe).toBeDefined();
      expect(tafGruppe!.ranges.length).toBeGreaterThan(0);
    });

    it('med beregningsperiode OG TAF → to grupper', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Beregningsperiode',
        periodeTilBeregningFra: iso('2023-01-01'),
        periodeTilBeregningTil: iso('2023-12-31'),
        vedroererPeriodeFra: iso('2022-01-01'),
        vedroererPeriodeTil: iso('2024-12-31'),
        tafPerioder: [
          { id: 'r1', fra: iso('2023-01-01'), til: iso('2023-06-30'), loseFeriedage: 0 },
        ],
      });

      const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, someRanges);

      expect(groups).toHaveLength(2);
      const labels = groups.map((g) => g.label);
      expect(labels).toContain('Beregningsperiode');
      expect(labels).toContain('TAF-periode');
    });

    it('uden beregningsperiode og uden TAF → tomme grupper', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Beregningsperiode',
        periodeTilBeregningFra: undefined,
        periodeTilBeregningTil: undefined,
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, someRanges);

      expect(groups).toHaveLength(0);
    });
  });

  describe('eoNummer = "2" (ikke første opgørelse)', () => {
    it('beregningsperiode-gruppe tilføjes IKKE for anden opgørelse', () => {
      const eoValues = makeEoValues({
        eoNummer: '2',
        beregnesUdFra: 'Beregningsperiode',
        periodeTilBeregningFra: iso('2023-01-01'),
        periodeTilBeregningTil: iso('2023-12-31'),
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, someRanges);

      const beregningsGruppe = groups.find((g) => g.label === 'Beregningsperiode');
      expect(beregningsGruppe).toBeUndefined();
    });

    it('TAF-gruppe tilføjes stadig for anden opgørelse', () => {
      const eoValues = makeEoValues({
        eoNummer: '2',
        beregnesUdFra: 'TAF',
        vedroererPeriodeFra: iso('2022-01-01'),
        vedroererPeriodeTil: iso('2024-12-31'),
        tafPerioder: [
          { id: 'r1', fra: iso('2023-03-01'), til: iso('2023-05-31'), loseFeriedage: 0 },
        ],
      });

      const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, someRanges);

      const tafGruppe = groups.find((g) => g.label === 'TAF-periode');
      expect(tafGruppe).toBeDefined();
    });
  });

  describe('eoNummer = "1" (første opgørelse)', () => {
    it('beregningsperiode-gruppe tilføjes for "1"', () => {
      const eoValues = makeEoValues({
        eoNummer: '1',
        beregnesUdFra: 'Beregningsperiode',
        periodeTilBeregningFra: iso('2023-01-01'),
        periodeTilBeregningTil: iso('2023-12-31'),
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, someRanges);

      const beregningsGruppe = groups.find((g) => g.label === 'Beregningsperiode');
      expect(beregningsGruppe).toBeDefined();
    });
  });

  describe('beregnesUdFra = "TAF" → ingen beregningsperiode-gruppe', () => {
    it('selv for første opgørelse: ingen "Beregningsperiode"-gruppe når beregnesUdFra = "TAF"', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'TAF',
        periodeTilBeregningFra: iso('2023-01-01'),
        periodeTilBeregningTil: iso('2023-12-31'),
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, someRanges);

      const beregningsGruppe = groups.find((g) => g.label === 'Beregningsperiode');
      expect(beregningsGruppe).toBeUndefined();
    });
  });

  describe('allRanges ignoreres i Perioden-mode', () => {
    it('allRanges bruges ikke — output afhænger af eoValues alene', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Beregningsperiode',
        periodeTilBeregningFra: iso('2023-01-01'),
        periodeTilBeregningTil: iso('2023-06-30'),
        tafPerioder: [],
      });

      const groups1 = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, []);
      const groups2 = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, [
        range('2020-01-01', '2020-12-31'),
        range('2021-01-01', '2021-12-31'),
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
        periodeTilBeregningFra: iso('2023-01-01'),
        periodeTilBeregningTil: iso('2023-12-31'),
        vedroererPeriodeFra: iso('2022-01-01'),
        vedroererPeriodeTil: iso('2024-12-31'),
        tafPerioder: [
          { id: 'r1', fra: iso('2023-01-01'), til: iso('2023-06-30'), loseFeriedage: 0 },
        ],
      });

      const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, someRanges);

      expect(groups[0]!.label).toBe('Beregningsperiode');
      expect(groups[1]!.label).toBe('TAF-periode');
    });
  });

  describe('PeriodRangeGroup-struktur', () => {
    it('hver gruppe er Readonly med label og ranges', () => {
      const eoValues = makeEoValues({
        eoNummer: undefined,
        beregnesUdFra: 'Beregningsperiode',
        periodeTilBeregningFra: iso('2023-01-01'),
        periodeTilBeregningTil: iso('2023-12-31'),
        tafPerioder: [],
      });

      const groups = buildPeriodRangeGroups(eoValues, BILAG_MODE_PERIODEN, someRanges);

      for (const group of groups) {
        expect(typeof group.label === 'string' || group.label === null).toBe(true);
        expect(Array.isArray(group.ranges)).toBe(true);
      }
    });
  });
});

// ─── Konstanter ───────────────────────────────────────────────────────────────

describe('BILAG_MODE-konstanter', () => {
  it('BILAG_MODE_ALLE = "Alle"', () => {
    expect(BILAG_MODE_ALLE).toBe('Alle');
  });

  it('BILAG_MODE_PERIODEN = "Perioden"', () => {
    expect(BILAG_MODE_PERIODEN).toBe('Perioden');
  });
});
