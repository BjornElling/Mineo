import { toLoentrin } from '../../../data/offentligLoenTypes';
import { byggReguleringsResultat } from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringFormRegistry';
import type { KonsolideretLoenudvikling } from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringForm';
import { buildReguleringsbevis, reguleringsbevisSchema } from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringsbevis';
import { computeFormulaValue } from '../../../domain/erstatningsopgoerelse/engines/reguleringFormulaUtils';
import { toISODateString } from '../../../types/branded';

const iso = toISODateString;
const common = {
  label: 'Test', reguleringsdato: iso('2024-01-01'),
  tafRanges: [{ fra: iso('2024-01-01'), til: iso('2025-06-30') }],
};
const packageCommon = {
  ...common, strategi: 'overenskomst', overenskomstId: 'bygge-anlaeg',
  loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: true,
  feriePct: 12.5, fritvalgPct: 7, shSoPct: 0, pensionPct: 12,
  tafBeregningsenhed: 'Måneder', harAnciennitetstillaegEfterSkadedatoen: false,
  anciennitetstillaegDato: undefined, anciennitetstillaegSatsAngivesPer: 'Måned',
  anciennitetstillaegSatsValue: undefined, offentligLoenEkstraGrundloen: 0, offentlig: null,
} as const;

const models: ReadonlyArray<Readonly<{ name: string; model: KonsolideretLoenudvikling }>> = [
  { name: 'privat overenskomst', model: packageCommon },
  { name: 'offentlig overenskomst', model: {
    ...packageCommon, overenskomstId: 'kl-overenskomst', offentligLoenEkstraGrundloen: 1200,
    offentlig: { overenskomstType: 'KL', loenType: 'maanedsLoen', loentrin: toLoentrin(1), loengruppe: 0 },
  } },
  { name: 'statistik', model: { ...common, strategi: 'statistik', statistikModel: 'ILON12 (Danmarks Statistik)' } },
  { name: 'ASL', model: { ...common, strategi: 'statistik', statistikModel: 'ASL-årslønsmaksimum' } },
  { name: 'KRL', model: { ...common, strategi: 'krl', krlSatstabelId: 'KTO (kommuner)' } },
  { name: 'manuel procentsats', model: {
    ...common, strategi: 'manualProcentsats', manualProcentsatsRows: [
      { id: 'base', dato: iso('2024-01-01'), procent: 0 },
      { id: 'change', dato: iso('2025-01-01'), procent: 2.28 },
    ],
  } },
];

