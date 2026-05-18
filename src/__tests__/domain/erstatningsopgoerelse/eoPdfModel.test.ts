import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { LoenudviklingModel } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import { ensureMoneyOre, resolveLoenudviklingRows } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModelTypes';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import * as statistikRatesData from '../../../data/statistiskeRates';
import * as krlRatesData from '../../../data/krlRates';
import * as overenskomstRatesData from '../../../data/overenskomstRates';
import * as offentligLoenLookupData from '../../../data/offentligLoenLookup';
import type { OffentligLoenResultat } from '../../../data/offentligLoenTypes';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import { calculateTafArbejdsdageBreakdown } from '../../../domain/erstatningsopgoerelse/engines/tafCalculations';
import { beregningsmetodeEnum, loenPaaHelligdageSchema, loenudviklingStatistikModelEnum } from '../../../schemas/formSchemas';
import { roundByMethod } from '../../../utils/rounding';

const iso = (value: string) => toISODateString(value);

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

// Baseline for test-ansættelsesforhold: kanonisk factory med bevidst testspecifikke overrides.
// Værdier som feriePct: 0, harOverenskomst: false m.fl. er testvalg, ikke system-defaults.
const makeTestAnsaettelsesforholdBase = (): ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number] => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  navnPaaArbejdssted: 'Arbejdssted',
  harOverenskomst: false,
  feriePct: 0,
  fritvalgPct: 0,
  shSoPct: 0,
  storeBededagPct: 0,
  pensionPct: 0,
  loenudviklingBeregningsgrundlag: 'Ingen',
});

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(createErstatningsopgoerelseInitialValues());
  if (base.loenindkomstAnsaettelsesforhold.length === 0) {
    base.loenindkomstAnsaettelsesforhold = [makeTestAnsaettelsesforholdBase()];
  }
  // Sæt minimums-gyldige defaults så computeEoSnapshot passerer validering i tests der ikke tester TAF-specifik logik.
  // De tilsvarende tests der tester specifikke valideringsfejl overstyrer disse defaults.
  if (base.beregnesUdFra === 'Beregningsperiode' && !base.tafBeregningsperiodeFra) {
    base.tafBeregningsperiodeFra = iso('2024-01-01');
    base.tafBeregningsperiodeTil = iso('2024-12-31');
  }
  const merged = { ...base, ...patch };
  merged.loenindkomstAnsaettelsesforhold = (merged.loenindkomstAnsaettelsesforhold ?? []).map((af, index) => ({
    ...makeTestAnsaettelsesforholdBase(),
    ...af,
    id: af.id ?? `af-${index + 1}`,
    overenskomstFilter: af.overenskomstFilter ?? {
      loenmodtager: undefined,
      arbejdsgiver: undefined,
    },
  }));
  if ((merged.sfggAnsaettelsesforhold ?? []).length === 0 && merged.loenindkomstAnsaettelsesforhold.length > 0) {
    merged.sfggAnsaettelsesforhold = merged.loenindkomstAnsaettelsesforhold.map((af) => ({
      ansaettelsesforholdId: af.id,
      sfggBeregningskilde: 'Ingen' as const,
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej' as const,
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }));
  }
  const preferNonEmpty = <T>(current: T, fallback: T): T => {
    if (Array.isArray(current) && current.length === 0) return fallback;
    if (typeof current === 'string' && current.trim() === '') return fallback;
    return current ?? fallback;
  };
  const isAngivet = merged.beregnesUdFra === 'Angivet månedsløn' || merged.beregnesUdFra === 'Angivet dagsløn';
  if (isAngivet) {
    const first = merged.loenindkomstAnsaettelsesforhold?.[0];
    if (first) {
      merged.eoAngivetLoenLoenudvikling = {
        ...merged.eoAngivetLoenLoenudvikling,
        overenskomstId: merged.eoAngivetLoenLoenudvikling.overenskomstId ?? first.overenskomstId,
        feriePct: merged.eoAngivetLoenLoenudvikling.feriePct ?? first.feriePct,
        loenPaaHelligdage: merged.eoAngivetLoenLoenudvikling.loenPaaHelligdage ?? first.loenPaaHelligdage,
        saerligFraDatoRegulering: merged.eoAngivetLoenLoenudvikling.saerligFraDatoRegulering ?? first.saerligFraDatoRegulering,
        loenudviklingBeregningsgrundlag:
          merged.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag ?? first.loenudviklingBeregningsgrundlag,
        loenudviklingStatistikModel:
          merged.eoAngivetLoenLoenudvikling.loenudviklingStatistikModel ?? first.loenudviklingStatistikModel,
        loenudviklingKRLSatstabel:
          merged.eoAngivetLoenLoenudvikling.loenudviklingKRLSatstabel ?? first.loenudviklingKRLSatstabel,
        loenudviklingManuelNavn: preferNonEmpty(
          merged.eoAngivetLoenLoenudvikling.loenudviklingManuelNavn,
          first.loenudviklingManuelNavn
        ),
        loenudviklingManuelTableData: preferNonEmpty(
          merged.eoAngivetLoenLoenudvikling.loenudviklingManuelTableData,
          first.loenudviklingManuelTableData
        ),
        offentligLoenType: merged.eoAngivetLoenLoenudvikling.offentligLoenType ?? first.offentligLoenType,
        offentligLoenTrin: merged.eoAngivetLoenLoenudvikling.offentligLoenTrin ?? first.offentligLoenTrin,
        offentligLoenGruppe: merged.eoAngivetLoenLoenudvikling.offentligLoenGruppe ?? first.offentligLoenGruppe,
      };
    }
  }
  return merged;
};

const makeStamdata = (patch: Partial<StamdataValues>): StamdataValues => {
  const base = structuredClone(STAMDATA_INITIAL_VALUES);
  return { ...base, ...patch };
};

const buildPdfModel = (
  stamdata: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  options: Readonly<{ dagsDatoISO: ReturnType<typeof iso> }>
): EoModel => {
  const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues, dagsDatoISO: options.dagsDatoISO });
  if (!snapshot.data) {
    const firstInvariant = snapshot.invariants[0];
    const message = snapshot.failClosedReason === 'runtime_exception'
      ? firstInvariant?.evidence[0] ?? firstInvariant?.message ?? 'Snapshot fejlede uden invariant-besked'
      : firstInvariant?.message ?? 'Snapshot fejlede uden invariant-besked';
    throw new Error(message);
  }
  return snapshot.data.pdfModel;
};

type LoenSegment = LoenudviklingModel['beregnedeSegmenter'][number];
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

const assertTotalMatchesSegmentSum = (loenudvikling: LoenudviklingModel | null | undefined): void => {
  expect(loenudvikling?.loenudviklingTotal.status).toBe('ok');
  if (!loenudvikling || loenudvikling.loenudviklingTotal.status !== 'ok') return;
  const segmentSum = loenudvikling.beregnedeSegmenter.reduce((sum, segment) => sum + segment.amountOre, 0);
  expect(loenudvikling.loenudviklingTotal.value).toBe(segmentSum);
};

const expectSilencedConsoleErrorThrow = (run: () => void, message: string): void => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(run).toThrow(message);
  } finally {
    errorSpy.mockRestore();
  }
};

