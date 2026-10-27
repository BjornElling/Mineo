import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
  StamdataValues,
} from '../../../schemas/formSchemas';
import { resolveSatserHeadingForAnsaettelsesforhold } from '../helpers/satserHeading';
import type { ISODateString } from '../../../types/branded';
import { parseISODate } from '../../../types/branded';
import { formatDanishDate } from '../../../utils/dateUtils';
import type { StandardLoenTableSatser } from '../../../types/table';
import {
  getOverenskomstMetaById,
  getOverenskomstSfggPolicy,
  isOffentligOverenskomstId,
  resolveOverenskomstDisplay,
} from '../../../data/overenskomstRates';
import { toLoentrin } from '../../../data/offentligLoenTypes';
import { offentligLoenTypeEnum } from '../../../schemas/formSchemas';
import { getAngivetLoenOpreguleresFraDato } from '../helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../helpers/eoSharedUtils';
import { resolveSfggDayBasis, resolveSfggSource, type SfggDayBasis } from '../engines/sfggKilde';
import { buildSfggReferenceperiodeTooltip } from '../helpers/sygeferiegodtgoerelseTexts';
import { buildSfggSeksMaanederBesked } from '../engines/sfggWarnings';
import { computeTafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { shouldRequireSygeferiegodtgoerelseInput } from '../helpers/sygeferiegodtgoerelseEligibility';
import {
  erSfggFeltRelevantForSynlighed,
  resolveSfggSynlighed,
  type SfggFelt,
} from '../helpers/eoLoenindkomstRelevance';
import {
  validateLoenudviklingManualBaseRowSatser,
  type ManualBaseRowCellErrors,
} from '../validation/loenudviklingManuelBaseRowValidation';
import { calculateLoenindkomstRowDerived } from '../helpers/loenindkomstRowDerived';
import { resolveSkadeEllerAnmeldelsesdatoReference } from '../helpers/eoDateReferenceText';

/**
 * Ren (React-fri) afledning for Loenindkomst-fanen.
 *
 * Hele "given committed input → flad afledt model" bor her, så den kan unit-testes uden
 * React-render (jf. arkitektur-kandidat A1 – view-model-lagets primære gevinst: afledning testbar
 * uden render). `useLoenindkomstViewModel` ejer kun React-state/effekter/handlers og kalder denne
 * funktion inde i en `useMemo`. Modstykket til den allerede udskilte rene sats-validering i
 * `validation/loenindkomstSatsAssessment.ts`.
 *
 * Adfærdsbevarende: hver afledning er flyttet uændret ud af hooken/kortet – samme tal, samme
 * synlighed, samme fejl-ordlyd.
 */

type AnsaettelsesforholdList = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'];
type Ansaettelsesforhold = LoenindkomstAnsaettelsesforhold;
type SfggRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];

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
  skadestype: StamdataValues['skadestype'] | undefined;
}>;

/**
 * Den flade afledte model som Loenindkomst-fanen og dens kort forbruger. Per-af-opslag eksponeres
 * som rene funktioner/maps, så kortene aldrig behøver rå committed EO-state (`eoValues`) for at
 * udlede deres visning (jf. A1 – ingen rå committed state gennem konteksten).
 */