describe('autoritativt reguleringsgrundlag', () => {
  it('bevarer KL-lønaftalernes faktiske nulbasis med neutral regulering', () => {
    const proof = buildReguleringsbevis(0, 0, { kind: 'klLoenaftaler' });
    expect(proof).toEqual({
      kind: 'klLoenaftaler', referenceValue: 0, periodValue: 0,
      rawFactor: 1, rawDeltaPct: 0, appliedDeltaPct: 0,
    });
    for (const patch of [
      { kind: 'ingen' }, { kind: 'indeks' }, { kind: 'procentsats' }, { kind: 'pakke' },
      { referenceValue: 1 }, { periodValue: 1 }, { referenceValue: -1 },
      { rawFactor: 2 }, { rawDeltaPct: 1 }, { appliedDeltaPct: 1 },
    ]) {
      expect(reguleringsbevisSchema.safeParse({ ...proof, ...patch }).success).toBe(false);
    }
  });

  it('afviser et lønpakkegrundlag uden de komponenter, som visningen skal vise', () => {
    expect(reguleringsbevisSchema.safeParse({
      kind: 'pakke', referenceValue: 100, periodValue: 102.28,
      rawFactor: 1.0228, rawDeltaPct: 2.28, appliedDeltaPct: 2.28,
    }).success).toBe(false);
    const evidence = byggReguleringsResultat(packageCommon).segmenter[0]?.regulering;
    expect(reguleringsbevisSchema.safeParse({ ...evidence, kind: 'indeks' }).success).toBe(false);
  });

  it.each(models)('$name: udstiller de evaluerede værdier, som producerer segmentets regulering', ({ model }) => {
    const result = byggReguleringsResultat(model);
    expect(result.segmenter.length).toBeGreaterThan(0);
    for (const segment of result.segmenter) {
      const evidence = reguleringsbevisSchema.parse(segment.regulering);
      expect(evidence.appliedDeltaPct).toBe(segment.deltaPct);
      expect(evidence.rawFactor).toBe(evidence.periodValue / evidence.referenceValue);
      if (evidence.referenceComponents && evidence.periodComponents) {
        expect(computeFormulaValue(evidence.referenceComponents)).toBe(evidence.referenceValue);
        expect(computeFormulaValue(evidence.periodComponents)).toBe(evidence.periodValue);
      }
    }
  });

  it('bevarer den oprindelige manuelle kædes afrunding ved en binær halvgrænse', () => {
    const result = byggReguleringsResultat({
      ...common, strategi: 'manualProcentsats', manualProcentsatsRows: [
        { id: 'base', dato: iso('2024-01-01'), procent: 0 },
        { id: 'first', dato: iso('2024-02-01'), procent: 0.2 },
        { id: 'second', dato: iso('2024-03-01'), procent: 2.5 },
      ],
    });
    const evidence = result.segmenter.at(-1)?.regulering;
    expect(evidence?.periodValue).toBe(102.705);
    expect(evidence?.rawDeltaPct).toBe(2.7049999999999983);
    expect(evidence?.appliedDeltaPct).toBe(2.7);
    // Et nyt indeksforhold ville ligge på den anden side af halvgrænsen og ændre eksisterende beløb.
    expect(evidence && (evidence.rawFactor - 1) * 100).toBeGreaterThan(2.705);
  });

  it('bevarer overenskomstens SH-kildekolonne, selv om den anvendte SH-sats er nul', () => {
    const result = byggReguleringsResultat({ ...packageCommon, overenskomstId: 'maskinhandler-overenskomsten', shSoPct: 2.7 });
    const evidence = result.segmenter[0]?.regulering;
    expect(evidence?.referenceComponents?.shSoPct).toBe(0);
    expect(evidence?.periodComponents?.shSoPct).toBe(0);
    expect(evidence?.sourceColumns).toContain('shSoPct');
  });

  it('daterer basispakken fra Store Bededags ikrafttræden, selv om den underliggende sats er fra 2023', () => {
    const result = byggReguleringsResultat(packageCommon);
    const evidence = result.segmenter[0]?.regulering;
    expect(evidence?.referenceComponents?.storeBededagPct).toBe(0.45);
    expect(evidence?.referenceDate).toBe(iso('2024-01-01'));
  });

  it('bevarer fritvalg og pension i både manuel basis og periode – lønstigningen er 2,28 %', () => {
    const model: KonsolideretLoenudvikling = {
      strategi: 'manual', label: 'Manuelt angivet', reguleringsdato: iso('2025-06-30'),
      loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: true, feriePct: 15,
      manualRows: [
        { id: 'base', dato: iso('2025-06-30'), grundloen: { kind: 'number', value: 33436.04 }, feriepenge: 15, shSoSats: 0, fritvalg: 7.43, agPension: 12 },
        { id: 'change', dato: iso('2026-03-01'), grundloen: { kind: 'number', value: 34197.61 }, feriepenge: 15, shSoSats: 0, fritvalg: 7.43, agPension: 12 },
      ],
      tafRanges: [{ fra: iso('2025-07-01'), til: iso('2026-03-31') }],
    };
    const result = byggReguleringsResultat(model);
    expect(result.segmenter.map((segment) => segment.deltaPct)).toEqual([0, 2.28]);
    const changed = result.segmenter[1]?.regulering;
    expect(changed?.referenceComponents).toMatchObject({ fritvalgPct: 7.43, pensionPct: 12 });
    expect(changed?.periodComponents).toMatchObject({ fritvalgPct: 7.43, pensionPct: 12 });
    expect(changed?.rawFactor).toBeCloseTo(34197.61 / 33436.04, 12);
    expect(changed?.periodRateDate).toBe(iso('2026-03-01'));
  });
});
