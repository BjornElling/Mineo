import { buildOverenskomstSegmentContext } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstSegmentContext';
import { buildOffentligOverenskomstSegmenter } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstOffentligSegmenter';
import { buildPrivatOverenskomstSegmenter } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstPrivatSegmenter';
import type { KonsolideretLoenudvikling } from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringForm';
import { toLoentrin } from '../../../data/offentligLoenTypes';
import { STORE_BEDEDAG_START } from '../../../data/indskudteLoentillaeg';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const invalidIso = (value: string): ISODateString => value as ISODateString;
type Overenskomst = Extract<KonsolideretLoenudvikling, { strategi: 'overenskomst' }>;
type OffentligSelection = NonNullable<Overenskomst['offentlig']>;

const offentligSelection: OffentligSelection = {
  overenskomstType: 'KL',
  loenType: 'maanedsLoen',
  loentrin: toLoentrin(1),
  loengruppe: 0,
};

const createOverenskomst = (overrides: Partial<Overenskomst> = {}): Overenskomst => ({
  strategi: 'overenskomst',
  label: 'Overenskomst',
  reguleringsdato: iso('2024-04-01'),
  overenskomstId: 'bygge-anlaeg',
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.INGEN,
  beregnStoreBededagstillaeg: false,
  feriePct: 0,
  fritvalgPct: 0,
  shSoPct: 0,
  pensionPct: 0,
  harAnciennitetstillaegEfterSkadedatoen: false,
  anciennitetstillaegDato: undefined,
  anciennitetstillaegSatsAngivesPer: 'Måned',
  anciennitetstillaegSatsValue: undefined,
  offentligLoenEkstraGrundloen: 0,
  offentligLoenEkstraGrundloenAngivesPer: 'Måned',
  offentlig: null,
  tafRanges: [{ fra: iso('2024-04-01'), til: iso('2025-03-31') }],
  ...overrides,
});

const withSegment = (
  result: ReadonlyArray<{ fra: ISODateString; til: ISODateString; deltaPct: number }>,
  date: ISODateString
) => result.find((segment) => segment.fra === date);

