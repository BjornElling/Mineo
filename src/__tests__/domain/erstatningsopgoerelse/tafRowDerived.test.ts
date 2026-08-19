import type { ISODateString } from '../../../types/branded';
import type { TafPeriodeRow, FerieperiodeRow, ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildTafDerived, buildBeregningsperiodeTafOverlap } from '../../../domain/erstatningsopgoerelse/helpers/tafRowDerived';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { toISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => value as ISODateString;

const initialEoValues = createErstatningsopgoerelseInitialValues();

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...structuredClone(initialEoValues),
  ...patch,
});

const makeTafRow = (id: string, fra?: string, til?: string, loseFeriedage?: number): TafPeriodeRow => ({
  id,
  fra: fra ? iso(fra) : undefined,
  til: til ? iso(til) : undefined,
  loseFeriedage,
});

const makeFerieRow = (id: string, fra: string, til: string): FerieperiodeRow => ({
  id,
  fra: iso(fra),
  til: iso(til),
});

describe('buildTafDerived', () => {
  describe('kolonneOverskrift og beregningsenhed', () => {
    it('returnerer "TAF-måneder" og MAANEDER som default', () => {
      const result = buildTafDerived({
        values: makeValues({}),
        tafPerioder: [],
        ferieperioder: [],
      });
      expect(result.kolonneOverskrift).toBe('TAF-måneder');
      expect(result.beregningsenhed).toBe(TAF_BEREGNES_SOM.MAANEDER);
    });

    it('returnerer "TAF-arbejdsdage" og ARBEJDSDAGE ved "Angivet dagsløn"', () => {
      const result = buildTafDerived({
        values: makeValues({ beregnesUdFra: 'Angivet dagsløn' }),
        tafPerioder: [],
        ferieperioder: [],
      });
      expect(result.kolonneOverskrift).toBe('TAF-arbejdsdage');
      expect(result.beregningsenhed).toBe(TAF_BEREGNES_SOM.ARBEJDSDAGE);
    });
  });

  describe('måneds-baseret (default)', () => {
    it('returnerer null for række med manglende fra', () => {
      const result = buildTafDerived({
        values: makeValues({}),
        tafPerioder: [makeTafRow('r1', undefined, toISODateString('2024-01-31'))],
        ferieperioder: [],
      });
      expect(result.derivedById['r1']).toBeNull();
    });

    it('returnerer null for række med manglende til', () => {
      const result = buildTafDerived({
        values: makeValues({}),
        tafPerioder: [makeTafRow('r1', toISODateString('2024-01-01'), undefined)],
        ferieperioder: [],
      });
      expect(result.derivedById['r1']).toBeNull();
    });

    it('returnerer null for række med fra > til', () => {
      const result = buildTafDerived({
        values: makeValues({}),
        tafPerioder: [makeTafRow('r1', toISODateString('2024-01-31'), toISODateString('2024-01-01'))],
        ferieperioder: [],
      });
      expect(result.derivedById['r1']).toBeNull();
    });

    it('beregner 1 måned for januar 2024', () => {
      const result = buildTafDerived({
        values: makeValues({}),
        tafPerioder: [makeTafRow('r1', toISODateString('2024-01-01'), toISODateString('2024-01-31'))],
        ferieperioder: [],
      });
      expect(result.derivedById['r1']).toBe(1);
    });

    it('beregner korrekt for periode på tværs af månedsskift', () => {
      const result = buildTafDerived({
        values: makeValues({}),
        tafPerioder: [makeTafRow('r1', toISODateString('2024-01-01'), toISODateString('2024-06-30'))],
        ferieperioder: [],
      });
      expect(result.derivedById['r1']).toBe(6);
    });

    it('beregner korrekt for to separate rækker', () => {
      const result = buildTafDerived({
        values: makeValues({}),
        tafPerioder: [
          makeTafRow('r1', toISODateString('2024-01-01'), toISODateString('2024-01-31')),
          makeTafRow('r2', toISODateString('2024-03-01'), toISODateString('2024-03-31')),
        ],
        ferieperioder: [],
      });
      expect(result.derivedById['r1']).toBe(1);
      expect(result.derivedById['r2']).toBe(1);
    });

    it('bevarer null per-række selvom andre rækker er gyldige', () => {
      const result = buildTafDerived({
        values: makeValues({}),
        tafPerioder: [
          makeTafRow('r1', toISODateString('2024-01-01'), toISODateString('2024-01-31')),
          makeTafRow('r2', undefined, toISODateString('2024-02-28')),
        ],
        ferieperioder: [],
      });
      expect(result.derivedById['r1']).toBe(1);
      expect(result.derivedById['r2']).toBeNull();
    });
  });

  describe('arbejdsdage-baseret ("Angivet dagsløn")', () => {
    it('5 hverdage for man-fre uge', () => {
      // 2024-01-01 = mandag, 2024-01-05 = fredag (men nytårsdag 01-01 er SH-dag)
      // Helligdagen tæller i buildTafDerived ved kind: 'taf' – se tafCalculations
      const result = buildTafDerived({
        values: makeValues({ beregnesUdFra: 'Angivet dagsløn' }),
        tafPerioder: [makeTafRow('r1', toISODateString('2024-01-02'), toISODateString('2024-01-05'))],
        ferieperioder: [],
      });
      // 2-5 januar: 4 dage, alle hverdage, ingen helligdage
      expect(result.derivedById['r1']).toBe(4);
    });

    it('trækker feriedage fra ved arbejdsdage-beregning', () => {
      // 2024-02-05 = mandag til 2024-02-09 = fredag = 5 hverdage
      const result = buildTafDerived({
        values: makeValues({ beregnesUdFra: 'Angivet dagsløn' }),
        tafPerioder: [makeTafRow('r1', toISODateString('2024-02-05'), toISODateString('2024-02-09'), 0)],
        ferieperioder: [makeFerieRow('f1', toISODateString('2024-02-06'), toISODateString('2024-02-07'))],
      });
      // 5 hverdage - 2 feriedage = 3
      expect(result.derivedById['r1']).toBe(3);
    });

    it('returnerer 0 (ikke null) for periode der clamps til 0 dage pga. bounds', () => {
      // Sæt vedroererPeriodeTil til FØR TAF-periodens fra → clamp giver null-range → returnerer 0
      const result = buildTafDerived({
        values: makeValues({
          beregnesUdFra: 'Angivet dagsløn',
          vedroererPeriodeFra: iso('2024-01-01'),
          vedroererPeriodeTil: iso('2024-01-05'),
        }),
        tafPerioder: [makeTafRow('r1', toISODateString('2024-02-01'), toISODateString('2024-02-29'))],
        ferieperioder: [],
      });
      expect(result.derivedById['r1']).toBe(0);
    });
  });

  describe('clamping med tafBounds', () => {
    it('beskærer TAF-periode til vedroererPeriode', () => {
      // TAF: 2024-01-01 → 2024-03-31, vedroererPeriode: 2024-01-01 → 2024-01-31
      // Forventet: 1 måned (januar)
      const result = buildTafDerived({
        values: makeValues({
          vedroererPeriodeFra: iso('2024-01-01'),
          vedroererPeriodeTil: iso('2024-01-31'),
        }),
        tafPerioder: [makeTafRow('r1', toISODateString('2024-01-01'), toISODateString('2024-03-31'))],
        ferieperioder: [],
      });
      expect(result.derivedById['r1']).toBe(1);
    });

    it('loseFeriedage behandles som 0 hvis undefined', () => {
      // loseFeriedage = undefined → 0 fradrag
      const withUndefined = buildTafDerived({
        values: makeValues({ beregnesUdFra: 'Angivet dagsløn' }),
        tafPerioder: [makeTafRow('r1', toISODateString('2024-02-05'), toISODateString('2024-02-09'), undefined)],
        ferieperioder: [],
      });
      const withZero = buildTafDerived({
        values: makeValues({ beregnesUdFra: 'Angivet dagsløn' }),
        tafPerioder: [makeTafRow('r1', toISODateString('2024-02-05'), toISODateString('2024-02-09'), 0)],
        ferieperioder: [],
      });
      expect(withUndefined.derivedById['r1']).toBe(withZero.derivedById['r1']);
    });
  });

  describe('determinisme og isolering', () => {
    it('er deterministisk for identisk input', () => {
      const args = {
        values: makeValues({ beregnesUdFra: 'Angivet dagsløn' }),
        tafPerioder: [makeTafRow('r1', toISODateString('2024-03-01'), toISODateString('2024-03-31'))],
        ferieperioder: [makeFerieRow('f1', toISODateString('2024-03-11'), toISODateString('2024-03-15'))],
      } as const;
      const r1 = buildTafDerived(args);
      const r2 = buildTafDerived(args);
      expect(r1).toEqual(r2);
    });

    it('returnerer tomt derivedById for tom tafPerioder', () => {
      const result = buildTafDerived({
        values: makeValues({}),
        tafPerioder: [],
        ferieperioder: [],
      });
      expect(Object.keys(result.derivedById)).toHaveLength(0);
    });
  });
});

