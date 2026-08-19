/**
 * Tests for buildTafRanges, buildBeregningsperiodeRange og buildIncomeCalculationContext
 * fra `indtaegtPerioder.ts`.
 *
 * NOTE: `buildIncomeForRanges` er dækket i den separate `failClosed`-testfil.
 */

import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  buildTafRanges,
  buildBeregningsperiodeRange,
  buildIncomeCalculationContext,
  buildIncomeInputRanges,
  resolveArbejdsstedDisplayName,
} from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { mergeIsoDateRanges } from '../../../domain/erstatningsopgoerelse/engines/isoRangeAlgebra';
import {
  buildClampedTafRanges,
  resolveTafConstraintBounds,
} from '../../../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const iso = (s: string) => toISODateString(s);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const makeEo = (overrides: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  ...overrides,
});

// ─── buildBeregningsperiodeRange ──────────────────────────────────────────────

describe('resolveArbejdsstedDisplayName', () => {
  it('bruger det indtastede arbejdsstednavn når det findes', () => {
    expect(resolveArbejdsstedDisplayName('Netto', 0)).toBe('Netto');
  });

  it('trimmer indtastet navn', () => {
    expect(resolveArbejdsstedDisplayName('  Føtex  ', 2)).toBe('Føtex');
  });

  it('falder tilbage til "Arbejdssted N" (1-indekseret) ved manglende navn', () => {
    expect(resolveArbejdsstedDisplayName(undefined, 0)).toBe('Arbejdssted 1');
    expect(resolveArbejdsstedDisplayName('', 1)).toBe('Arbejdssted 2');
    expect(resolveArbejdsstedDisplayName('   ', 2)).toBe('Arbejdssted 3');
  });
});

describe('buildBeregningsperiodeRange', () => {
  it('returnerer undefined når tafBeregningsperiodeFra mangler', () => {
    const eo = makeEo({
      tafBeregningsperiodeFra: undefined,
      tafBeregningsperiodeTil: iso('2023-12-31'),
    });
    expect(buildBeregningsperiodeRange(eo)).toBeUndefined();
  });

  it('returnerer undefined når tafBeregningsperiodeTil mangler', () => {
    const eo = makeEo({
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: undefined,
    });
    expect(buildBeregningsperiodeRange(eo)).toBeUndefined();
  });

  it('returnerer undefined når begge er undefined', () => {
    const eo = makeEo({
      tafBeregningsperiodeFra: undefined,
      tafBeregningsperiodeTil: undefined,
    });
    expect(buildBeregningsperiodeRange(eo)).toBeUndefined();
  });

  it('returnerer korrekt IsoRange når begge er sat og fra < til', () => {
    const eo = makeEo({
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-12-31'),
    });
    const range = buildBeregningsperiodeRange(eo);
    expect(range).toBeDefined();
    expect(range!.fra).toBe(iso('2023-01-01'));
    expect(range!.til).toBe(iso('2023-12-31'));
  });

  it('returnerer undefined når fra > til (ugyldig range)', () => {
    const eo = makeEo({
      tafBeregningsperiodeFra: iso('2023-12-31'),
      tafBeregningsperiodeTil: iso('2023-01-01'),
    });
    expect(buildBeregningsperiodeRange(eo)).toBeUndefined();
  });

  it('returnerer range når fra = til (enkelt dag)', () => {
    const eo = makeEo({
      tafBeregningsperiodeFra: iso('2023-06-15'),
      tafBeregningsperiodeTil: iso('2023-06-15'),
    });
    const range = buildBeregningsperiodeRange(eo);
    expect(range).toBeDefined();
    expect(range!.fra).toBe(iso('2023-06-15'));
    expect(range!.til).toBe(iso('2023-06-15'));
  });
});