describe('overenskomst-segmentbyggere', () => {
  it('bygger privat serie med historiske satser, Store Bededag og anciennitet', () => {
    const konsolideret = createOverenskomst({
      reguleringsdato: iso('2013-01-01'),
      beregnStoreBededagstillaeg: true,
      tafRanges: [{ fra: iso('2013-01-01'), til: iso('2024-12-31') }],
      harAnciennitetstillaegEfterSkadedatoen: true,
      anciennitetstillaegDato: iso('2024-06-01'),
      anciennitetstillaegSatsValue: 25,
    });

    const result = buildPrivatOverenskomstSegmenter(
      konsolideret,
      buildOverenskomstSegmentContext(konsolideret)
    );
    expect(withSegment(result, iso('2013-01-01'))?.deltaPct).toBe(0);
    expect(withSegment(result, STORE_BEDEDAG_START)).toBeDefined();
    expect(withSegment(result, iso('2024-06-01'))).toBeDefined();
    expect(result.some((segment) => segment.deltaPct !== 0)).toBe(true);
  });

  it('afviser privat serie uden TAF-intervaller', () => {
    const konsolideret = createOverenskomst({ tafRanges: [] });

    expect(() => buildPrivatOverenskomstSegmenter(
      konsolideret,
      buildOverenskomstSegmentContext(konsolideret)
    )).toThrow('Loenudvikling kan ikke beregnes: ingen overenskomstsegmenter');
  });

  it('afviser privat serie når reguleringsdatoen ligger før første sats', () => {
    const konsolideret = createOverenskomst({ reguleringsdato: iso('2000-01-01') });
    expect(() => buildPrivatOverenskomstSegmenter(konsolideret,
      buildOverenskomstSegmentContext(konsolideret))).toThrow('Loenudvikling kan ikke beregnes: basissats mangler');
  });

  it('afviser privat serie med ugyldigt TAF-interval', () => {
    const konsolideret = createOverenskomst({
      tafRanges: [{ fra: invalidIso('ikke-en-dato'), til: iso('2024-12-31') }],
    });

    expect(() => buildPrivatOverenskomstSegmenter(
      konsolideret,
      buildOverenskomstSegmentContext(konsolideret)
    )).toThrow('Loenudvikling kan ikke beregnes: ugyldigt segmentinterval');
  });

  it('afviser TAF før privat dækning, også med en dækket reguleringsdato', () => {
    const konsolideret = createOverenskomst({
      tafRanges: [{ fra: iso('2000-01-01'), til: iso('2011-12-31') }],
    });
    expect(() => buildPrivatOverenskomstSegmenter(konsolideret,
      buildOverenskomstSegmentContext(konsolideret))).toThrow('Loenudvikling kan ikke beregnes: mangler sats for segment');
  });

  it('bygger offentlig serie med løntrin, timeløn, Store Bededag og anciennitet', () => {
    const konsolideret = createOverenskomst({
      reguleringsdato: iso('2023-01-01'),
      overenskomstId: 'kl-overenskomst',
      loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
      beregnStoreBededagstillaeg: true,
      offentligLoenEkstraGrundloenAngivesPer: 'Time',
      harAnciennitetstillaegEfterSkadedatoen: true,
      anciennitetstillaegDato: iso('2024-06-01'),
      anciennitetstillaegSatsValue: 25,
      offentligLoenEkstraGrundloen: 100,
      offentlig: { ...offentligSelection, loenType: 'timeLoen' },
      tafRanges: [{ fra: iso('2023-01-01'), til: iso('2025-03-31') }],
    });

    const result = buildOffentligOverenskomstSegmenter(
      konsolideret,
      konsolideret.offentlig as OffentligSelection,
      buildOverenskomstSegmentContext(konsolideret)
    );

    expect(withSegment(result, iso('2023-01-01'))).toBeDefined();
    expect(withSegment(result, STORE_BEDEDAG_START)?.deltaPct).not.toBe(0);
    expect(withSegment(result, iso('2024-06-01'))).toBeDefined();
    expect(result.some((segment) => segment.deltaPct !== 0)).toBe(true);
  });

  it('afviser offentlig reguleringsdato før dækning uanset Store Bededag', () => {
    const konsolideret = createOverenskomst({
      reguleringsdato: iso('2000-01-01'), overenskomstId: 'kl-overenskomst',
      beregnStoreBededagstillaeg: true, offentlig: offentligSelection,
      tafRanges: [{ fra: iso('2000-01-01'), til: iso('2024-12-31') }],
    });
    expect(() => buildOffentligOverenskomstSegmenter(konsolideret, offentligSelection,
      buildOverenskomstSegmentContext(konsolideret))).toThrow('Loenudvikling kan ikke beregnes: basissats mangler');
  });

  it('afviser offentlig serie ved ukendt dækningsinterval', () => {
    const konsolideret = createOverenskomst({
      reguleringsdato: iso('2000-01-01'),
      overenskomstId: 'ukendt-overenskomst',
      offentlig: offentligSelection,
    });
    const gyldigContext = buildOverenskomstSegmentContext(createOverenskomst({
      reguleringsdato: iso('2000-01-01'),
      overenskomstId: 'kl-overenskomst',
      offentlig: offentligSelection,
    }));

    expect(() => buildOffentligOverenskomstSegmenter(
      konsolideret,
      offentligSelection,
      gyldigContext
    )).toThrow('Loenudvikling kan ikke beregnes: basissats mangler');
  });

  it('afviser offentlig serie med ugyldigt TAF-interval', () => {
    const konsolideret = createOverenskomst({
      overenskomstId: 'kl-overenskomst',
      offentlig: offentligSelection,
      tafRanges: [{ fra: invalidIso('ikke-en-dato'), til: iso('2024-12-31') }],
    });

    expect(() => buildOffentligOverenskomstSegmenter(
      konsolideret,
      offentligSelection,
      buildOverenskomstSegmentContext(konsolideret)
    )).toThrow('Loenudvikling kan ikke beregnes: ugyldigt segmentinterval');
  });

  it('afviser TAF før offentlig dækning med en dækket reguleringsdato', () => {
    const konsolideret = createOverenskomst({
      overenskomstId: 'kl-overenskomst', offentlig: offentligSelection,
      tafRanges: [{ fra: iso('2000-01-01'), til: iso('2011-12-31') }],
    });
    expect(() => buildOffentligOverenskomstSegmenter(konsolideret, offentligSelection,
      buildOverenskomstSegmentContext(konsolideret))).toThrow('Loenudvikling kan ikke beregnes: mangler sats for segment');
  });

  it('afviser offentlig serie uden TAF-intervaller', () => {
    const konsolideret = createOverenskomst({
      overenskomstId: 'kl-overenskomst',
      offentlig: offentligSelection,
      tafRanges: [],
    });

    expect(() => buildOffentligOverenskomstSegmenter(
      konsolideret,
      offentligSelection,
      buildOverenskomstSegmentContext(konsolideret)
    )).toThrow('Loenudvikling kan ikke beregnes: ingen overenskomstsegmenter');
  });
});
