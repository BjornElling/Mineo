import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { LoenudviklingPdfModel } from '../../../domain/erstatningsopgoerelse/eoPdfModel';
import { buildErstatningsopgoerelsePdfModel, ensureMoneyOre, resolveLoenudviklingRowsV3 } from '../../../domain/erstatningsopgoerelse/eoPdfModel';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import { calculateTafArbejdsdageBreakdown } from '../../../domain/erstatningsopgoerelse/tafCalculations';
import { beregningsmetodeEnum, loenPaaHelligdageSchema, loenudviklingStatistikModelEnum } from '../../../schemas/formSchemas';

const iso = (value: string) => toISODateString(value);

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(createErstatningsopgoerelseInitialValues());
  const merged = { ...base, ...patch };
  const isAngivet = merged.beregnesUdFra === 'Angivet månedsløn' || merged.beregnesUdFra === 'Angivet dagsløn';
  if (isAngivet && patch.eoAngivetLoenLoenudvikling === undefined) {
    const first = (patch.loenindkomstAnsaettelsesforhold ?? merged.loenindkomstAnsaettelsesforhold)?.[0];
    if (first) {
      merged.eoAngivetLoenLoenudvikling = {
        ...merged.eoAngivetLoenLoenudvikling,
        overenskomstId: first.overenskomstId,
        feriePct: first.feriePct,
        loenPaaHelligdage: first.loenPaaHelligdage,
        saerligFraDatoRegulering: first.saerligFraDatoRegulering,
        loenudviklingBeregningsgrundlag: first.loenudviklingBeregningsgrundlag,
        loenudviklingStatistikModel: first.loenudviklingStatistikModel,
        loenudviklingKRLSatstabel: first.loenudviklingKRLSatstabel,
        loenudviklingManuelNavn: first.loenudviklingManuelNavn,
        loenudviklingManuelTableData: first.loenudviklingManuelTableData,
        offentligLoenType: first.offentligLoenType,
        offentligLoenTrin: first.offentligLoenTrin,
        offentligLoenGruppe: first.offentligLoenGruppe,
      };
    }
  }
  return merged;
};

const makeStamdata = (patch: Partial<StamdataValues>): StamdataValues => {
  const base = structuredClone(STAMDATA_INITIAL_VALUES);
  return { ...base, ...patch };
};

type LoenSegment = LoenudviklingPdfModel['beregnedeSegmenter'][number];
type IsoRange = Readonly<{ fra: string; til: string }>;

const nextDayIso = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const assertSortedAndContinuous = (segments: readonly LoenSegment[]): void => {
  for (let i = 1; i < segments.length; i += 1) {
    expect(segments[i - 1].fra <= segments[i].fra).toBe(true);
    expect(segments[i - 1].til < segments[i].fra).toBe(true);
  }
};

const assertCoveragePerRange = (segments: readonly LoenSegment[], ranges: readonly IsoRange[]): void => {
  assertSortedAndContinuous(segments);
  for (const range of ranges) {
    const covered = segments
      .filter((segment) => segment.fra >= range.fra && segment.til <= range.til);
    expect(covered.length).toBeGreaterThan(0);
    expect(covered[0].fra).toBe(range.fra);
    expect(covered[covered.length - 1].til).toBe(range.til);
    for (let i = 1; i < covered.length; i += 1) {
      expect(covered[i].fra).toBe(nextDayIso(covered[i - 1].til));
    }
  }
};

const assertTotalMatchesSegmentSum = (loenudvikling: LoenudviklingPdfModel | null | undefined): void => {
  expect(loenudvikling?.loenudviklingTotal.status).toBe('ok');
  if (!loenudvikling || loenudvikling.loenudviklingTotal.status !== 'ok') return;
  const segmentSum = loenudvikling.beregnedeSegmenter.reduce((sum, segment) => sum + segment.amountOre, 0);
  expect(loenudvikling.loenudviklingTotal.value).toBe(segmentSum);
};