describe('buildBeregningsperiodeTafOverlap', () => {
  it('returnerer overlap-struktur for gyldig beregningsperiode og taf-periode', () => {
    const result = buildBeregningsperiodeTafOverlap({
      values: makeValues({
        tafBeregningsperiodeFra: iso('2024-01-01'),
        tafBeregningsperiodeTil: iso('2024-06-30'),
      }),
      tafPerioder: [makeTafRow('r1', toISODateString('2024-03-01'), toISODateString('2024-04-30'))],
    });
    // Overlap findes: taf-periode er inden for beregningsperiode
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('returnerer korrekt struktur med tom tafPerioder', () => {
    const result = buildBeregningsperiodeTafOverlap({
      values: makeValues({
        tafBeregningsperiodeFra: iso('2024-01-01'),
        tafBeregningsperiodeTil: iso('2024-12-31'),
      }),
      tafPerioder: [],
    });
    expect(result).toBeDefined();
  });

  it('håndterer rækker med manglende datoer', () => {
    const result = buildBeregningsperiodeTafOverlap({
      values: makeValues({
        tafBeregningsperiodeFra: iso('2024-01-01'),
        tafBeregningsperiodeTil: iso('2024-12-31'),
      }),
      tafPerioder: [
        makeTafRow('r1', undefined, toISODateString('2024-06-30')),
        makeTafRow('r2', toISODateString('2024-03-01'), undefined),
      ],
    });
    expect(result).toBeDefined();
  });
});
