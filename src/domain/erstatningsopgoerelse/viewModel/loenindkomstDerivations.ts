import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
} from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { parseISODate } from '../../../types/branded';
import { formatDanishDate } from '../../../utils/dateUtils';
import type { StandardLoenTableSatser } from '../../../types/table';
import {
  getOverenskomstMetaById,
  getOverenskomsterByOrg,
  isOffentligOverenskomstId,
  type OverenskomstMeta,
} from '../../../data/overenskomstRates';
import { toLoentrin } from '../../../data/offentligLoenTypes';
import { offentligLoenTypeEnum } from '../../../schemas/formSchemas';
import { getAngivetLoenOpreguleresFraDato } from '../helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../helpers/eoSharedUtils';
import {
  resolveSfggSource,
  resolveSfggReferenceperiodeDayCount,
  resolveSfggReferenceperiodeMaxDate,
  getFirstIndtastedeTafFraDato,
} from '../engines/sygeferiegodtgoerelse';
import { shouldRequireSygeferiegodtgoerelseInput } from '../helpers/sygeferiegodtgoerelseEligibility';
import {
  buildStandardLoenZeroArbejdsdageCellErrorMessages,
  type AarsloenZeroArbejdsdageValidationInput,
} from '../validation/indkomstRowValidation';
import {
  validateLoenudviklingManualBaseRowSatser,
  type ManualBaseRowCellErrors,
} from '../validation/loenudviklingManuelBaseRowValidation';
import { calculateLoenindkomstRowDerived } from '../helpers/loenindkomstRowDerived';

/**
 * Ren (React-fri) afledning for Loenindkomst-fanen.
 *
 * Hele "given committed input → flad afledt model" bor her, så den kan unit-testes uden
 * React-render (jf. arkitektur-kandidat A1 — view-model-lagets primære gevinst: afledning testbar
 * uden render). `useLoenindkomstViewModel` ejer kun React-state/effekter/handlers og kalder denne
 * funktion inde i en `useMemo`. Modstykket til den allerede udskilte rene sats-validering i
 * `validation/loenindkomstSatsValidation.ts`.
 *
 * Adfærdsbevarende: hver afledning er flyttet uændret ud af hooken/kortet — samme tal, samme
 * synlighed, samme fejl-ordlyd.
 */

type AnsaettelsesforholdList = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'];
type Ansaettelsesforhold = LoenindkomstAnsaettelsesforhold;
type SfggRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];

export type SfggReferenceperiodeAvailability = Readonly<{
  maxFravaersdage: number | undefined;
  hasNoRelevantDaysError: boolean;
  dayLabel: 'kalenderdage' | 'arbejdsdage' | null;
}>;

export type LoenudviklingBaseDate = Readonly<{
  display: string;
  iso: ISODateString | undefined;
  errorMessage: string | undefined;
}>;

export type LoenindkomstRowDerivedCalculator = (
  row: Ansaettelsesforhold['indtaegtsoplysningerTableData'][number]
) => ReturnType<typeof calculateLoenindkomstRowDerived>;

export type LoenindkomstDerivationInput = Readonly<{
  loenindkomstAnsaettelsesforhold: AnsaettelsesforholdList;
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
  tafBeregningsperiodeFra: ErstatningsopgoerelseValues['tafBeregningsperiodeFra'];
  tafBeregningsperiodeTil: ErstatningsopgoerelseValues['tafBeregningsperiodeTil'];
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder'];
  fravaerPerioder: ErstatningsopgoerelseValues['fravaerPerioder'];
  eoValues: ErstatningsopgoerelseValues;
  skadedato: ISODateString | undefined;
}>;

/**
 * Den flade afledte model som Loenindkomst-fanen og dens kort forbruger. Per-af-opslag eksponeres
 * som rene funktioner/maps, så kortene aldrig behøver rå committed EO-state (`eoValues`) for at
 * udlede deres visning (jf. A1 — ingen rå committed state gennem konteksten).
 */
