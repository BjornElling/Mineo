import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
} from '../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../types/branded';
import { buildReguleringsbevis } from '../../domain/erstatningsopgoerelse/engines/regulering/reguleringsbevis';
import type { ReguleringOpslag, ReguleringOpslagSegment } from '../../domain/erstatningsopgoerelse/engines/regulering/reguleringOpslag';
import type { LoenudviklingSegment } from '../../domain/erstatningsopgoerelse/shared/eoTypes';

type SfggRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];

export const asSfggAmount = (value: number): AmountValue => ({ kind: 'number', value });

export const sfggIso = (value: string) => toISODateString(value);

export const createSfggEmployment = (
  patch: Partial<LoenindkomstAnsaettelsesforhold> = {}
): LoenindkomstAnsaettelsesforhold => ({
  id: patch.id ?? 'af-1',
  navnPaaArbejdssted: patch.navnPaaArbejdssted ?? 'Arbejdssted 1',
  harOverenskomst: patch.harOverenskomst ?? false,
  overenskomstId: patch.overenskomstId,
  overenskomstFilter: patch.overenskomstFilter ?? { loenmodtager: undefined, arbejdsgiver: undefined },
  ansatPaaSkadestidspunktet: patch.ansatPaaSkadestidspunktet ?? true,
  ansaettelsesforholdOphoert: patch.ansaettelsesforholdOphoert ?? false,
  sidsteArbejdsdag: patch.sidsteArbejdsdag,
  feriePct: patch.feriePct,
  fritvalgPct: patch.fritvalgPct,
  shSoPct: patch.shSoPct,
  storeBededagPct: patch.storeBededagPct,
  pensionPct: patch.pensionPct ?? 0,
  loenperiode: patch.loenperiode ?? 'maaned',
  tillaegAngivesSom: patch.tillaegAngivesSom ?? 'procent',
  fuldLoenUnderFerie: patch.fuldLoenUnderFerie ?? 'Ja',
  harAnciennitetstillaegEfterSkadedatoen: patch.harAnciennitetstillaegEfterSkadedatoen ?? false,
  anciennitetstillaegDato: patch.anciennitetstillaegDato,
  anciennitetstillaegSatsAngivesPer: patch.anciennitetstillaegSatsAngivesPer ?? 'Måned',
  anciennitetstillaegSats: patch.anciennitetstillaegSats,
  loenPaaHelligdage: patch.loenPaaHelligdage ?? 'Almindelig løn',
  beregnStoreBededagstillaeg: patch.beregnStoreBededagstillaeg ?? false,
  saerligFraDatoRegulering: patch.saerligFraDatoRegulering,
  loenudviklingBeregningsgrundlag: patch.loenudviklingBeregningsgrundlag,
  loenudviklingStatistikModel: patch.loenudviklingStatistikModel,
  loenudviklingKRLSatstabel: patch.loenudviklingKRLSatstabel,
  loenudviklingManuelNavn: patch.loenudviklingManuelNavn ?? '',
  loenudviklingManuelTableData: patch.loenudviklingManuelTableData ?? [],
  offentligLoenType: patch.offentligLoenType ?? 'Månedsløn',
  offentligLoenTrin: patch.offentligLoenTrin,
  offentligLoenGruppe: patch.offentligLoenGruppe,
  offentligLoenEkstraGrundloen: patch.offentligLoenEkstraGrundloen,
  offentligLoenEkstraGrundloenAngivesPer: patch.offentligLoenEkstraGrundloenAngivesPer ?? 'Måned',
  indtaegtsoplysningerTableData: patch.indtaegtsoplysningerTableData ?? [],
  ...patch,
  loenudviklingManuelProcentsatsTableData: patch.loenudviklingManuelProcentsatsTableData ?? [],
});

/**
 * Bygger en SFGG-række med beregningsgrundlaget 'Ingen' (neutralt no-op-valg) for ét
 * ansættelsesforhold. Felterne svarer til schemaets output-type.
 */