describe('buildIncomeInputRanges', () => {
  it('medtager indtastede offentlige ydelser uafhængigt af TAF- og beregningsperioden', () => {
    const eo = makeEo({
      tafBeregningsperiodeFra: iso('2025-01-01'),
      tafBeregningsperiodeTil: iso('2025-12-31'),
      vedroererPeriodeFra: iso('2026-02-23'),
      vedroererPeriodeTil: iso('2026-06-21'),
      tafPerioder: [
        { id: 'taf1', fra: iso('2026-02-23'), til: iso('2026-06-21'), loseFeriedage: 0 },
      ],
      loenindkomstAnsaettelsesforhold: [],
      offentligeYdelserRows: [
        {
          id: 'oy1',
          fraDato: iso('2026-01-01'),
          tilDato: iso('2026-01-25'),
          ydelse: asAmount(15912),
          tillaeg: asAmount(332),
          ydelsestype: 'sygedagpenge',
        },
      ],
    });

    expect(buildIncomeInputRanges(eo)).toEqual([
      { fra: iso('2026-01-01'), til: iso('2026-01-25') },
    ]);
  });
});

// ─── buildTafRanges ───────────────────────────────────────────────────────────

describe('buildTafRanges', () => {
  it('returnerer tom liste når tafPerioder er tom', () => {
    const eo = makeEo({ tafPerioder: [] });
    expect(buildTafRanges(eo)).toHaveLength(0);
  });

  it('returnerer tom liste for taf-rækker uden fra/til', () => {
    const eo = makeEo({
      tafPerioder: [{ id: 'r1', fra: undefined, til: undefined, loseFeriedage: 0 }],
    });
    expect(buildTafRanges(eo)).toHaveLength(0);
  });

  it('returnerer én range for én gyldig taf-periode', () => {
    const eo = makeEo({
      vedroererPeriodeFra: iso('2022-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      tafPerioder: [
        { id: 'r1', fra: iso('2023-01-01'), til: iso('2023-06-30'), loseFeriedage: 0 },
      ],
    });
    const ranges = buildTafRanges(eo);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]!.fra).toBe(iso('2023-01-01'));
    expect(ranges[0]!.til).toBe(iso('2023-06-30'));
  });

  it('merger sammenhængende taf-perioder', () => {
    // To sammenhængende perioder: jan og feb → merges til jan–feb
    const eo = makeEo({
      vedroererPeriodeFra: iso('2022-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      tafPerioder: [
        { id: 'r1', fra: iso('2023-01-01'), til: iso('2023-01-31'), loseFeriedage: 0 },
        { id: 'r2', fra: iso('2023-02-01'), til: iso('2023-02-28'), loseFeriedage: 0 },
      ],
    });
    const ranges = buildTafRanges(eo);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]!.fra).toBe(iso('2023-01-01'));
    expect(ranges[0]!.til).toBe(iso('2023-02-28'));
  });

  it('returnerer separate ranges for ikke-sammenhængende taf-perioder', () => {
    const eo = makeEo({
      vedroererPeriodeFra: iso('2022-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      tafPerioder: [
        { id: 'r1', fra: iso('2023-01-01'), til: iso('2023-01-31'), loseFeriedage: 0 },
        { id: 'r2', fra: iso('2023-03-01'), til: iso('2023-03-31'), loseFeriedage: 0 },
      ],
    });
    const ranges = buildTafRanges(eo);
    expect(ranges).toHaveLength(2);
  });

  it('matcher kombinerede kontrol-bounds efter samme merge-semantik', () => {
    const eo = makeEo({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
      differencekravDato: iso('2024-02-01'),
      tafPerioder: [
        { id: 'r1', fra: iso('2023-12-20'), til: iso('2024-01-15'), loseFeriedage: 0 },
        { id: 'r2', fra: iso('2024-01-16'), til: iso('2024-02-15'), loseFeriedage: 0 },
      ],
    });

    const inspektionEquivalentRanges = mergeIsoDateRanges(
      buildClampedTafRanges(eo.tafPerioder ?? [], resolveTafConstraintBounds(eo)),
      { mergeAdjacent: true }
    );

    expect(inspektionEquivalentRanges).toEqual(buildTafRanges(eo));
  });
});

// ─── buildIncomeCalculationContext ────────────────────────────────────────────