describe('buildErstatningsopgoerelsePdfModel', () => {
  it('uses all employments for lønudvikling in Beregningsperiode', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      loenindkomstAnsaettelsesforhold: [
        { ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0], id: 'a1' },
        { ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0], id: 'a2' },
      ],
    });
    const rows = resolveLoenudviklingRowsV3(values);
    expect(rows.map((r) => r.id)).toEqual(['a1', 'a2']);
  });

  it('uses only primary employment for lønudvikling in Angivet månedsløn', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      loenindkomstAnsaettelsesforhold: [
        { ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0], id: 'a1' },
        { ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0], id: 'a2' },
      ],
    });
    const rows = resolveLoenudviklingRowsV3(values);
    expect(rows.map((r) => r.id)).toEqual(['eo-angivet-loen']);
  });

  it('returns empty lønudvikling source when no employments exist', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      loenindkomstAnsaettelsesforhold: [],
    });
    const rows = resolveLoenudviklingRowsV3(values);
    expect(rows.map((r) => r.id)).toEqual(['eo-angivet-loen']);
  });

  it('enforcer MoneyOre invariants', () => {
    expect(ensureMoneyOre(0)).toBe(0);
    expect(() => ensureMoneyOre(Number.NaN)).toThrow('MoneyOre skal være et heltal');
    expect(() => ensureMoneyOre(12.5)).toThrow('MoneyOre skal være et heltal');
  });

  it('bygger model med tomme sektioner uden at fejle', () => {
    const eoValues = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.samlet.totalOre).toBe(0);
    expect(model.oevrigeKrav.entries.length).toBe(0);
    expect(model.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre).toBe(0);
  });

  it('treats missing TAF-period income as 0 kr. for angivet månedsløn', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(48705.13),
      beregnesTabtArbejdsfortjeneste: 'Ja',
      tafPerioder: [
        { id: 'taf-1', fra: iso('2021-06-01'), til: iso('2021-08-15'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2021-06-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-10') });
    expect(model.tabtArbejdsfortjeneste.tafIndtaegter?.total.status).toBe('ok');
    if (model.tabtArbejdsfortjeneste.tafIndtaegter?.total.status === 'ok') {
      expect(model.tabtArbejdsfortjeneste.tafIndtaegter.total.value).toBe(0);
    }
  });

  it('beregner svie/smerte total i øre', () => {
    const eoValues = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-10'),
      tidligereSsMax: 'Nej',
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld',
      svieSmerteTidligereTotal: asAmountValue(0),
      svieSmerteAktuelPeriode: asAmountValue(0),
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    // 10 dage * 250 kr = 2.500 kr = 250.000 øre
    expect(model.svieSmerte.totalOre).toBe(250000);
    expect(model.svieSmerte.satserPerDag.status).toBe('ok');
  });

  it('markerer svie/smerte-satser som ikke beregnelige uden perioder', () => {
    const eoValues = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      tidligereSsMax: 'Nej',
      svieSmertePerioder: [],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.svieSmerte.satserPerDag.status).toBe('not_calculable');
  });

  it('summerer øvrige krav i øre', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: asAmountValue(1234.5) },
        { id: '2', dato: iso('2024-03-01'), udgiftTil: 'Test 2', beloeb: asAmountValue(10) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.oevrigeKrav.totalOre).toBe(124450);
    expect(model.samlet.oevrigeKravOre).toBe(124450);
  });

  it('afviser øvrige krav med manglende beløb', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: undefined },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Øvrige krav er ikke fuldt udfyldt');
  });

  it('afviser øvrige krav med manglende dato', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: undefined, udgiftTil: 'Test', beloeb: asAmountValue(100) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Øvrige krav er ikke fuldt udfyldt');
  });

  it('afviser øvrige krav med negativt beløb', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: asAmountValue(-1) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Ugyldigt input til PDF: Skal være større end 0');
  });

  it('afviser beløb med flere end 2 decimaler', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: asAmountValue(1.005) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Beløb har flere end 2 decimaler');
  });

  it('afviser delvist udfyldt svie/smerte-periode', () => {
    const eoValues = makeValues({
      tidligereSsMax: 'Nej',
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: undefined, tilstand: 'sygemeldt' },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Svie/smerte-periode er ikke fuldt udfyldt');
  });

  it('afviser TAF-periode med kun fra', () => {
    const eoValues = makeValues({
      tafPerioder: [
        { id: '1', fra: iso('2024-01-01'), til: undefined, loseFeriedage: undefined },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('TAF-periode mangler fra/til');
  });

  it('afviser overlappende svie/smerte-perioder', () => {
    const eoValues = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-02-01'),
      tidligereSsMax: 'Nej',
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' },
        { id: '2', fra: iso('2024-01-05'), til: iso('2024-01-20'), tilstand: 'sygemeldt' },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Svie/smerte-perioder overlapper');
  });

  it('afrunder TAF-indtægter før øre-konvertering', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(1000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-01'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '03-01-2024',
          ydelse: asAmountValue(100),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: 'ASL-årslønsmaksimum',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const entries = model.tabtArbejdsfortjeneste.tafIndtaegter?.entries ?? [];

    expect(entries.length).toBe(1);
    expect(entries[0].amountOre).toBe(3333);
  });

  it('beregner loenudvikling uden regulering, naar alle ansaettelsesforhold er sat til Ingen', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmountValue(1000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-02'), til: iso('2024-01-02'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '02-01-2024',
          tilDato: '02-01-2024',
          ydelse: asAmountValue(100),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;

    expect(loenudvikling).not.toBeNull();
    expect(loenudvikling?.loenudviklingLabel).toBe('Ingen');
    expect(loenudvikling?.loenudviklingTotal.status).toBe('ok');
    expect(loenudvikling?.loenudviklingTotal.status === 'ok' ? loenudvikling.loenudviklingTotal.value : null).toBe(100000);
    expect(loenudvikling?.beregnedeSegmenter).toHaveLength(1);
    expect(loenudvikling?.beregnedeSegmenter[0]?.deltaPct).toBe(0);
  });

  it('afviser TAF naar loenudviklingsstrategi ikke er valgt', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(25000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: undefined,
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Loenudviklingsstrategi er ikke valgt');
  });

  it('afviser valgt manuel strategi med manglende reguleringsraekker', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(25000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          feriePct: 12.5,
          loenudviklingManuelNavn: 'Manuel test',
          loenudviklingManuelTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Loenudvikling kan ikke beregnes: manuelle reguleringsraekker mangler');
  });

  it('afviser manuel strategi med manglende feriepct', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(25000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          feriePct: undefined,
          loenudviklingManuelNavn: 'Manuel test',
          loenudviklingManuelTableData: [
            { id: 'm1', dato: '', grundloen: asAmountValue(100), feriepenge: '12,5', shSoSats: '5', fritvalg: '2', agPension: '8' },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Loenudvikling kan ikke beregnes: feriepct mangler');
  });

  it('afviser overenskomststrategi med manglende feriepct', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(25000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'bygge-anlaeg',
          feriePct: undefined,
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Loenudvikling kan ikke beregnes: feriepct mangler');
  });

  it('beregner statistik-loenudvikling med konsistente segmenter', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(35000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2025-12-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: loenudviklingStatistikModelEnum.enum['ASL-årslønsmaksimum'],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;

    expect(loenudvikling?.beregningsenhed).toBe(TAF_BEREGNES_SOM.MAANEDER);
    expect((loenudvikling?.beregnedeSegmenter.length ?? 0) > 0).toBe(true);
    assertSortedAndContinuous(loenudvikling?.beregnedeSegmenter ?? []);
    assertCoveragePerRange(loenudvikling?.beregnedeSegmenter ?? [], [{ fra: '2024-01-01', til: '2025-12-31' }]);
    assertTotalMatchesSegmentSum(loenudvikling);
  });

  it('beregner overenskomst-regulering over flere skift', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-02-01'), til: iso('2025-06-01'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-02-2024',
          tilDato: '01-02-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'bygge-anlaeg',
          feriePct: 12.5,
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;

    expect(loenudvikling?.loenudviklingTotal.status).toBe('ok');
    expect((loenudvikling?.beregnedeSegmenter.length ?? 0) > 1).toBe(true);
    assertSortedAndContinuous(loenudvikling?.beregnedeSegmenter ?? []);
    assertCoveragePerRange(loenudvikling?.beregnedeSegmenter ?? [], [{ fra: '2024-02-01', til: '2025-06-01' }]);
    assertTotalMatchesSegmentSum(loenudvikling);
  });

  it('beregner manuel regulering med flere TAF-perioder', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(28000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-03-31'), loseFeriedage: undefined },
        { id: 'taf-2', fra: iso('2024-05-01'), til: iso('2024-12-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          feriePct: 12.5,
          loenudviklingManuelNavn: 'Manuel test',
          loenudviklingManuelTableData: [
            { id: 'm1', dato: '', grundloen: asAmountValue(100), feriepenge: '12,5', shSoSats: '5', fritvalg: '2', agPension: '8' },
            { id: 'm2', dato: '01-07-2024', grundloen: asAmountValue(110), feriepenge: '12,5', shSoSats: '5', fritvalg: '2', agPension: '8' },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;

    expect(loenudvikling?.loenudviklingTotal.status).toBe('ok');
    expect(loenudvikling?.beregnedeSegmenter.length).toBeGreaterThanOrEqual(2);
    assertSortedAndContinuous(loenudvikling?.beregnedeSegmenter ?? []);
    assertCoveragePerRange(loenudvikling?.beregnedeSegmenter ?? [], [
      { fra: '2024-01-01', til: '2024-03-31' },
      { fra: '2024-05-01', til: '2024-12-31' },
    ]);
    assertTotalMatchesSegmentSum(loenudvikling);
  });

  it('segmenterer manuel regulering korrekt ved startdato lig range.til', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(28000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          feriePct: 12.5,
          loenudviklingManuelNavn: 'Manuel test',
          loenudviklingManuelTableData: [
            { id: 'm1', dato: '', grundloen: asAmountValue(100), feriepenge: '12,5', shSoSats: '5', fritvalg: '2', agPension: '8' },
            { id: 'm2', dato: '31-01-2024', grundloen: asAmountValue(110), feriepenge: '12,5', shSoSats: '5', fritvalg: '2', agPension: '8' },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    expect(segments.length).toBe(2);
    expect(segments[0].fra).toBe('2024-01-01');
    expect(segments[0].til).toBe('2024-01-30');
    expect(segments[1].fra).toBe('2024-01-31');
    expect(segments[1].til).toBe('2024-01-31');
  });

  it('segmenterer manuel regulering korrekt ved startdato lig range.fra + 1 dag', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(28000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          feriePct: 12.5,
          loenudviklingManuelNavn: 'Manuel test',
          loenudviklingManuelTableData: [
            { id: 'm1', dato: '', grundloen: asAmountValue(100), feriepenge: '12,5', shSoSats: '5', fritvalg: '2', agPension: '8' },
            { id: 'm2', dato: '02-01-2024', grundloen: asAmountValue(110), feriepenge: '12,5', shSoSats: '5', fritvalg: '2', agPension: '8' },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    expect(segments.length).toBe(2);
    expect(segments[0].fra).toBe('2024-01-01');
    expect(segments[0].til).toBe('2024-01-01');
    expect(segments[1].fra).toBe('2024-01-02');
    expect(segments[1].til).toBe('2024-01-31');
  });

  it('ignorerer manuel startdato lig range.fra uden dubletsegment', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(28000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          feriePct: 12.5,
          loenudviklingManuelNavn: 'Manuel test',
          loenudviklingManuelTableData: [
            { id: 'm1', dato: '', grundloen: asAmountValue(100), feriepenge: '12,5', shSoSats: '5', fritvalg: '2', agPension: '8' },
            { id: 'm2', dato: '01-01-2024', grundloen: asAmountValue(110), feriepenge: '12,5', shSoSats: '5', fritvalg: '2', agPension: '8' },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });
    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    expect(segments.length).toBe(1);
    expect(segments[0].fra).toBe('2024-01-01');
    expect(segments[0].til).toBe('2024-01-31');
  });

  it('fejler hurtigt ved inkonsistente ansaettelser i loenudvikling for beregningsperiode', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum.Beregningsperiode,
      periodeTilBeregningFra: iso('2023-01-01'),
      periodeTilBeregningTil: iso('2023-12-31'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          id: 'a1',
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: loenudviklingStatistikModelEnum.enum['ASL-årslønsmaksimum'],
        },
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          id: 'a2',
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    expect(() => buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Inkonsistente loenudviklingsindstillinger');
  });

  it('viser statuslinje for Efterløn', () => {
    const eoValues = makeValues({
      vedroererPeriodeTil: iso('2024-01-31'),
      tafArbejdsstatus: 'Efterløn',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.statusLinjer).toContain('Den 1. februar 2024 var skadelidte på efterløn.');
  });

  it('tilføjer delvist-uarbejdsdygtig suffix for fleksjob', () => {
    const eoValues = makeValues({
      vedroererPeriodeTil: iso('2024-01-31'),
      tafArbejdsstatus: 'Fleksjob',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.statusLinjer).toContain(
      'Den 1. februar 2024 var skadelidte bevilget fleksjob og således fortsat delvist uarbejdsdygtig.'
    );
  });

  it('tilføjer uarbejdsdygtig suffix for førtidspension', () => {
    const eoValues = makeValues({
      vedroererPeriodeTil: iso('2024-01-31'),
      tafArbejdsstatus: 'Førtidspension',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.statusLinjer).toContain(
      'Den 1. februar 2024 var skadelidte på førtidspension og således fortsat uarbejdsdygtig.'
    );
  });

  it('viser måneder-mellemregning med 0 fraværsdage i nyt format', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      periodeTilBeregningFra: iso('2021-03-01'),
      periodeTilBeregningTil: iso('2022-02-28'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
          fuldLoenUnderFerie: 'Ja',
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
          indtaegtsoplysningerTableData: [
            {
              id: 'r1',
              col0_maaned: '3',
              col1_maaned: '2021',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: asAmountValue(10000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;

    expect(indkomst?.beregningsgrundlagMellemregningLabel).toBe('I perioden var der 12 måneder (- 0 fraværsdage uden løn) =');
    expect(indkomst?.beregningsgrundlagMellemregningResultat).toBe('12 måneder');
  });

  it('bruger ental i måneder-mellemregning ved 1 fraværsdag', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      periodeTilBeregningFra: iso('2021-03-01'),
      periodeTilBeregningTil: iso('2022-02-28'),
      oevrigtFravaerUdenLoen: 'Ja',
      oevrigeFravaersdage: 1,
      oevrigeFravaersdageBeskrivelse: 'orlov',
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '01-01-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
          fuldLoenUnderFerie: 'Ja',
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
          indtaegtsoplysningerTableData: [
            {
              id: 'r1',
              col0_maaned: '3',
              col1_maaned: '2021',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: asAmountValue(10000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;

    expect(indkomst?.beregningsgrundlagMellemregningLabel).toContain('1 fraværsdag pga. orlov uden løn x 4,8 % måned');
  });

  it('viser arbejdsdage-mellemregning med feriedage inkl. løse feriedage', () => {
    const periodeFra = iso('2024-01-01');
    const periodeTil = iso('2024-01-10');
    const ferieFra = iso('2024-01-04');
    const ferieTil = iso('2024-01-05');
    const loseFeriedage = 2;

    const eoValues = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      periodeTilBeregningFra: periodeFra,
      periodeTilBeregningTil: periodeTil,
      uspecificeredeFerieFridage: loseFeriedage,
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-02-10'), loseFeriedage: undefined },
      ],
      fravaerPerioder: [
        { id: 'f1', fra: ferieFra, til: ferieTil },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-02-2024',
          tilDato: '01-02-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          loenudviklingBeregningsgrundlag: 'Ingen',
          fuldLoenUnderFerie: 'Nej',
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
          loenperiode: 'dag',
          indtaegtsoplysningerTableData: [
            {
              id: 'r1',
              col0_maaned: '',
              col1_maaned: '',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '01-01-2024',
              col1_dag: '10-01-2024',
              col2: asAmountValue(10000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadesdato: iso('2024-01-01') });

    const model = buildErstatningsopgoerelsePdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;
    const breakdown = calculateTafArbejdsdageBreakdown(
      periodeFra,
      periodeTil,
      [{ id: 'f1', fra: ferieFra, til: ferieTil }],
      loseFeriedage,
      { kind: 'beregningsgrundlag', oevrigeFravaersdage: 0 }
    );
    const samledeFeriedage = (breakdown?.feriedage ?? 0) + (breakdown?.loseFeriedage ?? 0);

    expect(indkomst?.beregningsgrundlagMellemregningLabel).toContain(` - ${samledeFeriedage.toLocaleString('da-DK')} feriedage - `);
    expect(indkomst?.beregningsgrundlagMellemregningLabel).not.toContain('løse feriedage');
  });
});