export const createSfggIngenRow = (ansaettelsesforholdId: string): SfggRow => ({
  ansaettelsesforholdId,
  sfggBeregningskilde: 'Ingen',
  sfggManuelDagssats: undefined,
  sfggManuelBeloebIHenholdTil: undefined,
  sfggManuelFoerstEfterSygeloen: 'Nej',
  sfggReferenceperiodeFra: undefined,
  sfggReferenceperiodeTil: undefined,
  sfggReferenceperiodeFravaersdageUdenLoen: 0,
  sfggSatsvalg: undefined,
  sfggAlleredeBetaltBeloeb: undefined,
});

/**
 * Tilføjer en SFGG-'Ingen'-række for hvert ansættelsesforhold i `loenindkomstAnsaettelsesforhold`
 * der ikke allerede har en SFGG-række.
 *
 * Baggrund: SFGG-inputfejl er fail-closed/blokerende (jf. eo-snapshot-contract §3.1). Når SFGG er
 * relevant (`kravPaaTabtArbejdsfortjeneste === 'Ja'` + `ansatPaaSkadestidspunktet`), skal et
 * fixture – ligesom en rigtig bruger – eksplicit vælge et SFGG-beregningsgrundlag, ellers blokeres
 * den autoritative beregning ("'Sygeferiegodtgørelse beregnes ud fra' er ikke valgt"). 'Ingen' er det neutrale
 * valg, der ikke ændrer beregnede tal, men låser kravet om en eksplicit beslutning op.
 *
 * Brug denne helper i test-fixtures, hvor SFGG ikke er det, der testes.
 */
export const withSfggIngenForEmployments = (
  eoValues: ErstatningsopgoerelseValues
): ErstatningsopgoerelseValues => {
  const existingIds = new Set(
    eoValues.sfggAnsaettelsesforhold.map((row) => row.ansaettelsesforholdId)
  );
  const added = eoValues.loenindkomstAnsaettelsesforhold
    .filter((employment) => !existingIds.has(employment.id))
    .map((employment) => createSfggIngenRow(employment.id));
  if (added.length === 0) return eoValues;
  return {
    ...eoValues,
    sfggAnsaettelsesforhold: [...eoValues.sfggAnsaettelsesforhold, ...added],
  };
};

/**
 * Et reguleringsopslag med givne trin til SFGG-tests, der skal styre reguleringen direkte. Trinets delta
 * bliver det anvendte delta; et trin med `reguleretLoenOre` bærer KL-lønaftalers kædeløn. Datoer uden for
 * trinene er uden for dækning.
 */
export const sfggReguleringOpslagFraSegmenter = (
  segmenter: readonly LoenudviklingSegment[],
  reference?: Readonly<{ dato: ISODateString; deltaPct: number }>
): ReguleringOpslag => {
  const opslagSegmenter: ReguleringOpslagSegment[] = segmenter.map((segment) => {
    const regulering = segment.regulering
      ? { ...segment.regulering, appliedDeltaPct: segment.deltaPct }
      : buildReguleringsbevis(100, 100 + segment.deltaPct, { kind: 'procentsats', rawDeltaPct: segment.deltaPct });
    const basisLoenOre = segment.kind === 'maaneder' ? segment.maanedsloenOre : segment.dagsloenOre;
    return {
      fra: segment.fra,
      til: segment.til,
      vaerdi: {
        udfald: 'reguleret',
        regulering,
        ...(segment.reguleretLoenOre !== undefined
          ? { klKaedeloen: { basisLoenOre, reguleretLoenOre: segment.reguleretLoenOre } }
          : {}),
      },
    };
  });
  return {
    segmenter: opslagSegmenter,
    paaDato: (dato) => reference?.dato === dato
      ? { udfald: 'reguleret', regulering: buildReguleringsbevis(100, 100 + reference.deltaPct, { kind: 'procentsats' }) }
      : opslagSegmenter.find((segment) => dato >= segment.fra && dato <= segment.til)?.vaerdi
      ?? { udfald: 'uden-for-daekning', dato, daekning: {} },
  };
};