export type LoenindkomstFlatModel = Readonly<{
  satserByAfId: ReadonlyMap<string, StandardLoenTableSatser>;
  derivedCalculatorByAfId: ReadonlyMap<string, LoenindkomstRowDerivedCalculator>;
  manualBaseRowErrorsByAfId: Readonly<Record<string, ManualBaseRowCellErrors>>;

  // Per-af rene afledninger (committed-only).
  getAnvendtReguleringsdatoForAnsaettelsesforhold: (
    af: Pick<Ansaettelsesforhold, 'saerligFraDatoRegulering'>
  ) => ISODateString | undefined;
  /** Satsafsnittets overskrift – samme tekst som linjen i «Fejl og advarsler» og bilagets satslinjer. */
  getSatserHeadingForAnsaettelsesforhold: (af: Pick<Ansaettelsesforhold, 'saerligFraDatoRegulering'>) => string;
  getLoenudviklingBaseDate: (af: Ansaettelsesforhold) => LoenudviklingBaseDate;
  isOffentligLoenSelectionReady: (af: Ansaettelsesforhold) => boolean;
  resolveOverenskomstLabel: (overenskomstId: string | undefined) => string;

  // Per-af kort-afledninger der tidligere blev udregnet inde i AnsaettelsesforholdCard FRA eoValues.
  // Eksponeres her, så kortet ikke længere behøver rå committed EO-state.
  showSygeferiegodtgoerelseSection: (af: Ansaettelsesforhold) => boolean;
  getSfggRowForAf: (af: Ansaettelsesforhold) => SfggRow | undefined;
  /**
   * Hele SFGG-sektionens synlighed og etiketter for ét ansættelsesforhold.
   *
   * Lå tidligere som 10 løse booleans/labels inde i `AnsaettelsesforholdCard` – altså
   * domæneafledning i et view, og den ENESTE grund til at `SygeferiegodtgoerelseSection`
   * skulle tage 10 props, mens resten af sektionsfamilien tager nul. Samlet her, fordi
   * flagene er indbyrdes afhængige (kilde × overenskomst × satsmodel) og kun giver et
   * konsistent billede, når de afledes i én omgang fra samme række og policy.
   */
  getSfggPresentation: (af: Ansaettelsesforhold) => SfggPresentation;
}>;

/** Den samlede SFGG-visningsafledning for ét ansættelsesforhold (jf. `getSfggPresentation`). */
export type SfggPresentation = Readonly<{
  show: boolean;
  row: SfggRow | undefined;
  policy: ReturnType<typeof getOverenskomstSfggPolicy> | undefined;
  hasOverenskomst: boolean;
  selectedOverenskomstLabel: string;
  canShowOverenskomstDetails: boolean;
  requiresReferenceperiode: boolean;
  showSatsvalg: boolean;
  /**
   * Hvilke feltgrupper sektionen viser – samme afgørelse som felternes descriptor-relevans
   * (`eoLoenindkomstRelevance.ts`), så sektionen ikke kan vise et felt, readeren skjuler, eller omvendt.
   */
  relevanteFelter: Readonly<Record<SfggFelt, boolean>>;
  showSharedSfggBefore2015: boolean;
  /** Enheden, fraværsdagene i referenceperioden tælles i – samme som opgørelsen af sygeferiegodtgørelsen (BB-329). */
  fravaersdageEnhed: SfggDayBasis;
  /** Info-tooltippen ved «Referenceperiode»: reglens udgangspunkt, og at perioden er fri (BB-321). */
  referenceperiodeTooltip: string;
  /** Seksmånedersadvarslens tekst; vises kun, når snapshottet har meldt advarslen for kortet (BB-325). */
  seksMaanederBesked: string | undefined;
}>;