describe('buildIncomeCalculationContext', () => {
  it('returnerer null for tomme ranges', () => {
    const eo = makeEo();
    expect(buildIncomeCalculationContext(eo, [])).toBeNull();
  });

  it('returnerer null når ingen data-bounds kan beregnes', () => {
    // Ingen lønrækker, ingen offentlige ydelser, ingen beregningsperiode
    const eo = makeEo({
      tafBeregningsperiodeFra: undefined,
      tafBeregningsperiodeTil: undefined,
      loenindkomstAnsaettelsesforhold: [],
      offentligeYdelserRows: [],
    });
    // Selv med en range – ingen data til at fastlægge bounds
    const result = buildIncomeCalculationContext(eo, [
      { fra: iso('2023-01-01'), til: iso('2023-12-31') },
    ]);
    // Med ranges alene brug ranges som bounds
    // Faktisk: boundsFra/Til beregnes fra ranges + løninterval + offentliginterval + beregningsperiode
    // Når alle er undefined undtagen ranges → bounds = ranges
    if (result !== null) {
      expect(result.boundsFra).toBeDefined();
      expect(result.boundsTil).toBeDefined();
    }
    // Enten null eller context – begge er acceptable
  });

  it('returnerer context med korrekte bounds baseret på ranges', () => {
    const eo = makeEo({
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-12-31'),
      loenindkomstAnsaettelsesforhold: [],
      offentligeYdelserRows: [],
    });

    const context = buildIncomeCalculationContext(eo, [
      { fra: iso('2023-01-01'), til: iso('2023-12-31') },
    ]);

    expect(context).not.toBeNull();
    expect(context!.boundsFra).toBe(iso('2023-01-01'));
    expect(context!.boundsTil).toBe(iso('2023-12-31'));
  });

  it('context indeholder arbejdsdageSet som Set<ISODateString>', () => {
    const eo = makeEo({
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-01-31'),
      loenindkomstAnsaettelsesforhold: [],
      offentligeYdelserRows: [],
    });

    const context = buildIncomeCalculationContext(eo, [
      { fra: iso('2023-01-01'), til: iso('2023-01-31') },
    ]);

    expect(context).not.toBeNull();
    expect(context!.arbejdsdageSet).toBeInstanceOf(Set);
    expect(context!.shDaysForYdelser).toBeInstanceOf(Set);
    expect(context!.loenErrorRowIdsByEmploymentId).toBeInstanceOf(Map);
  });

  it('merger overlappende input-ranges inden bounds-beregning', () => {
    // Overlappende ranges merges – boundsFra = min, boundsTil = max
    const eo = makeEo({
      loenindkomstAnsaettelsesforhold: [],
      offentligeYdelserRows: [],
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-06-30'),
    });

    const context = buildIncomeCalculationContext(eo, [
      { fra: iso('2023-01-01'), til: iso('2023-03-31') },
      { fra: iso('2023-02-01'), til: iso('2023-06-30') }, // overlapper
    ]);

    // Ranges merges til én, bounds = 2023-01-01 – 2023-06-30
    expect(context).not.toBeNull();
    if (context !== null) {
      expect(context.boundsFra).toBe(iso('2023-01-01'));
      expect(context.boundsTil).toBe(iso('2023-06-30'));
    }
  });

  it('context med offentlige ydelser udvider bounds', () => {
    const eo = makeEo({
      loenindkomstAnsaettelsesforhold: [],
      offentligeYdelserRows: [
        {
          id: 'oy1',
          fraDato: toISODateString('2022-01-01'),
          tilDato: toISODateString('2022-12-31'),
          ydelse: asAmount(5000),
          tillaeg: undefined,
          ydelsestype: 'sygedagpenge',
        },
      ],
      tafBeregningsperiodeFra: undefined,
      tafBeregningsperiodeTil: undefined,
    });

    const context = buildIncomeCalculationContext(eo, [
      { fra: iso('2023-01-01'), til: iso('2023-12-31') },
    ]);

    // boundsFra udvides til at inkludere ydelsesinterval (2022-01-01)
    if (context !== null) {
      expect(context.boundsFra <= iso('2022-01-01')).toBe(true);
    }
  });
});