export type LoenindkomstFlatModel = Readonly<{
  satserByAfId: ReadonlyMap<string, StandardLoenTableSatser>;
  derivedCalculatorByAfId: ReadonlyMap<string, LoenindkomstRowDerivedCalculator>;
  manualBaseRowErrorsByAfId: Readonly<Record<string, ManualBaseRowCellErrors>>;
  aarsloenExternalCellErrorMessagesByAfId: Readonly<Record<string, Readonly<Record<string, string>>>>;

  // Per-af rene afledninger (committed-only).
  getAnvendtReguleringsdatoForAnsaettelsesforhold: (
    af: Pick<Ansaettelsesforhold, 'saerligFraDatoRegulering'>
  ) => ISODateString | undefined;
  getSfggReferenceperiodeAvailability: (
    employment: Ansaettelsesforhold,
    row: SfggRow | undefined
  ) => SfggReferenceperiodeAvailability;
  getLoenudviklingBaseDate: (af: Ansaettelsesforhold) => LoenudviklingBaseDate;
  isOffentligLoenSelectionReady: (af: Ansaettelsesforhold) => boolean;
  resolveOverenskomstLabel: (overenskomstId: string | undefined) => string;
  getFilteredOverenskomsterForAnsaettelsesforhold: (
    af: Ansaettelsesforhold
  ) => ReadonlyArray<OverenskomstMeta>;

  // Per-af kort-afledninger der tidligere blev udregnet inde i AnsaettelsesforholdCard FRA eoValues.
  // Eksponeres her, så kortet ikke længere behøver rå committed EO-state.
  showSygeferiegodtgoerelseSection: (af: Ansaettelsesforhold) => boolean;
  getSfggRowForAf: (af: Ansaettelsesforhold) => SfggRow | undefined;
  firstTafFraDato: ISODateString | undefined;
  sfggReferenceperiodeMaxDate: ISODateString | undefined;
}>;

/**
 * Ren afledning: bygger hele den flade view-model ud fra committed input.
 *
 * Funktionerne i den returnerede model er afledning over committed input og holder ikke state.
 * `eoValues` modtages her, men eksponeres aldrig rå tilbage — kun afledte tal/flags.
 */