describe('eoPdfModel', () => {
  it('uses all employments for lønudvikling in Beregningsperiode', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      loenindkomstAnsaettelsesforhold: [
        { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'a1' },
        { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'a2' },
      ],
    });
    const rows = resolveLoenudviklingRows(values);
    expect(rows.map((r) => r.id)).toEqual(['a1', 'a2']);
  });

  it('uses only primary employment for lønudvikling in Angivet månedsløn', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      loenindkomstAnsaettelsesforhold: [
        { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'a1' },
        { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'a2' },
      ],
    });
    const rows = resolveLoenudviklingRows(values);
    expect(rows.map((r) => r.id)).toEqual(['eo-angivet-loen']);
  });

  it('returns empty lønudvikling source when no employments exist', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      loenindkomstAnsaettelsesforhold: [],
    });
    const rows = resolveLoenudviklingRows(values);
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.samlet.totalOre).toBe(0);
    expect(model.oevrigeKrav.entries.length).toBe(0);
    expect(model.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre).toBe(0);
  });

  it('nulstiller tabt arbejdsfortjeneste i PDF-model når beregnesTabtArbejdsfortjeneste er Nej trods stale TAF-data', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      beregnesTabtArbejdsfortjeneste: 'Nej',
      maanedsloenenUdgoer: asAmountValue(39099),
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
      tafArbejdsstatus: 'Førtidspension',
      differencekravDato: iso('2024-02-01'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '31-01-2024',
          ydelse: asAmountValue(1000),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-10') });

    expect(model.tabtArbejdsfortjeneste.beregnes).toBe(false);
    expect(model.tabtArbejdsfortjeneste.harTafPerioder).toBe(false);
    expect(model.tabtArbejdsfortjeneste.statusLinjer).toEqual([]);
    expect(model.tabtArbejdsfortjeneste.tafPerioderLinjer).toEqual([]);
    expect(model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt).toBeNull();
    expect(model.tabtArbejdsfortjeneste.loenudvikling).toBeNull();
    expect(model.tabtArbejdsfortjeneste.tafIndtaegter).toBeNull();
    expect(model.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre).toBe(0);
    expect(model.samlet.tabtArbejdsfortjenesteOre).toBe(0);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2021-06-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-10') });
    expect(model.tabtArbejdsfortjeneste.tafIndtaegter?.total.status).toBe('ok');
    if (model.tabtArbejdsfortjeneste.tafIndtaegter?.total.status === 'ok') {
      expect(model.tabtArbejdsfortjeneste.tafIndtaegter.total.value).toBe(0);
    }
  });

  it('fratrækker tidligere modtaget tabt arbejdsfortjeneste fra beregnet krav', () => {
    const baseValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(48705.13),
      beregnesTabtArbejdsfortjeneste: 'Ja',
      tafPerioder: [
        { id: 'taf-1', fra: iso('2021-06-01'), til: iso('2021-08-15'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2021-06-01') });
    const withoutPaidModel = buildPdfModel(stamdata, baseValues, { dagsDatoISO: iso('2026-02-10') });

    const paidValues = makeValues({
      ...baseValues,
      tidligereModtagetTaf: asAmountValue(1234.56),
    });
    const withPaidModel = buildPdfModel(stamdata, paidValues, { dagsDatoISO: iso('2026-02-10') });

    expect(withPaidModel.tabtArbejdsfortjeneste.tidligereModtagetTaf.status).toBe('ok');
    if (withPaidModel.tabtArbejdsfortjeneste.tidligereModtagetTaf.status === 'ok') {
      expect(withPaidModel.tabtArbejdsfortjeneste.tidligereModtagetTaf.value).toBe(123456);
    }
    expect(withPaidModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre).toBe(
      Math.max(0, withoutPaidModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre - 123456)
    );
  });

  it('lader ikke tabt arbejdsfortjeneste blive negativ efter fradrag for tidligere modtaget beløb', () => {
    const baseValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(48705.13),
      beregnesTabtArbejdsfortjeneste: 'Ja',
      tafPerioder: [
        { id: 'taf-1', fra: iso('2021-06-01'), til: iso('2021-08-15'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
      tidligereModtagetTaf: asAmountValue(999999999),
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2021-06-01') });

    const model = buildPdfModel(stamdata, baseValues, { dagsDatoISO: iso('2026-02-10') });
    expect(model.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre).toBe(0);
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.svieSmerte.satserPerDag.status).toBe('not_calculable');
  });

  it('markerer svie/smerte som fravalgt i PDF-model når tidligereSsMax er Ja trods stale periodefelter', () => {
    const eoValues = makeValues({
      beregnesSvieSmerteGodtgoerelse: 'Ja',
      tidligereSsMax: 'Ja',
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
      svieSmerteHelbredsstatus: 'Sygemeldt',
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld',
      svieSmerteTidligereTotal: asAmountValue(1000),
      svieSmerteAktuelPeriode: asAmountValue(500),
      svieSmertePerioder: [
        { id: 'ss-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), tilstand: 'sygemeldt' },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.svieSmerte.beregnes).toBe(false);
    expect(model.svieSmerte.harPerioder).toBe(false);
    expect(model.svieSmerte.totalOre).toBe(0);
  });

  it('summerer øvrige krav i øre', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: asAmountValue(1234.5) },
        { id: '2', dato: iso('2024-03-01'), udgiftTil: 'Test 2', beloeb: asAmountValue(10) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.oevrigeKrav.totalOre).toBe(124450);
    expect(model.samlet.oevrigeKravOre).toBe(124450);
  });

  it('anvender forligsgrad på tabt arbejdsfortjeneste i PDF-model', () => {
    const baseValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(48705.13),
      beregnesTabtArbejdsfortjeneste: 'Ja',
      tafPerioder: [
        { id: 'taf-1', fra: iso('2021-06-01'), til: iso('2021-08-15'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const withForlig = makeValues({
      ...baseValues,
      forligAnsvarsgradProcent: 50,
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2021-06-01') });

    const baseModel = buildPdfModel(stamdata, baseValues, { dagsDatoISO: iso('2026-02-10') });
    const forligModel = buildPdfModel(stamdata, withForlig, { dagsDatoISO: iso('2026-02-10') });

    expect(forligModel.forlig.erIndgaaet).toBe(true);
    expect(forligModel.forlig.label).toBe('50%');
    expect(forligModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteFoerForligOre).toBe(
      baseModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre
    );
    expect(forligModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre).toBe(
      roundByMethod(baseModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre * 0.5, 0, 'halfAwayFromZero')
    );
  });

  it('fratrækker tidligere modtaget TAF efter forligsgraden i PDF-model', () => {
    const baseValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(48705.13),
      beregnesTabtArbejdsfortjeneste: 'Ja',
      tafPerioder: [
        { id: 'taf-1', fra: iso('2021-06-01'), til: iso('2021-08-15'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const withPaidAndForlig = makeValues({
      ...baseValues,
      tidligereModtagetTaf: asAmountValue(1234.56),
      forligAnsvarsgradProcent: 50,
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2021-06-01') });

    const baseModel = buildPdfModel(stamdata, baseValues, { dagsDatoISO: iso('2026-02-10') });
    const paidAndForligModel = buildPdfModel(stamdata, withPaidAndForlig, { dagsDatoISO: iso('2026-02-10') });

    expect(paidAndForligModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteFoerForligOre).toBe(
      baseModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre
    );
    expect(paidAndForligModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre).toBe(
      Math.max(
        0,
        roundByMethod(baseModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre * 0.5, 0, 'halfAwayFromZero') - 123456
      )
    );
  });

  it('anvender decimal-brøk for forlig i PDF-model', () => {
    const baseValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(48705.13),
      beregnesTabtArbejdsfortjeneste: 'Ja',
      tafPerioder: [
        { id: 'taf-1', fra: iso('2021-06-01'), til: iso('2021-08-15'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const withForlig = makeValues({
      ...baseValues,
      forligAnsvarsgradBroek: '1,25/3,5',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2021-06-01') });

    const baseModel = buildPdfModel(stamdata, baseValues, { dagsDatoISO: iso('2026-02-10') });
    const forligModel = buildPdfModel(stamdata, withForlig, { dagsDatoISO: iso('2026-02-10') });

    expect(forligModel.forlig.erIndgaaet).toBe(true);
    expect(forligModel.forlig.label).toBe('1,25/3,5');
    expect(forligModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre).toBe(
      roundByMethod(baseModel.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre * (1.25 / 3.5), 0, 'halfAwayFromZero')
    );
  });

  it('anvender forligsgrad på øvrige krav i PDF-model', () => {
    const baseValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: asAmountValue(1234.5) },
        { id: '2', dato: iso('2024-03-01'), udgiftTil: 'Test 2', beloeb: asAmountValue(10) },
      ],
    });
    const withForlig = makeValues({
      ...baseValues,
      forligAnsvarsgradBroek: '2/3',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, withForlig, { dagsDatoISO: iso('2026-02-04') });

    expect(model.forlig.erIndgaaet).toBe(true);
    expect(model.forlig.label).toBe('2/3');
    expect(model.oevrigeKrav.totalFoerForligOre).toBe(124450);
    expect(model.oevrigeKrav.totalOre).toBe(roundByMethod(124450 * (2 / 3), 0, 'halfAwayFromZero'));
    expect(model.samlet.oevrigeKravOre).toBe(model.oevrigeKrav.totalOre);
  });

  it('afviser øvrige krav med manglende beløb', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: undefined },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    // Validatoren fanger manglende beløb før builder-laget
    expect(() => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Beløb mangler');
  });

  it('afviser øvrige krav med manglende dato', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: undefined, udgiftTil: 'Test', beloeb: asAmountValue(100) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    // Validatoren fanger manglende dato før builder-laget
    expect(() => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Dato mangler');
  });

  it('afviser øvrige krav med negativt beløb', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: asAmountValue(-1) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    // Validatoren fanger negativt beløb før builder-laget
    expect(() => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Skal være større end 0');
  });

  it('normaliserer beløb med flere end 2 decimaler via schema før øre-konvertering', () => {
    const eoValues = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-02-01'), udgiftTil: 'Test', beloeb: asAmountValue(1.005) },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    expect(model.oevrigeKrav.totalOre).toBe(101);
  });

  it('rapporterer valideringsfejl ved delvist udfyldt svie/smerte-periode', () => {
    // Validatoren fanger ufuldstændige perioder; snapshot.data er null.
    const eoValues = makeValues({
      tidligereSsMax: 'Nej',
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: undefined, tilstand: 'sygemeldt' },
      ],
      svieSmerteSatserAar: 2026,
      svieSmerteDelvisSygemeldingSats: 'fuld',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues, dagsDatoISO: iso('2026-02-04') });
    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants.some((inv) => inv.message.includes('Til-dato mangler'))).toBe(true);
  });

  it('afviser TAF-periode med kun fra', () => {
    const eoValues = makeValues({
      tafPerioder: [
        { id: '1', fra: iso('2024-01-01'), til: undefined, loseFeriedage: undefined },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    // Validatoren fanger ufuldstændig TAF-periode (manglende til-dato) før builder-laget
    expect(() => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Til-dato mangler');
  });

  it('rapporterer valideringsfejl ved overlappende svie/smerte-perioder', () => {
    // Validatoren fanger overlappende perioder; snapshot.data er null.
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const snapshot = computeEoSnapshot({ revision: 'test', stamdataValues: stamdata, eoValues, dagsDatoISO: iso('2026-02-04') });
    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants.some((inv) => inv.message.includes('overlapper'))).toBe(true);
  });

  it('afrunder TAF-indtægter før øre-konvertering', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(1000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-02'), til: iso('2024-01-02'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '02-01-2024',
          tilDato: '04-01-2024',
          ydelse: asAmountValue(100),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: 'ASL-årslønsmaksimum',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const entries = model.tabtArbejdsfortjeneste.tafIndtaegter?.entries ?? [];

    expect(entries.length).toBe(1);
    expect(entries[0].amountOre).toBe(3333);
  });

  it('sorterer offentlige ydelser alfabetisk efter ansættelsesforhold i TAF-indtægter', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-10'), til: iso('2024-01-10'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          navnPaaArbejdssted: 'Ansættelse A',
          loenperiode: 'dag',
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [
            {
              id: 'r1',
              col0_maaned: '',
              col1_maaned: '',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '10-01-2024',
              col1_dag: '10-01-2024',
              col2: asAmountValue(1000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '10-01-2024',
          tilDato: '10-01-2024',
          ydelse: asAmountValue(10),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
        {
          id: 'ydelse-2',
          fraDato: '10-01-2024',
          tilDato: '10-01-2024',
          ydelse: asAmountValue(20),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Midlertidigt EET',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const entries = model.tabtArbejdsfortjeneste.tafIndtaegter?.entries ?? [];

    expect(entries).toEqual([
      { label: 'Ansættelse A', amountOre: 100450 },
      { label: 'Midlertidigt EET', amountOre: 2000 },
      { label: 'Sygedagpenge', amountOre: 1000 },
    ]);
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: undefined,
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    // Validatoren fanger manglende lønudviklingsstrategi med dansk besked
    expect(() => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Lønregulering skal vælges');
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          feriePct: 12.5,
          loenudviklingManuelNavn: 'Manuel test',
          loenudviklingManuelTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    // Validatoren fanger manglende manuel reguleringstabel med dansk besked
    expect(() => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Mindst én manuel reguleringsrække');
  });

  it('tillader manuel strategi med manglende feriepct (default 0)', () => {
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          feriePct: undefined,
          loenudviklingManuelNavn: 'Manuel test',
          loenudviklingManuelTableData: [
            { id: 'm1', dato: '', grundloen: asAmountValue(100), feriepenge: '12,5', shSoSats: '5', fritvalg: '2', agPension: '8' },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;
    expect(loenudvikling?.loenudviklingTotal.status).toBe('ok');
  });

  it('tillader overenskomststrategi med manglende feriepct (default 0)', () => {
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'bygge-anlaeg',
          feriePct: undefined,
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;
    expect(loenudvikling?.loenudviklingTotal.status).toBe('ok');
  });

  it('afviser feriepct ved beregningsperiode når der er indtastede lønoplysninger', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum.Beregningsperiode,
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-12-31'),
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'a1',
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'bygge-anlaeg',
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
          feriePct: undefined,
          indtaegtsoplysningerTableData: [
            {
              id: 'row-1',
              col0_maaned: '',
              col1_maaned: '',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: asAmountValue(1000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    expect(() => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') }))
      .toThrow('Feriegodtgørelse/-tillæg skal udfyldes');
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: loenudviklingStatistikModelEnum.enum['ASL-årslønsmaksimum'],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'bygge-anlaeg',
          feriePct: 12.5,
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;

    expect(loenudvikling?.loenudviklingTotal.status).toBe('ok');
    expect((loenudvikling?.beregnedeSegmenter.length ?? 0) > 1).toBe(true);
    assertSortedAndContinuous(loenudvikling?.beregnedeSegmenter ?? []);
    assertCoveragePerRange(loenudvikling?.beregnedeSegmenter ?? [], [{ fra: '2024-02-01', til: '2025-06-01' }]);
    assertTotalMatchesSegmentSum(loenudvikling);
  });

  it('håndterer anciennitetstillæg før TAF-start uden segmentfejl i overenskomst-regulering', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(32000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-05-01'), til: iso('2024-06-30'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-05-2024',
          tilDato: '01-05-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'laerer-overenskomsten',
          offentligLoenType: 'Månedsløn',
          offentligLoenTrin: 31,
          offentligLoenGruppe: 2,
          feriePct: 17.68,
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
          fuldLoenUnderFerie: 'Ja',
          harAnciennitetstillaegEfterSkadedatoen: true,
          anciennitetstillaegDato: iso('2024-01-15'),
          anciennitetstillaegSatsAngivesPer: 'Måned',
          anciennitetstillaegSats: asAmountValue(1000),
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-19') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;

    expect(loenudvikling?.loenudviklingTotal.status).toBe('ok');
    assertCoveragePerRange(loenudvikling?.beregnedeSegmenter ?? [], [{ fra: '2024-05-01', til: '2024-06-30' }]);
    expect((loenudvikling?.beregnedeSegmenter ?? [])[0]?.fra).toBe('2024-05-01');
  });

  it('tillader offentlig overenskomst-regulering før 01-01-2012 med fallback-segmenter', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(32000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2010-01-01'), til: iso('2013-12-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'laerer-overenskomsten',
          offentligLoenType: 'Månedsløn',
          offentligLoenTrin: 31,
          offentligLoenGruppe: 2,
          feriePct: 17.68,
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
          saerligFraDatoRegulering: iso('2011-12-31'),
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2011-12-31') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-19') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];
    expect(segments.some((segment) => segment.fra === '2010-01-01' && segment.deltaPct === 0)).toBe(true);
    expect(segments.some((segment) => segment.fra >= '2012-01-01')).toBe(true);
  });

  it('bruger samme lønudviklingsresultat for angivet månedsløn uanset persisted anciennitet sats-per (resolver-immunitet)', () => {
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });
    const baseEoLoenudvikling = {
      ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Overenskomst' as const,
      overenskomstId: 'laerer-overenskomsten',
      offentligLoenType: 'Månedsløn' as const,
      offentligLoenTrin: 31,
      offentligLoenGruppe: 2,
      feriePct: 17.68,
      loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
      harAnciennitetstillaegEfterSkadedatoen: true,
      anciennitetstillaegDato: iso('2024-03-01'),
      anciennitetstillaegSats: asAmountValue(1200),
    };
    const basePatch: Partial<ErstatningsopgoerelseValues> = {
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(32000),
      tafPerioder: [{ id: 'taf-1', fra: iso('2024-05-01'), til: iso('2024-12-31'), loseFeriedage: undefined }],
    };

    const withMonthPer = makeValues({
      ...basePatch,
      eoAngivetLoenLoenudvikling: {
        ...baseEoLoenudvikling,
        anciennitetstillaegSatsAngivesPer: 'Måned',
      },
    });
    const withTimePer = makeValues({
      ...basePatch,
      eoAngivetLoenLoenudvikling: {
        ...baseEoLoenudvikling,
        anciennitetstillaegSatsAngivesPer: 'Time',
      },
    });

    const monthPerModel = buildPdfModel(stamdata, withMonthPer, { dagsDatoISO: iso('2026-02-19') });
    const timePerModel = buildPdfModel(stamdata, withTimePer, { dagsDatoISO: iso('2026-02-19') });
    const monthPerLoenudvikling = monthPerModel.tabtArbejdsfortjeneste.loenudvikling;
    const timePerLoenudvikling = timePerModel.tabtArbejdsfortjeneste.loenudvikling;

    if (!monthPerLoenudvikling || monthPerLoenudvikling.loenudviklingTotal.status !== 'ok') {
      throw new Error('Forventet ok lønudvikling for måned-varianten');
    }
    if (!timePerLoenudvikling || timePerLoenudvikling.loenudviklingTotal.status !== 'ok') {
      throw new Error('Forventet ok lønudvikling for time-varianten');
    }

    expect(timePerLoenudvikling.loenudviklingTotal.value).toBe(monthPerLoenudvikling.loenudviklingTotal.value);
    expect(
      timePerLoenudvikling.beregnedeSegmenter.map((segment) => ({
        kind: segment.kind,
        fra: segment.fra,
        til: segment.til,
        deltaPct: segment.deltaPct,
        amountOre: segment.amountOre,
      }))
    ).toEqual(
      monthPerLoenudvikling.beregnedeSegmenter.map((segment) => ({
        kind: segment.kind,
        fra: segment.fra,
        til: segment.til,
        deltaPct: segment.deltaPct,
        amountOre: segment.amountOre,
      }))
    );
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    expect(segments.length).toBe(1);
    expect(segments[0].fra).toBe('2024-01-01');
    expect(segments[0].til).toBe('2024-01-31');
  });

  it('anvender manuel ferieprocent fra dateret række i PDF-reguleringen', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-01'), til: iso('2025-12-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-12-2024',
          tilDato: '01-12-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          feriePct: 12.5,
          loenudviklingManuelNavn: 'Manuel test',
          loenudviklingManuelTableData: [
            { id: 'm1', dato: '', grundloen: asAmountValue(30000), feriepenge: '12,5', shSoSats: '0', fritvalg: '0', agPension: '10' },
            { id: 'm2', dato: '01-01-2025', grundloen: asAmountValue(31000), feriepenge: '15,0', shSoSats: '0', fritvalg: '0', agPension: '10' },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-12-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    const changedSegment = segments.find((segment) => segment.fra === '2025-01-01');
    expect(changedSegment).toBeDefined();
    expect(changedSegment?.deltaPct).toBeCloseTo(5.62, 2);
  });

  it('falder tilbage til ansættelsens ferieprocent når manuel række har tom feriepenge', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum['Angivet månedsløn'],
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-12-01'), til: iso('2025-12-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-12-2024',
          tilDato: '01-12-2024',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          feriePct: 15,
          loenudviklingManuelNavn: 'Manuel test',
          loenudviklingManuelTableData: [
            { id: 'm1', dato: '', grundloen: asAmountValue(30000), feriepenge: '', shSoSats: '0', fritvalg: '0', agPension: '10' },
            { id: 'm2', dato: '01-01-2025', grundloen: asAmountValue(31000), feriepenge: '', shSoSats: '0', fritvalg: '0', agPension: '10' },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-12-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    const changedSegment = segments.find((segment) => segment.fra === '2025-01-01');
    expect(changedSegment).toBeDefined();
    expect(changedSegment?.deltaPct).toBeCloseTo(3.33, 2);
  });

  it('beregner loenudvikling pr. ansaettelsesforhold ved inkonsistente reguleringer i beregningsperiode', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum.Beregningsperiode,
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-12-31'),
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'a1',
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: loenudviklingStatistikModelEnum.enum['ASL-årslønsmaksimum'],
          indtaegtsoplysningerTableData: [
            {
              id: 'a1-r1',
              col0_maaned: '6',
              col1_maaned: '2023',
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
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'a2',
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
          indtaegtsoplysningerTableData: [
            {
              id: 'a2-r1',
              col0_maaned: '6',
              col1_maaned: '2023',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: asAmountValue(8000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;

    expect(loenudvikling).not.toBeNull();
    expect(loenudvikling?.perAnsaettelse).toHaveLength(2);
    expect(loenudvikling?.loenudviklingLabel).toBe('Flere reguleringstyper');
    expect(loenudvikling?.loenudviklingTotal.status).toBe('ok');
    expect(loenudvikling?.perAnsaettelse.every((entry) => entry.loenudviklingTotal.status === 'ok')).toBe(true);
    assertTotalMatchesSegmentSum(loenudvikling);
  });

  it('beregner loenudvikling pr. ansaettelsesforhold ved blandede strategier (overenskomst + statistik)', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum.Beregningsperiode,
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-12-31'),
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'a1',
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'bygge-anlaeg',
          loenPaaHelligdage: 'Almindelig løn',
          feriePct: 12.5,
          indtaegtsoplysningerTableData: [
            {
              id: 'a1-r1',
              col0_maaned: '6',
              col1_maaned: '2023',
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
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'a2',
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
          indtaegtsoplysningerTableData: [
            {
              id: 'a2-r1',
              col0_maaned: '6',
              col1_maaned: '2023',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: asAmountValue(8000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;

    expect(loenudvikling).not.toBeNull();
    expect(loenudvikling?.perAnsaettelse).toHaveLength(2);
    expect(loenudvikling?.loenudviklingLabel).toBe('Flere reguleringstyper');
    expect(loenudvikling?.perAnsaettelse.map((entry) => entry.loenudviklingLabel).sort()).toEqual(['ILON12 (Danmarks Statistik)', 'Overenskomst']);
    assertTotalMatchesSegmentSum(loenudvikling);
  });

  it('beregner stadig pr. ansaettelsesforhold selv når alle ansaettelser bruger samme strategi', () => {
    const eoValues = makeValues({
      beregnesUdFra: beregningsmetodeEnum.enum.Beregningsperiode,
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-12-31'),
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'a1',
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
          indtaegtsoplysningerTableData: [
            {
              id: 'a1-r1',
              col0_maaned: '6',
              col1_maaned: '2023',
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
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'a2',
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
          indtaegtsoplysningerTableData: [
            {
              id: 'a2-r1',
              col0_maaned: '6',
              col1_maaned: '2023',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: asAmountValue(8000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;

    expect(loenudvikling).not.toBeNull();
    expect(loenudvikling?.perAnsaettelse).toHaveLength(2);
    expect(loenudvikling?.loenudviklingLabel).toBe('ILON12 (Danmarks Statistik)');
    expect(loenudvikling?.perAnsaettelse.map((entry) => entry.loenudviklingLabel)).toEqual([
      'ILON12 (Danmarks Statistik)',
      'ILON12 (Danmarks Statistik)',
    ]);
    assertTotalMatchesSegmentSum(loenudvikling);
  });

  it('viser statuslinje for Efterløn', () => {
    const eoValues = makeValues({
      vedroererPeriodeTil: iso('2024-01-31'),
      tafArbejdsstatus: 'Efterløn',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.statusLinjer).toContain('Den 1. februar 2024 var skadelidte på efterløn.');
  });

  it('viser "blev ... raskmeldt" for Fuldt arbejdsdygtig når TAF går til og med dagen før', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      vedroererPeriodeTil: iso('2024-01-31'),
      tafArbejdsstatus: 'Fuldt arbejdsdygtig',
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.statusLinjer).toContain('Den 1. februar 2024 blev skadelidte raskmeldt.');
  });

  it('viser "var ... raskmeldt" for Fuldt arbejdsdygtig når TAF ikke går til dagen før', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      vedroererPeriodeTil: iso('2024-01-31'),
      tafArbejdsstatus: 'Fuldt arbejdsdygtig',
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-30'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.statusLinjer).toContain('Den 1. februar 2024 var skadelidte raskmeldt.');
  });

  it('tilføjer delvist-uarbejdsdygtig suffix for fleksjob', () => {
    const eoValues = makeValues({
      vedroererPeriodeTil: iso('2024-01-31'),
      tafArbejdsstatus: 'Fleksjob',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.statusLinjer).toContain(
      'Den 1. februar 2024 var skadelidte bevilget fleksjob og således fortsat delvist uarbejdsdygtig.'
    );
  });

  it('tilføjer uarbejdsdygtig suffix for førtidspension', () => {
    const eoValues = makeValues({
      vedroererPeriodeTil: iso('2024-01-31'),
      tafArbejdsstatus: 'Førtidspension',
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.statusLinjer).toContain(
      'Den 1. februar 2024 var skadelidte på førtidspension og således fortsat uarbejdsdygtig.'
    );
  });

  it('viser kun endelig EET-linje informativt når begge afgørelser er angivet uden ophørsgrund', () => {
    const eoValues = makeValues({
      endeligtEETAfgorelse: 'Ja',
      endeligEETVirkningsdato: iso('2024-06-01'),
      midlertidigtEETAfgorelse: 'Ja',
      midlertidigEETVirkningsdato: iso('2024-05-01'),
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('endelig erhvervsevnetabsafgørelse'))).toBe(true);
    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('midlertidig erhvervsevnetabsafgørelse'))).toBe(false);
  });

  it('midlertidig EET tidligst, skadedato < 2011-06-16 → kun midlertidig EET-linje vises og får PRE-2011-ophørstekst', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      midlertidigtEETAfgorelse: 'Ja',
      midlertidigEETVirkningsdato: iso('2010-06-01'),
      endeligtEETAfgorelse: 'Ja',
      endeligEETVirkningsdato: iso('2011-01-01'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2009-01-01'), til: iso('2010-12-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2009-03-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('midlertidig erhvervsevnetabsafgørelse'))).toBe(true);
    expect(model.tabtArbejdsfortjeneste.eetLinjer).toContain(
      'Da skaden er sket før 16. juni 2011, bringer afgørelsen retten til tabt arbejdsfortjeneste til ophør.'
    );
    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('endelig erhvervsevnetabsafgørelse'))).toBe(false);
  });

  it('endelig EET tidligst, skadedato < 2011-06-16 → kun endelig EET-linje vises og får ophørstekst', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      midlertidigtEETAfgorelse: 'Ja',
      midlertidigEETVirkningsdato: iso('2011-01-01'),
      endeligtEETAfgorelse: 'Ja',
      endeligEETVirkningsdato: iso('2010-06-01'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2009-01-01'), til: iso('2010-12-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2009-03-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('endelig erhvervsevnetabsafgørelse'))).toBe(true);
    expect(model.tabtArbejdsfortjeneste.eetLinjer).toContain('Afgørelsen bringer retten til tabt arbejdsfortjeneste til ophør.');
    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('midlertidig erhvervsevnetabsafgørelse'))).toBe(false);
  });

  it('pre-2011 med begge EET-afgørelser vælger tidligste beregnede dato og bruger afgørelsesdato når virkningsdato mangler', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      midlertidigtEETAfgorelse: 'Ja',
      midlertidigEETAfgoerelseDato: iso('2010-05-01'),
      endeligtEETAfgorelse: 'Ja',
      endeligEETAfgoerelseDato: iso('2010-06-01'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2009-01-01'), til: iso('2010-12-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2009-03-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('midlertidig erhvervsevnetabsafgørelse'))).toBe(true);
    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('endelig erhvervsevnetabsafgørelse'))).toBe(false);
  });

  it('post-2011 med kun midlertidig EET viser afgørelsen informativt uden PRE-2011-ophørstekst', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      midlertidigtEETAfgorelse: 'Ja',
      midlertidigEETVirkningsdato: iso('2024-06-01'),
      endeligtEETAfgorelse: 'Nej',
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('midlertidig erhvervsevnetabsafgørelse'))).toBe(true);
    expect(model.tabtArbejdsfortjeneste.eetLinjer).not.toContain(
      'Da skaden er sket før 16. juni 2011, bringer afgørelsen retten til tabt arbejdsfortjeneste til ophør.'
    );
  });

  it('tilføjer ophørstekst for differencekrav når TAF går til dagen før differencekrav', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      differencekravDato: iso('2024-07-01'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-06-01'), til: iso('2024-12-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.eetLinjer).toHaveLength(0);
    expect(model.tabtArbejdsfortjeneste.differencekravLinje).toBe(
      'Der er opgjort differencekrav i sagen den 1. juli 2024. Differencekravet bringer retten til tabt arbejdsfortjeneste til ophør.'
    );
  });

  it('viser differencekrav som ophørsgrund og endelig EET som informativ linje når differencekrav kommer først', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      endeligtEETAfgorelse: 'Ja',
      endeligEETVirkningsdato: iso('2024-08-01'),
      differencekravDato: iso('2024-06-15'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('endelig erhvervsevnetabsafgørelse'))).toBe(true);
    expect(model.tabtArbejdsfortjeneste.eetLinjer).not.toContain('Afgørelsen bringer retten til tabt arbejdsfortjeneste til ophør.');
    expect(model.tabtArbejdsfortjeneste.differencekravLinje).toBe(
      'Der er opgjort differencekrav i sagen den 15. juni 2024. Differencekravet bringer retten til tabt arbejdsfortjeneste til ophør.'
    );
  });

  it('viser endelig EET informativt og skjuler differencekrav når ingen af dem bringer TAF til ophør', () => {
    const eoValues = makeValues({
      endeligtEETAfgorelse: 'Ja',
      endeligEETVirkningsdato: iso('2024-06-01'),
      differencekravDato: iso('2024-05-01'),
      tafPerioder: [],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('endelig erhvervsevnetabsafgørelse'))).toBe(true);
    expect(model.tabtArbejdsfortjeneste.differencekravLinje).toBeNull();
  });

  it('bruger differencekrav som tie-breaker ved samme ophørsdato', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      endeligtEETAfgorelse: 'Ja',
      endeligEETVirkningsdato: iso('2024-07-01'),
      differencekravDato: iso('2024-07-01'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-06-30'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });

    expect(model.tabtArbejdsfortjeneste.differencekravLinje).toBe(
      'Der er opgjort differencekrav i sagen den 1. juli 2024. Differencekravet bringer retten til tabt arbejdsfortjeneste til ophør.'
    );
    expect(model.tabtArbejdsfortjeneste.eetLinjer.some((line) => line.includes('endelig erhvervsevnetabsafgørelse'))).toBe(true);
  });

  it('viser måneder-mellemregning uden fraværsled ved 0 øvrige fraværsdage', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2021-03-01'),
      tafBeregningsperiodeTil: iso('2022-02-28'),
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;

    expect(indkomst?.beregningsgrundlagMellemregningLabel).toBe('I perioden var der 12 måneder.');
    expect(indkomst?.beregningsgrundlagMellemregningResultat).toBeNull();
  });

  it('bruger ental i måneder-mellemregning ved 1 fraværsdag', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2021-03-01'),
      tafBeregningsperiodeTil: iso('2022-02-28'),
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;

    expect(indkomst?.beregningsgrundlagMellemregningLabel).toContain('1 fraværsdag pga. orlov uden løn x 4,8 % måned');
  });

  it('ignorerer stale fraværsbeskrivelse når øvrigt fravær uden løn er Nej', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2021-03-01'),
      tafBeregningsperiodeTil: iso('2022-02-28'),
      oevrigtFravaerUdenLoen: 'Nej',
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;

    expect(indkomst?.beregningsgrundlagMellemregningLabel).not.toContain('orlov');
  });

  it('viser arbejdsdage-mellemregning med feriedage inkl. løse feriedage', () => {
    const periodeFra = iso('2024-01-01');
    const periodeTil = iso('2024-01-10');
    const ferieFra = iso('2024-01-04');
    const ferieTil = iso('2024-01-05');
    const loseFeriedage = 2;

    const eoValues = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: periodeFra,
      tafBeregningsperiodeTil: periodeTil,
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
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;
    const breakdown = calculateTafArbejdsdageBreakdown(
      periodeFra,
      periodeTil,
      [{ id: 'f1', fra: ferieFra, til: ferieTil }],
      loseFeriedage,
      { kind: 'beregningsgrundlag', oevrigeFravaersdage: 0 }
    );
    const samledeFeriedage = (breakdown?.feriedage ?? 0) + (breakdown?.loseFeriedage ?? 0);

    expect(indkomst?.beregningsgrundlagMellemregningLabel).toContain(` - ${samledeFeriedage.toLocaleString('da-DK')} ferie-/feriefridage`);
    expect(indkomst?.beregningsgrundlagMellemregningLabel).not.toContain('løse feriedage');
  });

  it('medregner offentlige ydelser i beregningsgrundlaget for beregningsperiode', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-01-31'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-02-01'), til: iso('2024-02-28'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [],
        },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2024',
          tilDato: '31-01-2024',
          ydelse: asAmountValue(1000),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;

    expect(indkomst?.offentligeYdelserTotalOre).toBe(100000);
    expect(indkomst?.samletBeregningsgrundlagOre).toBe(100000);
    expect(indkomst?.maanedsloen.status).toBe('ok');
    if (indkomst?.maanedsloen.status === 'ok') {
      expect(indkomst.maanedsloen.value).toBe(100000);
    }
  });

  it('beregner tillæg og pension med satsen på anvendt reguleringsdato ved beregningsperiode', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-02-29'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-03-01'), til: iso('2024-03-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          saerligFraDatoRegulering: iso('2024-02-01'),
          feriePct: 12.5,
          pensionPct: 8,
          indtaegtsoplysningerTableData: [
            {
              id: 'jan',
              col0_maaned: '1',
              col1_maaned: '2024',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: asAmountValue(10000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
            {
              id: 'feb',
              col0_maaned: '2',
              col1_maaned: '2024',
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
          loenudviklingManuelTableData: [
            { id: 'm1', dato: '', grundloen: asAmountValue(100), feriepenge: '12,5', shSoSats: '', fritvalg: '', agPension: '8' },
            { id: 'm2', dato: '01-02-2024', grundloen: asAmountValue(100), feriepenge: '12,5', shSoSats: '', fritvalg: '', agPension: '10' },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-03-01') });

    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;

    expect(indkomst?.arbejdssteder[0]?.pensionLabel).toBe('Arbejdsgivers pensionsbidrag (10 % af løn + tillæg)');
    expect(indkomst?.arbejdssteder[0]?.breakdown.loenPlusLoen2Ore).toBe(2000000);
    expect(indkomst?.arbejdssteder[0]?.breakdown.fpFvShSoOre).toBe(259000);
    expect(indkomst?.arbejdssteder[0]?.breakdown.pensionOre).toBe(225900);
    expect(indkomst?.arbejdssteder[0]?.breakdown.samletOre).toBe(2484900);
    expect(indkomst?.totalBreakdown?.pensionOre).toBe(225900);
    expect(indkomst?.samletBeregningsgrundlagOre).toBe(2484900);
  });

  it.each([
    ['Statistik', { loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)' }],
    ['KRL satstabel', { loenudviklingKRLSatstabel: 'KTO (kommuner)' }],
  ] as const)(
    'medregner Store Bededag i beregningsgrundlaget efter 01-01-2024 ved %s uden særskilt reguleringslogik',
    (grundlag, extraFields) => {
      const eoValues = makeValues({
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: iso('2024-01-01'),
        tafBeregningsperiodeTil: iso('2024-02-29'),
        tafPerioder: [
          { id: 'taf-1', fra: iso('2024-03-01'), til: iso('2024-03-31'), loseFeriedage: undefined },
        ],
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            harOverenskomst: false,
            overenskomstId: undefined,
            loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
            loenudviklingBeregningsgrundlag: grundlag,
            feriePct: 0,
            fritvalgPct: 0,
            shSoPct: 0,
            pensionPct: 0,
            indtaegtsoplysningerTableData: [
              {
                id: 'jan',
                col0_maaned: '1',
                col1_maaned: '2024',
                col0_uge: '',
                col1_uge: '',
                col0_dag: '',
                col1_dag: '',
                col2: asAmountValue(10000),
                col3: undefined,
                col4: undefined,
                col5: undefined,
              },
              {
                id: 'feb',
                col0_maaned: '2',
                col1_maaned: '2024',
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
            ...extraFields,
          },
        ],
      });
      const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2023-05-24') });

      const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
      const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;

      expect(indkomst?.arbejdssteder[0]?.fpLabel).toContain('Store Bededag (0,45 %)');
      expect(indkomst?.arbejdssteder[0]?.breakdown.loenPlusLoen2Ore).toBe(2000000);
      expect(indkomst?.arbejdssteder[0]?.breakdown.fpFvShSoOre).toBe(9000);
      expect(indkomst?.arbejdssteder[0]?.breakdown.samletOre).toBe(2009000);
      expect(indkomst?.samletBeregningsgrundlagOre).toBe(2009000);
    }
  );

  it.each([
    ['Statistik', { loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)' }],
    ['KRL satstabel', { loenudviklingKRLSatstabel: 'KTO (kommuner)' }],
  ] as const)(
    'medregner ikke Store Bededag i beregningsgrundlaget før 01-01-2024 ved %s',
    (grundlag, extraFields) => {
      const eoValues = makeValues({
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: iso('2023-10-01'),
        tafBeregningsperiodeTil: iso('2023-12-31'),
        tafPerioder: [
          { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
        ],
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            harOverenskomst: false,
            overenskomstId: undefined,
            loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
            loenudviklingBeregningsgrundlag: grundlag,
            feriePct: 0,
            fritvalgPct: 0,
            shSoPct: 0,
            pensionPct: 0,
            indtaegtsoplysningerTableData: [
              {
                id: 'dec',
                col0_maaned: '12',
                col1_maaned: '2023',
                col0_uge: '',
                col1_uge: '',
                col0_dag: '',
                col1_dag: '',
                col2: asAmountValue(20000),
                col3: undefined,
                col4: undefined,
                col5: undefined,
              },
            ],
            ...extraFields,
          },
        ],
      });
      const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2023-05-24') });

      const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-04') });
      const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;

      expect(indkomst?.arbejdssteder[0]?.fpLabel).not.toContain('Store Bededag');
      expect(indkomst?.arbejdssteder[0]?.breakdown.fpFvShSoOre).toBe(0);
      expect(indkomst?.samletBeregningsgrundlagOre).toBe(2000000);
    }
  );

  it.each([
    ['Angivet månedsløn'],
    ['Angivet dagsløn'],
  ] as const)('anvender statistik-fallback (variant B) for manglende basisdækning ved %s', (beregningsmetode) => {
    const baseAf = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      loenudviklingBeregningsgrundlag: 'Statistik' as const,
      loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
      indtaegtsoplysningerTableData: [
        {
          id: 'r1',
          col0_maaned: '6',
          col1_maaned: '2000',
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
    };

    const eoValues = makeValues({
      beregnesUdFra: beregningsmetode,
      maanedsloenenUdgoer: beregningsmetode === 'Angivet månedsløn' ? asAmountValue(32000) : undefined,
      dagsloenenUdgoer: beregningsmetode === 'Angivet dagsløn' ? asAmountValue(1500) : undefined,
      tafPerioder: [
        { id: 'taf-1', fra: iso('2004-01-01'), til: iso('2006-12-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2004',
          tilDato: '01-01-2004',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [baseAf],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2000-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    const firstSegment = segments.find((segment) => segment.fra === '2004-01-01');
    expect(firstSegment?.deltaPct).toBe(0);
    expect(segments.some((segment) => segment.fra >= '2006-01-01' && segment.deltaPct > 0)).toBe(true);
  });

  it('anvender statistik-fallback (variant B) for manglende basisdækning ved Beregningsperiode', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-12-31'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2004-01-01'), til: iso('2006-12-31'), loseFeriedage: undefined },
      ],
      offentligeYdelserRows: [
        {
          id: 'ydelse-1',
          fraDato: '01-01-2004',
          tilDato: '01-01-2004',
          ydelse: asAmountValue(1),
          tillaeg: asAmountValue(0),
          ydelsestype: 'Sygedagpenge',
        },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
          saerligFraDatoRegulering: iso('2000-01-01'),
          indtaegtsoplysningerTableData: [
            {
              id: 'row-1',
              col0_maaned: '6',
              col1_maaned: '2023',
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
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    expect(segments.some((segment) => segment.fra === '2004-01-01' && segment.deltaPct === 0)).toBe(true);
    expect(segments.some((segment) => segment.fra >= '2006-01-01' && segment.deltaPct > 0)).toBe(true);
  });

  it('bevarer ASL-segmenter uden data som 0-regulering (ikke filtreret væk)', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2004-01-01'), til: iso('2005-12-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: loenudviklingStatistikModelEnum.enum['ASL-årslønsmaksimum'],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2000-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    expect(segments.some((segment) => segment.fra === '2004-01-01' && segment.deltaPct === 0)).toBe(true);
    expect(segments.some((segment) => segment.fra === '2005-01-01')).toBe(true);
  });

  it('anvender KRL-fallback (variant B) når reguleringsdato ligger før første sats', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2000-01-01'), til: iso('2002-12-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'KRL satstabel',
          loenudviklingKRLSatstabel: 'KTO (kommuner)',
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2000-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    expect(segments.some((segment) => segment.fra === '2000-01-01' && segment.deltaPct === 0)).toBe(true);
    expect(segments.some((segment) => segment.fra >= '2001-10-01' && segment.deltaPct > 0)).toBe(true);
  });

  it('anvender overenskomst-fallback (privat) for tidlige perioder uden sats', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2009-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'bygge-anlaeg',
          feriePct: 12.5,
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2009-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    expect(segments.some((segment) => segment.fra === '2009-01-01' && segment.deltaPct === 0)).toBe(true);
    expect(segments.some((segment) => segment.fra >= '2011-03-01')).toBe(true);
  });

  it('anvender overenskomst-fallback (offentlig) for perioder før 01-01-2012 uden crash', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(32000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2010-01-01'), til: iso('2013-12-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'laerer-overenskomsten',
          offentligLoenType: 'Månedsløn',
          offentligLoenTrin: 31,
          offentligLoenGruppe: 2,
          feriePct: 17.68,
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2010-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    expect(segments.some((segment) => segment.fra === '2010-01-01' && segment.deltaPct === 0)).toBe(true);
    expect(segments.some((segment) => segment.fra >= '2012-01-01')).toBe(true);
  });

  it('indsætter Store Bededag som separat segment 01-01-2024 for offentlig overenskomst', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(32000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2023-12-01'), til: iso('2024-03-31'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'kl-overenskomst',
          offentligLoenType: 'Timeløn',
          offentligLoenTrin: 20,
          offentligLoenGruppe: 0,
          feriePct: 16.95,
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2023-05-24') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    expect(segments.some((segment) => segment.fra === '2024-01-01')).toBe(true);
  });

  it('anvender historisk privat overenskomstdækning og Store Bededag som særskilt segment fra 01-01-2024', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2023-12-01'), til: iso('2024-04-30'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          // Maskinhandler-overenskomsten har historiske satser før 2024 og Store Bededag fra 01-01-2024.
          overenskomstId: 'maskinhandler-overenskomsten',
          feriePct: 12.5,
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2020-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    const beforeStore = segments.find((segment) => segment.fra === '2023-12-01');
    const storeSegment = segments.find((segment) => segment.fra === '2024-01-01');
    const segmentsBeforeStore = segments.filter((segment) => segment.fra < '2024-01-01');

    expect(beforeStore).toBeDefined();
    expect(beforeStore?.deltaPct).toBeCloseTo(16.47, 2);
    expect(segmentsBeforeStore.every((segment) => Math.abs(segment.deltaPct - 16.47) < 0.005)).toBe(true);
    expect(storeSegment).toBeDefined();
    expect(storeSegment?.deltaPct).toBeCloseTo(16.89, 2);
  });

  it('indregner indtastede pct-satser som basis ved privat overenskomst uden sats på reguleringsdatoen', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-12-31'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-03-01'), til: iso('2024-04-30'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          // Maskinhandler-overenskomsten har historiske satser, så reguleringen bruger faktisk dækning.
          overenskomstId: 'maskinhandler-overenskomsten',
          feriePct: 12.5,
          shSoPct: 2.7,
          pensionPct: 8.15,
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['SH-udbetaling'],
          saerligFraDatoRegulering: iso('2020-01-01'),
          indtaegtsoplysningerTableData: [
            {
              id: 'row-1',
              col0_maaned: '6',
              col1_maaned: '2023',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: asAmountValue(30000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2016-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segment = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter[0];

    expect(segment).toBeDefined();
    expect(segment?.fra).toBe('2024-03-01');
    expect(segment?.deltaPct).toBeCloseTo(22.19, 2);
  });

  it('anvender Store Bededag-regulering fra 01-01-2024 i manuel regulering selv når næste manuelle række er 01-03-2024', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2023-06-01'), til: iso('2024-04-30'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          loenudviklingManuelNavn: 'overenskomst Tandlægeforening/HK',
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
          feriePct: 15,
          loenudviklingManuelTableData: [
            {
              id: 'm1',
              dato: '',
              grundloen: asAmountValue(25174),
              feriepenge: '15,00',
              shSoSats: '',
              fritvalg: '7,00',
              agPension: '9,00',
            },
            {
              id: 'm2',
              dato: '01-03-2024',
              grundloen: asAmountValue(25174),
              feriepenge: '15,00',
              shSoSats: '',
              fritvalg: '9,00',
              agPension: '11,00',
            },
            {
              id: 'm3',
              dato: '01-04-2024',
              grundloen: asAmountValue(25895),
              feriepenge: '15,00',
              shSoSats: '',
              fritvalg: '9,00',
              agPension: '11,00',
            },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2023-05-24') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    const storeSegment = segments.find((segment) => segment.fra === '2024-01-01');
    expect(storeSegment).toBeDefined();
    expect(storeSegment?.til).toBe('2024-02-29');
  });

  it('anvender Store Bededag i manuel regulering når hele TAF-perioden ligger efter 01-01-2024 men reguleringsdatoen ligger før', () => {
    const eoValues = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmountValue(30000),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-26'), til: iso('2024-10-20'), loseFeriedage: undefined },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Manuelt angivet',
          loenudviklingManuelNavn: 'Manuelt angivet',
          saerligFraDatoRegulering: iso('2023-12-31'),
          loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
          feriePct: 16.95,
          loenudviklingManuelTableData: [
            {
              id: 'm1',
              dato: '',
              grundloen: asAmountValue(177.56),
              feriepenge: '',
              shSoSats: '',
              fritvalg: '',
              agPension: '14,37',
            },
            {
              id: 'm2',
              dato: '01-04-2024',
              grundloen: asAmountValue(184.66),
              feriepenge: '',
              shSoSats: '',
              fritvalg: '',
              agPension: '14,37',
            },
            {
              id: 'm3',
              dato: '01-10-2024',
              grundloen: asAmountValue(187.06),
              feriepenge: '',
              shSoSats: '',
              fritvalg: '',
              agPension: '14,37',
            },
          ],
        },
      ],
    });
    const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2023-01-01') });
    const model = buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') });
    const segments = model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [];

    expect(segments[0]?.fra).toBe('2024-01-26');
    expect(segments[0]?.deltaPct).toBeCloseTo(0.38, 2);
  });

  it('fejler fail-closed ved datakorruption i statistikindeks', () => {
    const spy = vi.spyOn(statistikRatesData, 'getStatistiskLoenudvikling').mockReturnValue({
      meta: { id: 'ILON12' as statistikRatesData.StatistiskLoenudviklingId, navn: 'ILON12', hjaelpetekst: 'test' },
      indeksvaerdier: [
        { kvartal: '2006K1' as statistikRatesData.Kvartal, indeksvaerdi: 0 },
        { kvartal: '2005K1' as statistikRatesData.Kvartal, indeksvaerdi: 100 },
      ],
    });
    try {
      const eoValues = makeValues({
        beregnesUdFra: 'Angivet månedsløn',
        maanedsloenenUdgoer: asAmountValue(32000),
        tafPerioder: [{ id: 'taf-1', fra: iso('2006-01-01'), til: iso('2006-12-31'), loseFeriedage: undefined }],
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            loenudviklingBeregningsgrundlag: 'Statistik',
            loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
          },
        ],
      });
      const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2005-01-01') });
      expectSilencedConsoleErrorThrow(
        () => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') }),
        'Loenudvikling kan ikke beregnes: ugyldigt indeks for segment'
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('fejler fail-closed ved datakorruption i ASL-indeks', () => {
    // ASL-data eksporteres som en konstant map (ingen funktions-wrapper at spyOn),
    // så testen muterer midlertidigt og restorer altid i finally.
    const original2006 = aarsloenAslMax[2006];
    aarsloenAslMax[2006] = 0;
    try {
      const eoValues = makeValues({
        beregnesUdFra: 'Angivet månedsløn',
        maanedsloenenUdgoer: asAmountValue(32000),
        tafPerioder: [{ id: 'taf-1', fra: iso('2005-01-01'), til: iso('2006-12-31'), loseFeriedage: undefined }],
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            loenudviklingBeregningsgrundlag: 'Statistik',
            loenudviklingStatistikModel: loenudviklingStatistikModelEnum.enum['ASL-årslønsmaksimum'],
          },
        ],
      });
      const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2005-01-01') });
      expectSilencedConsoleErrorThrow(
        () => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') }),
        'Loenudvikling kan ikke beregnes: ugyldigt ASL indeks'
      );
    } finally {
      aarsloenAslMax[2006] = original2006;
    }
  });

  it('fejler fail-closed ved datakorruption i KRL-indeks', () => {
    const spy = vi.spyOn(krlRatesData, 'getKRLSatstabel').mockReturnValue({
      id: 'KTO (kommuner)',
      navn: 'KTO (kommuner)',
      vaerdier: [
        { fraDato: '01-10-2001', reguleringsPct: -100 },
        { fraDato: '01-04-2001', reguleringsPct: 0 },
      ],
    });
    try {
      const eoValues = makeValues({
        beregnesUdFra: 'Angivet månedsløn',
        maanedsloenenUdgoer: asAmountValue(32000),
        tafPerioder: [{ id: 'taf-1', fra: iso('2001-04-01'), til: iso('2002-01-01'), loseFeriedage: undefined }],
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            loenudviklingBeregningsgrundlag: 'KRL satstabel',
            loenudviklingKRLSatstabel: 'KTO (kommuner)',
          },
        ],
      });
      const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2001-01-01') });
      expectSilencedConsoleErrorThrow(
        () => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') }),
        'Loenudvikling kan ikke beregnes: ugyldigt KRL indeks for segment'
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('fejler fail-closed ved ugyldig overenskomst-satsdata (privat)', () => {
    const spy = vi.spyOn(overenskomstRatesData, 'getEffektiveSatserForDato').mockReturnValue({
      fraDato: '01-03-2011',
      grundloen: 0,
      shSoSats: 0.069,
      fritvalg: null,
      agPension: 0.08,
      sfgg: null,
      sfggFaglKbh: null,
      sfggFaglProv: null,
      sfggUfaglKbh: null,
      sfggUfaglProv: null,
    });
    try {
      const eoValues = makeValues({
        beregnesUdFra: 'Angivet månedsløn',
        maanedsloenenUdgoer: asAmountValue(32000),
        tafPerioder: [{ id: 'taf-1', fra: iso('2011-03-01'), til: iso('2011-12-31'), loseFeriedage: undefined }],
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            loenudviklingBeregningsgrundlag: 'Overenskomst',
            overenskomstId: 'bygge-anlaeg',
            feriePct: 12.5,
            loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
          },
        ],
      });
      const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2011-03-01') });
      expectSilencedConsoleErrorThrow(
        () => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') }),
        'Loenudvikling kan ikke beregnes: ugyldig basisgrundloen'
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('fejler fail-closed ved ugyldig offentlig løndata', () => {
    const spy = vi.spyOn(offentligLoenLookupData, 'getOffentligLoenForDato').mockReturnValue({
      overenskomstType: 'KL',
      effectiveDate: '01-01-2012',
      loentrin: 31,
      loengruppe: 2,
      maanedsLoen: 0,
      timeLoen: 0,
    } as OffentligLoenResultat);
    try {
      const eoValues = makeValues({
        beregnesUdFra: 'Angivet månedsløn',
        maanedsloenenUdgoer: asAmountValue(32000),
        tafPerioder: [{ id: 'taf-1', fra: iso('2012-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined }],
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            loenudviklingBeregningsgrundlag: 'Overenskomst',
            overenskomstId: 'laerer-overenskomsten',
            offentligLoenType: 'Månedsløn',
            offentligLoenTrin: 31,
            offentligLoenGruppe: 2,
            feriePct: 17.68,
            loenPaaHelligdage: loenPaaHelligdageSchema.enum['Almindelig løn'],
          },
        ],
      });
      const stamdata = makeStamdata({ skadestype: 'Arbejdsulykke', skadedato: iso('2012-01-01') });
      expectSilencedConsoleErrorThrow(
        () => buildPdfModel(stamdata, eoValues, { dagsDatoISO: iso('2026-02-24') }),
        'Loenudvikling kan ikke beregnes: ugyldig basisgrundloen'
      );
    } finally {
      spy.mockRestore();
    }
  });
});