/**
 * Ren afledning: bygger hele den flade view-model ud fra committed input.
 *
 * Funktionerne i den returnerede model er afledning over committed input og holder ikke state.
 * `eoValues` modtages her, men eksponeres aldrig rå tilbage – kun afledte tal/flags.
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
    skadestype,
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
          tafPerioder: input.eoValues.tafPerioder,
        },
        skadedato,
      })
    );
  }

  const manualBaseRowErrorsByAfId: Record<string, ManualBaseRowCellErrors> = {};
  for (const af of loenindkomstAnsaettelsesforhold) {
    if (af.loenudviklingBeregningsgrundlag !== 'Manuelt angivet') continue;
    // Beløb-tilstand: basisrækkens tillægsprocenter er brugerindtastede i tabellen og skal ikke
    // spejle de skjulte satsfelter ovenfor.
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

  const getLoenudviklingBaseDate = (af: Ansaettelsesforhold): LoenudviklingBaseDate => {
    const iso = getAnvendtReguleringsdatoForAnsaettelsesforhold(af);
    const missingDateMessage = `${resolveSkadeEllerAnmeldelsesdatoReference(skadestype).label} er ikke udfyldt`;
    if (!iso) {
      return { display: '', iso: undefined, errorMessage: missingDateMessage };
    }
    const parsed = parseISODate(iso);
    if (!parsed) {
      return { display: '', iso: undefined, errorMessage: missingDateMessage };
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

  const resolveOverenskomstLabel = (overenskomstId: string | undefined): string =>
    resolveOverenskomstDisplay(overenskomstId, 'Ingen valgt');

  const showSygeferiegodtgoerelseSection = (af: Ansaettelsesforhold): boolean =>
    shouldRequireSygeferiegodtgoerelseInput(eoValues, af);

  const getSfggRowForAf = (af: Ansaettelsesforhold): SfggRow | undefined =>
    eoValues.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === af.id);

  const getSfggPresentation = (af: Ansaettelsesforhold): SfggPresentation => {
    const row = getSfggRowForAf(af);
    const overenskomstMeta = af.overenskomstId ? getOverenskomstMetaById(af.overenskomstId) : undefined;
    // Synligheden afledes af samme prædikat som SFGG-descriptorernes relevans, så et vist felt er et læst felt.
    const kilde = row?.sfggBeregningskilde;
    const synlighed = resolveSfggSynlighed({
      kravPaaTabtArbejdsfortjeneste: eoValues.kravPaaTabtArbejdsfortjeneste,
      employment: af,
      sfggBeregningskilde: kilde,
    });
    const hasOverenskomst = synlighed.harValgtOverenskomst;
    const source = resolveSfggSource(row, af);

    return {
      show: synlighed.sektionVist,
      row,
      policy: synlighed.policy,
      hasOverenskomst,
      selectedOverenskomstLabel: hasOverenskomst
        ? (overenskomstMeta?.navn ?? af.overenskomstId!.trim())
        : 'Ingen overenskomst valgt',
      canShowOverenskomstDetails: synlighed.overenskomstDetaljerVist,
      requiresReferenceperiode: synlighed.kraeverReferenceperiode,
      showSatsvalg: synlighed.satsvalgVist,
      relevanteFelter: {
        referenceperiode: erSfggFeltRelevantForSynlighed('referenceperiode', synlighed, kilde),
        satsvalg: erSfggFeltRelevantForSynlighed('satsvalg', synlighed, kilde),
        manuel: erSfggFeltRelevantForSynlighed('manuel', synlighed, kilde),
        alleredeBetalt: erSfggFeltRelevantForSynlighed('alleredeBetalt', synlighed, kilde),
      },
      showSharedSfggBefore2015: Boolean(skadedato && skadedato < '2015-01-01'),
      fravaersdageEnhed: resolveSfggDayBasis(source, computeTafBeregningsenhed(eoValues)),
      referenceperiodeTooltip: buildSfggReferenceperiodeTooltip(source.kind, af),
      seksMaanederBesked: buildSfggSeksMaanederBesked(eoValues, af),
    };
  };

  return {
    satserByAfId,
    derivedCalculatorByAfId,
    manualBaseRowErrorsByAfId,
    getAnvendtReguleringsdatoForAnsaettelsesforhold,
    getSatserHeadingForAnsaettelsesforhold: (af) => resolveSatserHeadingForAnsaettelsesforhold({
      values: eoValues,
      ansaettelsesforhold: af,
      skadedato,
      skadestype,
    }),
    getLoenudviklingBaseDate,
    isOffentligLoenSelectionReady,
    resolveOverenskomstLabel,
    showSygeferiegodtgoerelseSection,
    getSfggRowForAf,
    getSfggPresentation,
  };
}