export function deriveLoenindkomstVm(input: LoenindkomstDerivationInput): LoenindkomstFlatModel {
  const {
    loenindkomstAnsaettelsesforhold,
    beregnesUdFra,
    tafBeregningsperiodeFra,
    tafBeregningsperiodeTil,
    ferieperioder,
    fravaerPerioder,
    eoValues,
    skadedato,
  } = input;

  // Stabile sats-props pr. af til React.memo'd StandardLoenTable.
  const satserByAfId = new Map<string, StandardLoenTableSatser>();
  for (const af of loenindkomstAnsaettelsesforhold) {
    satserByAfId.set(af.id, {
      ferie: af.feriePct,
      fritvalg: af.fritvalgPct,
      shSo: af.shSoPct,
      bededag: af.storeBededagPct,
      pension: af.pensionPct,
    } satisfies StandardLoenTableSatser);
  }

  const derivedCalculatorByAfId = new Map<string, LoenindkomstRowDerivedCalculator>();
  for (const af of loenindkomstAnsaettelsesforhold) {
    derivedCalculatorByAfId.set(af.id, (row) =>
      calculateLoenindkomstRowDerived({
        row,
        ansaettelsesforhold: af,
        context: {
          beregnesUdFra,
          tafBeregningsperiodeFra,
          tafBeregningsperiodeTil,
          loenindkomstAnsaettelsesforhold,
          ferieperioder,
          fravaerPerioder,
        },
        skadedato,
      })
    );
  }

  const manualBaseRowErrorsByAfId: Record<string, ManualBaseRowCellErrors> = {};
  for (const af of loenindkomstAnsaettelsesforhold) {
    if (af.loenudviklingBeregningsgrundlag !== 'Manuelt angivet') continue;
    // Beløb-tilstand: basisrækkens tillægsprocenter er brugerindtastede (låst op) og skal IKKE
    // spejle satsfelterne ovenfor — den procent-tilstands-invariant, denne validering håndhæver,
    // gælder ikke der.
    if (af.tillaegAngivesSom === 'beloeb') continue;
    manualBaseRowErrorsByAfId[af.id] = validateLoenudviklingManualBaseRowSatser(
      af.loenudviklingManuelTableData?.[0],
      {
        feriePct: af.feriePct,
        fritvalgPct: af.fritvalgPct,
        shSoPct: af.shSoPct,
        pensionPct: af.pensionPct,
      }
    );
  }

  const aarsloenZeroArbejdsdageValidationInput: AarsloenZeroArbejdsdageValidationInput = {
    beregnesUdFra,
    tafBeregningsperiodeFra,
    tafBeregningsperiodeTil,
    loenindkomstAnsaettelsesforhold,
    ferieperioder,
    fravaerPerioder,
  };
  const aarsloenExternalCellErrorMessagesByAfId: Record<string, Readonly<Record<string, string>>> = {};
  for (const af of loenindkomstAnsaettelsesforhold) {
    const messages = buildStandardLoenZeroArbejdsdageCellErrorMessages(aarsloenZeroArbejdsdageValidationInput, af.id);
    if (Object.keys(messages).length > 0) {
      aarsloenExternalCellErrorMessagesByAfId[af.id] = messages;
    }
  }

  const getAnvendtReguleringsdatoForAnsaettelsesforhold = (
    af: Pick<Ansaettelsesforhold, 'saerligFraDatoRegulering'>
  ): ISODateString | undefined =>
    resolveAnvendtReguleringsdato({
      beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
      saerligFraDatoRegulering: af.saerligFraDatoRegulering,
      beregningsperiodeTil: tafBeregningsperiodeTil,
      skadedato,
    });

  const getSfggReferenceperiodeAvailability = (
    employment: Ansaettelsesforhold,
    row: SfggRow | undefined
  ): SfggReferenceperiodeAvailability => {
    const source = resolveSfggSource(row, employment);
    const referenceDayCount = resolveSfggReferenceperiodeDayCount(eoValues, row, source);
    if (!referenceDayCount) {
      return { maxFravaersdage: undefined, hasNoRelevantDaysError: false, dayLabel: null };
    }
    const maxFravaersdage = referenceDayCount.divisorLabel === 'kalenderdage'
      ? referenceDayCount.kalenderdage
      : referenceDayCount.divisorDage;
    return {
      maxFravaersdage,
      hasNoRelevantDaysError: maxFravaersdage <= 0,
      dayLabel: referenceDayCount.divisorLabel,
    };
  };

  const getLoenudviklingBaseDate = (af: Ansaettelsesforhold): LoenudviklingBaseDate => {
    const iso = getAnvendtReguleringsdatoForAnsaettelsesforhold(af);
    if (!iso) {
      return { display: '', iso: undefined, errorMessage: 'Skadedato er ikke udfyldt' };
    }
    const parsed = parseISODate(iso);
    if (!parsed) {
      return { display: '', iso: undefined, errorMessage: 'Skadedato er ikke udfyldt' };
    }
    return { display: formatDanishDate(parsed), iso, errorMessage: undefined };
  };

  const isOffentligLoenSelectionReady = (af: Ansaettelsesforhold): boolean => {
    const overenskomstId = af.overenskomstId?.trim();
    if (!overenskomstId || !isOffentligOverenskomstId(overenskomstId)) return true;

    const loenTypeParsed = offentligLoenTypeEnum.safeParse(af.offentligLoenType ?? 'Månedsløn');
    if (!loenTypeParsed.success) return false;

    const trinValue = af.offentligLoenTrin;
    if (typeof trinValue !== 'number') return false;
    try {
      toLoentrin(trinValue);
    } catch {
      return false;
    }

    const gruppeValue = af.offentligLoenGruppe;
    if (typeof gruppeValue !== 'number') return false;
    if (gruppeValue < 0 || gruppeValue > 4) return false;

    return true;
  };

  const resolveOverenskomstLabel = (overenskomstId: string | undefined): string => {
    if (!overenskomstId || overenskomstId.trim() === '') return 'Ingen valgt';
    const meta = getOverenskomstMetaById(overenskomstId);
    if (!meta) return overenskomstId;
    const loenPart = meta.loenmodtagerOrg[0] || '';
    const arbPart = meta.arbejdsgiverOrg[0] || '';
    return `${meta.navn} (${loenPart} / ${arbPart})`;
  };

  const getFilteredOverenskomsterForAnsaettelsesforhold = (
    af: Ansaettelsesforhold
  ): ReadonlyArray<OverenskomstMeta> =>
    // overenskomstFilter er altid til stede (ikke-optional i schema)
    getOverenskomsterByOrg(af.overenskomstFilter.loenmodtager, af.overenskomstFilter.arbejdsgiver);

  const showSygeferiegodtgoerelseSection = (af: Ansaettelsesforhold): boolean =>
    shouldRequireSygeferiegodtgoerelseInput(eoValues, af);

  const getSfggRowForAf = (af: Ansaettelsesforhold): SfggRow | undefined =>
    eoValues.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === af.id);

  const firstTafFraDato = getFirstIndtastedeTafFraDato(eoValues);
  const sfggReferenceperiodeMaxDate = resolveSfggReferenceperiodeMaxDate(eoValues);

  return {
    satserByAfId,
    derivedCalculatorByAfId,
    manualBaseRowErrorsByAfId,
    aarsloenExternalCellErrorMessagesByAfId,
    getAnvendtReguleringsdatoForAnsaettelsesforhold,
    getSfggReferenceperiodeAvailability,
    getLoenudviklingBaseDate,
    isOffentligLoenSelectionReady,
    resolveOverenskomstLabel,
    getFilteredOverenskomsterForAnsaettelsesforhold,
    showSygeferiegodtgoerelseSection,
    getSfggRowForAf,
    firstTafFraDato,
    sfggReferenceperiodeMaxDate,
  };
}
